import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/utils/supabase/auth-guard";
import { validateStoragePath } from "@/utils/file-validation";
import { isValidUUID } from "@/utils/input-validation";
import { recordAuditLog } from "@/utils/audit-log";
import { getClientIp } from "@/utils/rate-limit";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
    try {
        // Verify admin authentication
        const auth = await requireAdmin(req);
        if (!auth.authenticated) return auth.response;

        const { projectId, storagePath } = await req.json();
        
        if (!projectId || !storagePath) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Validate projectId is a UUID
        if (!isValidUUID(projectId)) {
            return NextResponse.json({ error: "Invalid project ID format" }, { status: 400 });
        }

        // Validate storage path
        const pathCheck = validateStoragePath(storagePath);
        if (!pathCheck.valid) {
            return NextResponse.json({ error: pathCheck.error }, { status: 400 });
        }

        // Generate signed URL for admin thumbnail display (max 1 week)
        const expiryTime = 60 * 60 * 24 * 7;
        
        // Use thumb path for the admin preview to speed up loading
        const parts = storagePath.split('/');
        const filename = parts.pop() || '';
        const thumbStoragePath = `${parts.join('/')}/thumb_${filename}`;

        const { data: signedData } = await supabase.storage
            .from('photos')
            .createSignedUrl(thumbStoragePath, expiryTime);

        let thumbUrl = signedData?.signedUrl;
        
        // If thumb signed URL somehow fails, fallback to original path
        if (!thumbUrl) {
             const { data: origSignedData } = await supabase.storage
                .from('photos')
                .createSignedUrl(storagePath, expiryTime);
             thumbUrl = origSignedData?.signedUrl || '';
        }

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

        recordAuditLog({
            action: 'photo.upload',
            user_id: auth.userId,
            ip_address: getClientIp(req),
            resource_type: 'photo',
            resource_id: projectId,
            details: { storagePath },
        });

        return NextResponse.json({ success: true, url: thumbUrl });
    } catch (error: any) {
        console.error("Finalize upload error:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error during upload finalize" },
            { status: 500 }
        );
    }
}
