import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function GET(request: Request) {
    // CRON_SECRET must always be set — fail-safe: reject if missing
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('CRON_SECRET is not configured. Rejecting cron request.');
        return NextResponse.json(
            { success: false, message: 'Server misconfiguration' },
            { status: 500 }
        );
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { success: false, message: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        const now = new Date().toISOString();

        // Find expired projects
        const { data: expiredProjects, error } = await supabaseAdmin
            .from('projects')
            .select('id, folder_name')
            .not('expires_at', 'is', null)
            .lt('expires_at', now);

        if (error) throw error;

        let deletedCount = 0;
        const errors: string[] = [];

        for (const project of expiredProjects || []) {
            try {
                // List and delete all files in the project folder
                const { data: files } = await supabaseAdmin.storage
                    .from('photos')
                    .list(project.folder_name);

                if (files && files.length > 0) {
                    const pathsToDelete = files.map(f => `${project.folder_name}/${f.name}`);
                    const { error: storageError } = await supabaseAdmin.storage
                        .from('photos')
                        .remove(pathsToDelete);

                    if (storageError) {
                        console.error(`Storage cleanup failed for project ${project.id}:`, storageError);
                        errors.push(`storage:${project.id}`);
                    }
                }

                // Delete project (cascade handles related DB rows)
                const { error: deleteError } = await supabaseAdmin
                    .from('projects')
                    .delete()
                    .eq('id', project.id);

                if (deleteError) {
                    console.error(`DB delete failed for project ${project.id}:`, deleteError);
                    errors.push(`db:${project.id}`);
                } else {
                    deletedCount++;
                }
            } catch (projectError) {
                console.error(`Purge failed for project ${project.id}:`, projectError);
                errors.push(`unknown:${project.id}`);
            }
        }

        // ====== 一時ZIPファイルの削除（1時間以上前のもの） ======
        let tempZipDeleted = 0;
        let tempZipErrors: string[] = [];

        try {
            // temp-downloads/ 配下のプロジェクトフォルダ一覧を取得
            const { data: tempFolders } = await supabaseAdmin.storage
                .from('photos')
                .list('temp-downloads');

            if (tempFolders && tempFolders.length > 0) {
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

                for (const folder of tempFolders) {
                    try {
                        // 各プロジェクトフォルダ内のZIPファイル一覧
                        const { data: zipFiles } = await supabaseAdmin.storage
                            .from('photos')
                            .list(`temp-downloads/${folder.name}`);

                        if (!zipFiles || zipFiles.length === 0) continue;

                        // 1時間以上経過したファイルを抽出
                        const expiredFiles = zipFiles.filter(f => {
                            const created = new Date(f.created_at);
                            return created < oneHourAgo;
                        });

                        if (expiredFiles.length > 0) {
                            const pathsToDelete = expiredFiles.map(
                                f => `temp-downloads/${folder.name}/${f.name}`
                            );
                            const { error: removeError } = await supabaseAdmin.storage
                                .from('photos')
                                .remove(pathsToDelete);

                            if (removeError) {
                                console.error(`Failed to remove temp zips in ${folder.name}:`, removeError);
                                tempZipErrors.push(folder.name);
                            } else {
                                tempZipDeleted += expiredFiles.length;
                            }
                        }
                    } catch (folderErr) {
                        console.error(`Error processing temp folder ${folder.name}:`, folderErr);
                        tempZipErrors.push(folder.name);
                    }
                }
            }
        } catch (tempErr) {
            console.error('Temp ZIP cleanup error:', tempErr);
            tempZipErrors.push('listing_failed');
        }

        return NextResponse.json({
            success: true,
            deleted: deletedCount,
            total_expired: expiredProjects?.length || 0,
            temp_zip_deleted: tempZipDeleted,
            errors: errors.length > 0 ? errors : undefined,
            temp_zip_errors: tempZipErrors.length > 0 ? tempZipErrors : undefined,
            timestamp: now,
        });

    } catch (e) {
        console.error("Purge error:", e);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
