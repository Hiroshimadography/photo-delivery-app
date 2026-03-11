import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client with the Service Role Key for admin tasks
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const projectId = formData.get('projectId') as string;
        const storagePath = formData.get('storagePath') as string;

        if (!file || !projectId || !storagePath) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Upload to Supabase Storage (bypassing RLS with Service Role)
        const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(storagePath, file);

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500 });
        }

        // 2. Generate signed URL for admin thumbnail display
        // We use a long expiry (e.g., 7 days) since this URL is only stored in the DB for admin reference.
        // Customer delivery generates fresh signed URLs on the fly.
        const { data: signedData, error: signError } = await supabase.storage
            .from('photos')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

        if (signError) {
            console.error("Error creating signed URL for thumbnail:", signError);
            // Fallback to empty string or placeholder if it fails, but insert must proceed
        }

        const thumbUrl = signedData?.signedUrl || '';

        // 3. Insert record into 'photos' table
        const { error: dbError } = await supabase
            .from('photos')
            .insert([
                {
                    project_id: projectId,
                    storage_path: storagePath,
                    url: thumbUrl // Storing a signed URL so admin dashboard can preview it
                }
            ]);

        if (dbError) {
            console.error("Database insert error:", dbError);
            // Attempt to rollback storage upload if DB fails
            await supabase.storage.from('photos').remove([storagePath]);
            return NextResponse.json({ error: "Failed to save photo record" }, { status: 500 });
        }

        return NextResponse.json({ success: true, url: thumbUrl });

    } catch (error) {
        console.error("Admin upload API error:", error);
        return NextResponse.json(
            { error: "Internal server error during upload" },
            { status: 500 }
        );
    }
}
