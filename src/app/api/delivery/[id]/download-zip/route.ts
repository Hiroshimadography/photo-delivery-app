import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/utils/rate-limit';
import { validateFolderName } from '@/utils/input-validation';

// Vercel Serverless: 最大実行時間を延長（Hobby: 10s, Pro: 最大300s）
export const maxDuration = 60;

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

        const { action, photoIds } = await request.json();

        // Fetch project
        const { data: project, error } = await supabaseAdmin
            .from('projects')
            .select('id, folder_name')
            .eq('folder_name', id)
            .single();

        if (error || !project) {
            return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
        }

        // Fetch photos from DB
        let query = supabaseAdmin
            .from('photos')
            .select('id, storage_path, original_filename')
            .eq('project_id', project.id)
            .order('created_at', { ascending: true });

        if (action === 'selected' && Array.isArray(photoIds) && photoIds.length > 0) {
            query = query.in('id', photoIds);
        }

        const { data: photos, error: photosError } = await query;
        if (photosError || !photos || photos.length === 0) {
            return NextResponse.json({ success: false, message: 'No photos found' }, { status: 404 });
        }

        // Log download
        const sanitizedAction = ['all', 'selected'].includes(action) ? action : 'download';
        await supabaseAdmin.from('download_logs').insert([{
            project_id: project.id,
            ip_address: clientIp,
            action: sanitizedAction,
        }]);

        // ====== ZIPをサーバーサイドで生成 ======
        const zip = new JSZip();

        // 3枚ずつバッチ処理（メモリ節約のため少なめ）
        const batchSize = 3;
        for (let i = 0; i < photos.length; i += batchSize) {
            const chunk = photos.slice(i, i + batchSize);

            await Promise.all(chunk.map(async (photo, batchIndex) => {
                const globalIndex = i + batchIndex;
                try {
                    const { data: signedUrlData } = await supabaseAdmin.storage
                        .from('photos')
                        .createSignedUrl(photo.storage_path, 600);

                    if (signedUrlData?.signedUrl) {
                        const response = await fetch(signedUrlData.signedUrl);
                        if (response.ok) {
                            const arrayBuffer = await response.arrayBuffer();
                            // 元のファイル名があればそれを使用、なければ連番
                            const ext = photo.storage_path.split('.').pop() || 'jpg';
                            const filename = photo.original_filename
                                || `img_${String(globalIndex + 1).padStart(3, '0')}.${ext}`;
                            zip.file(filename, arrayBuffer);
                        }
                    }
                } catch (e) {
                    console.error('Failed to fetch photo for zip:', photo.storage_path, e);
                }
            }));
        }

        const zipBuffer = await zip.generateAsync({
            type: 'uint8array',
            compression: 'STORE',  // 写真はすでに圧縮済みなので再圧縮しない（高速化+メモリ節約）
        });

        const zipFilename = action === 'selected'
            ? `${project.folder_name}_selected.zip`
            : `${project.folder_name}_all.zip`;

        // ====== Supabase Storageに一時保存 → 署名付きURLを返す ======
        // Vercelのレスポンスサイズ制限(4.5MB)を回避するため、
        // ZIPをSupabase Storageにアップロードし、署名付きURLでダウンロードさせる
        const tempPath = `temp-downloads/${project.id}/${Date.now()}_${zipFilename}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from('photos')
            .upload(tempPath, zipBuffer, {
                contentType: 'application/zip',
                upsert: true,
            });

        if (uploadError) {
            console.error('Failed to upload zip to storage:', uploadError);
            // フォールバック: 小さいZIPなら直接返す（4MB以下）
            if (zipBuffer.byteLength <= 4 * 1024 * 1024) {
                return new Response(zipBuffer, {
                    headers: {
                        'Content-Type': 'application/zip',
                        'Content-Disposition': `attachment; filename="${zipFilename}"`,
                        'Content-Length': String(zipBuffer.byteLength),
                    },
                });
            }
            return NextResponse.json({ success: false, message: 'ZIPファイルの生成に失敗しました。' }, { status: 500 });
        }

        // 署名付きURL（10分間有効）
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
            .from('photos')
            .createSignedUrl(tempPath, 600, {
                download: zipFilename,  // Content-Disposition: attachment を強制
            });

        if (signedError || !signedData?.signedUrl) {
            console.error('Failed to create signed URL for zip:', signedError);
            return NextResponse.json({ success: false, message: 'ZIPファイルの生成に失敗しました。' }, { status: 500 });
        }

        // クライアントに署名付きURLを返す（クライアントがこのURLからダウンロード）
        return NextResponse.json({
            success: true,
            downloadUrl: signedData.signedUrl,
        });

    } catch (e) {
        console.error('Download zip error:', e);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}
