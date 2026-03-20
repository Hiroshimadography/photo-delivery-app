import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/utils/supabase/auth-guard";
import { encryptPassword } from "@/utils/crypto";
import { recordAuditLog } from "@/utils/audit-log";
import { getClientIp } from "@/utils/rate-limit";
import { sanitizeProjectName, sanitizeMemo, sanitizePassword, validatePositiveInt, isValidUUID } from "@/utils/input-validation";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);
        if (!auth.authenticated) return auth.response;

        const body = await req.json();
        const { name, folder_name, password, memo, expires_at, max_downloads } = body;

        // Validate project name
        const nameCheck = sanitizeProjectName(name);
        if (!nameCheck.valid) {
            return NextResponse.json({ error: nameCheck.error }, { status: 400 });
        }

        // Validate folder_name is a UUID
        if (!folder_name || !isValidUUID(folder_name)) {
            return NextResponse.json({ error: "Invalid folder name format" }, { status: 400 });
        }

        // Validate max_downloads
        const maxDlCheck = validatePositiveInt(max_downloads || 5, 1000);
        if (!maxDlCheck.valid) {
            return NextResponse.json({ error: `max_downloads: ${maxDlCheck.error}` }, { status: 400 });
        }

        // Sanitize inputs
        const sanitizedPassword = sanitizePassword(password);
        const sanitizedMemo = sanitizeMemo(memo);

        // Encrypt password server-side before storing
        const encryptedPassword = sanitizedPassword ? encryptPassword(sanitizedPassword) : null;

        const { data, error } = await supabase
            .from('projects')
            .insert([{
                name: nameCheck.value,
                folder_name,
                password: encryptedPassword,
                memo: sanitizedMemo,
                expires_at,
                status: 'active',
                view_count: 0,
                download_count: 0,
                max_downloads: maxDlCheck.value,
            }])
            .select()
            .single();

        if (error) throw error;

        // Audit log
        recordAuditLog({
            action: 'project.create',
            user_id: auth.userId,
            ip_address: getClientIp(req),
            resource_type: 'project',
            resource_id: data?.id,
            details: { name, folder_name },
        });

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("Create project error:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error" },
            { status: 500 }
        );
    }
}
