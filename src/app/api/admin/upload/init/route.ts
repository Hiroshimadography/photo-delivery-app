import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
    try {
        const { storagePath } = await req.json();
        
        if (!storagePath) {
            return NextResponse.json({ error: "Missing storagePath" }, { status: 400 });
        }

        const { data, error } = await supabase.storage
            .from('photos')
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
