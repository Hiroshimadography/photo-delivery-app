import sharp from 'sharp'

/**
 * Strip EXIF/metadata from an image while preserving quality.
 * Removes GPS coordinates, camera info, timestamps, etc.
 *
 * Returns a Buffer of the sanitized image.
 */
export async function stripMetadata(input: Buffer | ArrayBuffer, mimeType: string): Promise<Buffer> {
    const buffer = input instanceof Buffer ? input : Buffer.from(new Uint8Array(input))

    // Determine output format from MIME type
    let pipeline = sharp(buffer, { failOn: 'none' })
        .rotate() // Auto-rotate based on EXIF orientation before stripping

    // Strip all metadata
    pipeline = pipeline.withMetadata({
        // Keep only the color profile for accurate rendering
        // All other metadata (EXIF, GPS, IPTC, XMP) is removed
    })

    // Re-encode in the same format without metadata
    switch (mimeType) {
        case 'image/png':
            return pipeline.png().toBuffer()
        case 'image/webp':
            return pipeline.webp({ quality: 90 }).toBuffer()
        default:
            // JPEG is the default (also handles HEIC/HEIF converted to JPEG)
            return pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer()
    }
}
