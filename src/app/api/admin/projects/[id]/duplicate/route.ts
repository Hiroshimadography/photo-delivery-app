import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        // 1. Get original project
        const { data: originalProject, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (projectError || !originalProject) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // 2. Create new project with random folder name and duplicate settings
        const newFolderName = Math.random().toString(36).substring(2, 10);
        
        const { data: newProject, error: newProjectError } = await supabase
            .from('projects')
            .insert({
                name: `${originalProject.name} (コピー)`,
                folder_name: newFolderName,
                password: originalProject.password,
                memo: originalProject.memo,
                max_downloads: originalProject.max_downloads,
                download_count: 0,
                view_count: 0,
                expires_at: originalProject.expires_at,
                status: originalProject.status
            })
            .select()
            .single();

        if (newProjectError || !newProject) {
            throw newProjectError || new Error("Failed to create new project");
        }

        // 3. Get all photos from original project
        const { data: originalPhotos, error: photosError } = await supabase
            .from('photos')
            .select('*')
            .eq('project_id', id);

        if (photosError) {
            throw photosError;
        }

        const newPhotos = [];

        // 4. Copy each photo in storage and DB
        if (originalPhotos && originalPhotos.length > 0) {
            for (const photo of originalPhotos) {
                const oldStoragePath = photo.storage_path;
                
                // Extract original filename
                const parts = oldStoragePath.split('/');
                const filename = parts.pop() || '';
                
                // Generate new paths
                const newStoragePath = `${newFolderName}/${filename}`;
                const dummyThumbPathOld = `${parts.join('/')}/thumb_${filename}`;
                const dummyThumbPathNew = `${newFolderName}/thumb_${filename}`;

                // Check if thumbnail exists
                const { data: files } = await supabase.storage.from('photos').list(parts.join('/'), {
                    search: `thumb_${filename}`
                });
                
                const hasThumbnail = files && files.length > 0;

                // Copy original high res photo
                const { error: copyError } = await supabase.storage
                    .from('photos')
                    .copy(oldStoragePath, newStoragePath);

                if (copyError) {
                    console.error("Failed to copy file:", copyError);
                    continue; // Skip this photo if copy fails
                }

                // Copy thumbnail if it exists
                if (hasThumbnail) {
                     const { error: thumbCopyError } = await supabase.storage
                        .from('photos')
                        .copy(dummyThumbPathOld, dummyThumbPathNew);
                     if (thumbCopyError) {
                         console.error("Failed to copy thumbnail:", thumbCopyError);
                     }
                }

                // Generate Signed URL for the new thumbnail/original based on the same logic in finalize
                const expiryTime = 60 * 60 * 24 * 365 * 10;
                let finalUrl = '';

                // Try thumb first
                if (hasThumbnail) {
                    const { data: thumbSignedData } = await supabase.storage
                        .from('photos')
                        .createSignedUrl(dummyThumbPathNew, expiryTime);
                    finalUrl = thumbSignedData?.signedUrl || '';
                }

                if (!finalUrl) {
                    const { data: origSignedData } = await supabase.storage
                        .from('photos')
                        .createSignedUrl(newStoragePath, expiryTime);
                    finalUrl = origSignedData?.signedUrl || '';
                }

                newPhotos.push({
                    project_id: newProject.id,
                    storage_path: newStoragePath,
                    url: finalUrl
                });
            }

            // Insert new photo records
            if (newPhotos.length > 0) {
                const { error: insertPhotosError } = await supabase
                    .from('photos')
                    .insert(newPhotos);

                if (insertPhotosError) {
                    throw insertPhotosError;
                }
            }
        }

        return NextResponse.json({ success: true, projectId: newProject.id });

    } catch (error: any) {
        console.error("Duplicate Project Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
