import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/utils/supabase/auth-guard";
import { validateFileExtension, validateBucket, validateStoragePath } from "@/utils/file-validation";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/utils/rate-limit";

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

        // Rate limit uploads: 30 per minute
        const rateCheck = checkRateLimit(`upload:${getClientIp(req)}`, RATE_LIMITS.UPLOAD);
        if (!rateCheck.allowed) {
            return NextResponse.json(
                { error: "Too many upload requests" },
                { status: 429, headers: { 'Retry-After': String(Math.ceil((rateCheck.retryAfterMs || 0) / 1000)) } }
            );
        }

        const { storagePath, bucket = 'photos' } = await req.json();

        if (!storagePath) {
            return NextResponse.json({ error: "Missing storagePath" }, { status: 400 });
        }

        // Validate bucket to prevent bucket traversal
        const bucketCheck = validateBucket(bucket);
        if (!bucketCheck.valid) {
            return NextResponse.json({ error: bucketCheck.error }, { status: 400 });
        }

        // Validate storage path (path traversal prevention)
        const pathCheck = validateStoragePath(storagePath);
        if (!pathCheck.valid) {
            return NextResponse.json({ error: pathCheck.error }, { status: 400 });
        }

        // Validate file extension
        const extCheck = validateFileExtension(storagePath);
        if (!extCheck.valid) {
            return NextResponse.json({ error: extCheck.error }, { status: 400 });
        }

        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUploadUrl(storagePath);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Init upload error:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error during upload init" },
            { status: 500 }
        );
    }
}
