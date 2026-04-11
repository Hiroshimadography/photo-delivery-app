import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/utils/rate-limit';
import { validateFolderName } from '@/utils/input-validation';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const folderCheck = validateFolderName(id);
        if (!folderCheck.valid) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        const clientIp = getClientIp(request);
        const rateCheck = checkRateLimit(`download:${clientIp}`, RATE_LIMITS.DOWNLOAD);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { success: false, message: 'Too many requests' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 0) / 1000)) } }
            );
        }

        const { photoId } = await request.json();

        if (!photoId || typeof photoId !== 'string') {
            return NextResponse.json({ success: false, message: 'Invalid photo ID' }, { status: 400 });
        }

        // プロジェクト取得
        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('id, folder_name')
            .eq('folder_name', id)
            .single();

        if (error || !project) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        // 写真取得（プロジェクトに属しているか確認）
        const { data: photo, error: photoError } = await supabaseAdmin
            .from('photos')
            .select('id, storage_path')
            .eq('id', photoId)
            .eq('project_id', project.id)
            .single();

        if (photoError || !photo) {
            return NextResponse.json({ success: false, message: 'Photo not found' }, { status: 404 });
        }

        // ファイル名を storage_path から取得
        const parts = photo.storage_path.split('/');
        const originalFilename = parts.pop() || 'photo.jpg';

        // 署名付きURL（Content-Disposition: attachment を強制）
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('photos')
            .createSignedUrl(photo.storage_path, 600, {
                download: originalFilename,
            });

        if (signedError || !signedData?.signedUrl) {
            return NextResponse.json({ success: false, message: 'Failed to generate download URL' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            downloadUrl: signedData.signedUrl,
            filename: originalFilename,
        });

    } catch (e) {
        console.error('Download single error:', e);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
