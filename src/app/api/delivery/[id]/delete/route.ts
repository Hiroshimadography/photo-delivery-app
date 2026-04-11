import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

        // プロジェクト取得
        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('id, folder_name')
            .eq('folder_name', id)
            .single();

        if (error || !project) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        // 写真のストレージパスを取得
        const { data: photos } = await supabaseAdmin
            .from('photos')
            .select('id, storage_path')
            .eq('project_id', project.id);

        // Supabase Storageから写真ファイルを削除
        if (photos && photos.length > 0) {
            const storagePaths = photos.flatMap(photo => {
                const parts = photo.storage_path.split('/');
                const filename = parts.pop() || '';
                const dir = parts.join('/');
                // 元画像とサムネイル両方を削除
                return [photo.storage_path, `${dir}/thumb_${filename}`];
            });

            await supabaseAdmin.storage
                .from('photos')
                .remove(storagePaths);

            // DBから写真レコードを削除
            await supabaseAdmin
                .from('photos')
                .delete()
                .eq('project_id', project.id);
        }

        // temp-downloads内の一時ZIPファイルも削除
        const { data: tempFiles } = await supabaseAdmin.storage
            .from('photos')
            .list(`temp-downloads/${project.id}`);

        if (tempFiles && tempFiles.length > 0) {
            const tempPaths = tempFiles.map(f => `temp-downloads/${project.id}/${f.name}`);
            await supabaseAdmin.storage
                .from('photos')
                .remove(tempPaths);
        }

        // プロジェクトのステータスを無効にする
        await supabaseAdmin
            .from('projects')
            .update({ status: 'deleted' })
            .eq('id', project.id);

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error('Delete project data error:', e);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
