import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/utils/supabase/auth-guard";
import { validateMimeType, validateFileSize, MAX_FILE_SIZE } from "@/utils/file-validation";
import { stripMetadata } from "@/utils/image-sanitize";

export const config = {
    api: {
        bodyParser: false,
    },
};

/**
 * POST /api/admin/upload/sanitize
 * Receives an image file, strips EXIF/metadata, and returns the sanitized file.
 * This runs before the client uploads to Supabase Storage.
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);
        if (!auth.authenticated) return auth.response;

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validate MIME type
        const mimeCheck = validateMimeType(file.type);
        if (!mimeCheck.valid) {
            return NextResponse.json({ error: mimeCheck.error }, { status: 400 });
        }

        // Validate file size
        const sizeCheck = validateFileSize(file.size);
        if (!sizeCheck.valid) {
            return NextResponse.json({ error: sizeCheck.error }, { status: 400 });
        }

        // Strip metadata
        const arrayBuffer = await file.arrayBuffer();
        const sanitizedBuffer = await stripMetadata(arrayBuffer, file.type);

        // Return sanitized image as a blob response
        const outputMime = file.type === 'image/png' ? 'image/png'
            : file.type === 'image/webp' ? 'image/webp'
            : 'image/jpeg';

        return new NextResponse(new Uint8Array(sanitizedBuffer), {
            status: 200,
            headers: {
                'Content-Type': outputMime,
                'Content-Length': String(sanitizedBuffer.length),
            },
        });
    } catch (error: any) {
        console.error("Sanitize error:", error);
        return NextResponse.json(
            { error: "Failed to process image" },
            { status: 500 }
        );
    }
}
