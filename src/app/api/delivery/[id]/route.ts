import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyPassword, isEncrypted } from '@/utils/crypto';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/utils/rate-limit';
import { recordAuditLog } from '@/utils/audit-log';
import { validateFolderName } from '@/utils/input-validation';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Validate folder_name format (must be UUID)
        const folderCheck = validateFolderName(id);
        if (!folderCheck.valid) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('id, name, password, download_count, max_downloads, expires_at, status')
            .eq('folder_name', id)
            .single();

        if (error || !project) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        // Check if project is expired or inactive
        const isExpired = project.expires_at && new Date(project.expires_at) < new Date();
        const isInactive = project.status !== 'active';
        const isDownloadLimitReached = project.download_count >= project.max_downloads;

        if (isExpired || isInactive) {
            return NextResponse.json({
                success: false,
                message: 'このプロジェクトは有効期限が切れているか、無効になっています。',
            }, { status: 403 });
        }

        // URLパラメータのみでアクセス可能な情報として、ブランド設定も返す
        const { data: brandSettings, error: brandError } = await supabaseAdmin
            .from('brand_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (brandError) {
            console.error('Error fetching brand settings:', brandError);
        }

        return NextResponse.json({
            success: true,
            project: {
                id: project.id,
                name: project.name,
                hasPassword: !!project.password,
                download_count: project.download_count,
                max_downloads: project.max_downloads,
                isDownloadLimitReached: isDownloadLimitReached,
            },
            settings: {
                brand_name: brandSettings?.brand_name || "Hiroshimadography",
                logo_url: brandSettings?.logo_url || null
            }
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            }
        });
    } catch (e) {
         return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Validate folder_name format
        const folderCheck = validateFolderName(id);
        if (!folderCheck.valid) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        // Rate limit password attempts: 5 per 15 minutes per IP+project
        const clientIp = getClientIp(request);
        const rateLimitKey = `password:${clientIp}:${id}`;
        const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMITS.PASSWORD);
        if (!rateCheck.allowed) {
            const retryAfterSec = Math.ceil((rateCheck.retryAfterMs || 0) / 1000);
            return NextResponse.json(
                { success: false, message: 'パスワードの試行回数が上限に達しました。しばらくしてからお試しください。' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(retryAfterSec) },
                }
            );
        }

        const { password } = await request.json();

        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('*')
            .order('updated_at', { ascending: false })
            .eq('folder_name', id)
            .single();

        if (error || !project) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        if (project.password) {
            // Use constant-time comparison for encrypted passwords, fallback for plain text (pre-migration)
            const isValid = isEncrypted(project.password)
                ? verifyPassword(password || '', project.password)
                : project.password === password;

            if (!isValid) {
                recordAuditLog({
                    action: 'password.failed',
                    ip_address: clientIp,
                    resource_type: 'project',
                    resource_id: project.id,
                    details: { folder_name: id },
                });
                return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 });
            }
        }

        // Log successful access
        recordAuditLog({
            action: 'password.success',
            ip_address: clientIp,
            resource_type: 'project',
            resource_id: project.id,
        });

        // Check download limit before generating signed URLs
        if (project.download_count >= project.max_downloads) {
            return NextResponse.json({
                success: false,
                message: 'ダウンロード回数の上限に達しました。',
            }, { status: 403 });
        }

        // Check project expiration
        if (project.expires_at && new Date(project.expires_at) < new Date()) {
            return NextResponse.json({
                success: false,
                message: 'このプロジェクトの有効期限が切れています。',
            }, { status: 403 });
        }

        const { data: brandSettings, error: brandError } = await supabaseAdmin
            .from('brand_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (brandError) {
            console.error('Error fetching brand settings in POST:', brandError);
        }

        const { data: photos, error: photosError } = await supabaseAdmin
            .from('photos')
            .select('*')
            .eq('project_id', project.id)
            .order('created_at', { ascending: true });

        if (photosError) throw photosError;

        // Generate signed URLs valid for 2 hours
        const photosWithUrls = await Promise.all((photos || []).map(async (photo) => {
            const { data, error: urlError } = await supabaseAdmin.storage
                .from('photos')
                .createSignedUrl(photo.storage_path, 7200);

            // サムネイル用のURLも生成
            const parts = photo.storage_path.split('/');
            const filename = parts.pop() || '';
            const thumbPath = `${parts.join('/')}/thumb_${filename}`;

            const { data: thumbData } = await supabaseAdmin.storage
                .from('photos')
                .createSignedUrl(thumbPath, 7200);

            return {
                id: photo.id,
                url: urlError ? null : data?.signedUrl,
                thumbUrl: thumbData?.signedUrl
            };
        }));

        return NextResponse.json({
            success: true,
            project: {
                id: project.id,
                name: project.name,
                folder_name: project.folder_name,
                download_count: project.download_count,
                max_downloads: project.max_downloads
            },
            settings: {
                brand_name: brandSettings?.brand_name || "Hiroshimadography",
                logo_url: brandSettings?.logo_url || null
            },
            photos: photosWithUrls.filter(p => p.url)
        }, {
            headers: {
                'Cache-Control': 'no-store, max-age=0',
            }
        });

    } catch (e) {
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
