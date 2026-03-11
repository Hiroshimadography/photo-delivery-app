import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
        const { action } = await request.json();

        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('id, download_count, max_downloads')
            .eq('folder_name', id)
            .single();

        if (error || !project) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        if (project.download_count >= project.max_downloads) {
            return NextResponse.json({ success: false, message: 'Download limit exceeded' }, { status: 403 });
        }

        const ip = request.headers.get('x-forwarded-for') || 'unknown';

        await supabaseAdmin.rpc('increment_download_count', { p_id: project.id });
        
        await supabaseAdmin.from('download_logs').insert([{
            project_id: project.id,
            ip_address: ip,
            action: action || 'download'
        }]);

        return NextResponse.json({ success: true, count: project.download_count + 1 });

    } catch (e) {
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
