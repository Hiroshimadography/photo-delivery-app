import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
        
        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('id, name, password, download_count, max_downloads')
            .eq('folder_name', id)
            .single();

        if (error || !project) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        // URLパラメータのみでアクセス可能な情報として、ブランド設定も返す
        const { data: brandSettings, error: brandError } = await supabaseAdmin
            .from('brand_settings')
            .select('*')
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
                max_downloads: project.max_downloads
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
        const { password } = await request.json();
        const { id } = await params;

        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('*')
            .eq('folder_name', id)
            .single();

        if (error || !project) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        if (project.password && project.password !== password) {
            return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 });
        }

        const { data: brandSettings, error: brandError } = await supabaseAdmin
            .from('brand_settings')
            .select('*')
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
