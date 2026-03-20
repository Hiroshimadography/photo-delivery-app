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

        // Validate folder_name format
        const folderCheck = validateFolderName(id);
        if (!folderCheck.valid) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        // Rate limit downloads: 20 per minute per IP
        const clientIp = getClientIp(request);
        const rateCheck = checkRateLimit(`download:${clientIp}`, RATE_LIMITS.DOWNLOAD);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { success: false, message: 'Too many requests' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 0) / 1000)) } }
            );
        }

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
            return NextResponse.json({
                success: false,
                message: 'ダウンロード回数の上限に達しました。',
                count: project.download_count,
                max: project.max_downloads,
            }, { status: 403 });
        }

        // Validate action parameter
        const validActions = ['all', 'selected', 'download'];
        const sanitizedAction = validActions.includes(action) ? action : 'download';

        // Increment count and log in parallel
        const [rpcResult] = await Promise.all([
            supabaseAdmin.rpc('increment_download_count', { p_id: project.id }),
            supabaseAdmin.from('download_logs').insert([{
                project_id: project.id,
                ip_address: clientIp,
                action: sanitizedAction,
            }]),
        ]);

        // Fetch updated count for accurate response
        const { data: updated } = await supabaseAdmin
            .from('projects')
            .select('download_count')
            .eq('id', project.id)
            .single();

        const newCount = updated?.download_count ?? project.download_count + 1;

        return NextResponse.json({
            success: true,
            count: newCount,
            max: project.max_downloads,
            remaining: project.max_downloads - newCount,
        });

    } catch (e) {
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
