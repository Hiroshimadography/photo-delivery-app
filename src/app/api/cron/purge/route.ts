import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
        const now = new Date().toISOString();
        
        // Find expired projects
        const { data: expiredProjects, error } = await supabaseAdmin
            .from('projects')
            .select('id, folder_name')
            .not('expires_at', 'is', null) // Only check those with expiration
            .lt('expires_at', now);

        if (error) throw error;

        let deletedCount = 0;

        for (const project of expiredProjects || []) {
            // First list the files in the directory
            const { data: files } = await supabaseAdmin.storage
                .from('photos')
                .list(project.folder_name);

            if (files && files.length > 0) {
                const pathsToDelete = files.map(f => `${project.folder_name}/${f.name}`);
                await supabaseAdmin.storage.from('photos').remove(pathsToDelete);
            }

            // Delete project (cascade handles related rows)
            await supabaseAdmin.from('projects').delete().eq('id', project.id);
            deletedCount++;
        }

        return NextResponse.json({ success: true, deleted: deletedCount });

    } catch (e) {
        console.error("Purge error:", e);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
