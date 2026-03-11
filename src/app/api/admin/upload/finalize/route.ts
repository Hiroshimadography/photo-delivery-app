import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
    try {
        const { projectId, storagePath } = await req.json();
        
        if (!projectId || !storagePath) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Generate signed URL for admin thumbnail display
        const { data: signedData } = await supabase.storage
            .from('photos')
            .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

        const thumbUrl = signedData?.signedUrl || '';

        const { error: dbError } = await supabase
            .from('photos')
            .insert([
                {
                    project_id: projectId,
                    storage_path: storagePath,
                    url: thumbUrl
                }
            ]);

        if (dbError) throw dbError;

        return NextResponse.json({ success: true, url: thumbUrl });
    } catch (error: any) {
        console.error("Finalize upload error:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error during upload finalize" },
            { status: 500 }
        );
    }
}
