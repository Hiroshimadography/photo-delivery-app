import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/utils/supabase/auth-guard";
import { isValidUUID } from "@/utils/input-validation";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Fetch photos for a project with fresh signed URLs.
 * This ensures admin thumbnails always work even after URL expiry.
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireAdmin(req);
        if (!auth.authenticated) return auth.response;

        const { id } = await params;

        if (!isValidUUID(id)) {
            return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
        }

        const { data: photos, error } = await supabase
            .from('photos')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Generate fresh signed URLs (valid for 1 week)
        const expiryTime = 60 * 60 * 24 * 7;
        const photosWithFreshUrls = await Promise.all(
            (photos || []).map(async (photo) => {
                const parts = photo.storage_path.split('/');
                const filename = parts.pop() || '';
                const thumbPath = `${parts.join('/')}/thumb_${filename}`;

                const { data: thumbData } = await supabase.storage
                    .from('photos')
                    .createSignedUrl(thumbPath, expiryTime);

                let url = thumbData?.signedUrl;

                if (!url) {
                    const { data: origData } = await supabase.storage
                        .from('photos')
                        .createSignedUrl(photo.storage_path, expiryTime);
                    url = origData?.signedUrl || '';
                }

                return {
                    ...photo,
                    url,
                };
            })
        );

        return NextResponse.json({ photos: photosWithFreshUrls });
    } catch (error: any) {
        console.error("Fetch photos error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to fetch photos" },
            { status: 500 }
        );
    }
}
