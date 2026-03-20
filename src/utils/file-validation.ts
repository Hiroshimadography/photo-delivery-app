/**
 * File upload validation utilities.
 * Validates MIME types, magic bytes, file size, and storage paths.
 */

// Maximum file size: 50MB
export const MAX_FILE_SIZE = 50 * 1024 * 1024

// Allowed MIME types for photo uploads
export const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
] as const

// Allowed file extensions
export const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif',
] as const

// Magic byte signatures for image formats
const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }[]> = {
    'image/jpeg': [
        { offset: 0, bytes: [0xFF, 0xD8, 0xFF] },
    ],
    'image/png': [
        { offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
    ],
    'image/webp': [
        // RIFF....WEBP
        { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
    ],
    'image/heic': [
        // ftyp at offset 4
        { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
    ],
    'image/heif': [
        { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
    ],
}

/**
 * Validate file extension from a storage path.
 */
export function validateFileExtension(storagePath: string): { valid: boolean; error?: string } {
    const ext = storagePath.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext as any)) {
        return {
            valid: false,
            error: `Invalid file extension: .${ext || 'unknown'}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        }
    }
    return { valid: true }
}

/**
 * Validate MIME type of a file.
 */
export function validateMimeType(mimeType: string): { valid: boolean; error?: string } {
    if (!ALLOWED_MIME_TYPES.includes(mimeType as any)) {
        return {
            valid: false,
            error: `Invalid MIME type: ${mimeType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        }
    }
    return { valid: true }
}

/**
 * Validate file size.
 */
export function validateFileSize(size: number): { valid: boolean; error?: string } {
    if (size > MAX_FILE_SIZE) {
        const maxMB = MAX_FILE_SIZE / (1024 * 1024)
        const fileMB = (size / (1024 * 1024)).toFixed(1)
        return {
            valid: false,
            error: `File size ${fileMB}MB exceeds maximum ${maxMB}MB`,
        }
    }
    return { valid: true }
}

/**
 * Validate magic bytes of a file buffer to prevent MIME type spoofing.
 * Returns true if the file's magic bytes match any known image format.
 */
export function validateMagicBytes(buffer: ArrayBuffer): { valid: boolean; detectedType?: string; error?: string } {
    const bytes = new Uint8Array(buffer)

    for (const [mimeType, signatures] of Object.entries(MAGIC_BYTES)) {
        for (const sig of signatures) {
            if (bytes.length < sig.offset + sig.bytes.length) continue

            const matches = sig.bytes.every(
                (byte, i) => bytes[sig.offset + i] === byte
            )

            if (matches) {
                return { valid: true, detectedType: mimeType }
            }
        }
    }

    return {
        valid: false,
        error: 'File does not match any allowed image format (magic bytes validation failed)',
    }
}

/**
 * Validate the bucket parameter to prevent bucket traversal.
 */
export function validateBucket(bucket: string): { valid: boolean; error?: string } {
    const allowedBuckets = ['photos']
    if (!allowedBuckets.includes(bucket)) {
        return {
            valid: false,
            error: `Invalid bucket: ${bucket}. Allowed: ${allowedBuckets.join(', ')}`,
        }
    }
    return { valid: true }
}

/**
 * Validate storage path to prevent path traversal attacks.
 */
export function validateStoragePath(storagePath: string): { valid: boolean; error?: string } {
    // Block path traversal
    if (storagePath.includes('..') || storagePath.includes('//')) {
        return { valid: false, error: 'Invalid storage path: path traversal detected' }
    }

    // Must match pattern: {uuid}/{filename}.{ext}
    const pathPattern = /^[a-f0-9-]+\/(thumb_)?[a-z0-9-]+\.[a-z]+$/i
    if (!pathPattern.test(storagePath)) {
        return { valid: false, error: 'Invalid storage path format' }
    }

    return { valid: true }
}

/**
 * Run all validations on a file upload.
 */
export async function validateUploadFile(file: File): Promise<{ valid: boolean; error?: string }> {
    // 1. MIME type check
    const mimeResult = validateMimeType(file.type)
    if (!mimeResult.valid) return mimeResult

    // 2. File size check
    const sizeResult = validateFileSize(file.size)
    if (!sizeResult.valid) return sizeResult

    // 3. Magic bytes check (read first 16 bytes)
    const headerSlice = file.slice(0, 16)
    const buffer = await headerSlice.arrayBuffer()
    const magicResult = validateMagicBytes(buffer)
    if (!magicResult.valid) return magicResult

    return { valid: true }
}
