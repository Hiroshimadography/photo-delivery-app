import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/utils/supabase/auth-guard";
import { decryptPassword, isEncrypted } from "@/utils/crypto";
import { isValidUUID } from "@/utils/input-validation";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

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

        const { data: project, error } = await supabase
            .from('projects')
            .select('password')
            .eq('id', id)
            .single();

        if (error || !project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        if (!project.password) {
            return NextResponse.json({ password: null });
        }

        // Decrypt if encrypted, return as-is if still plain text (pre-migration)
        const plainPassword = isEncrypted(project.password)
            ? decryptPassword(project.password)
            : project.password;

        return NextResponse.json({ password: plainPassword });
    } catch (error: any) {
        console.error("Get password error:", error);
        return NextResponse.json(
            { error: "Failed to retrieve password" },
            { status: 500 }
        );
    }
}
