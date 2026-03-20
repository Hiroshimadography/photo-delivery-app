import { NextRequest, NextResponse } from 'next/server'

/**
 * CSRF protection via Origin header validation.
 *
 * For API-based apps using JSON, Origin/Referer header validation is the
 * recommended approach (OWASP). Browsers always send Origin on cross-origin
 * requests, so a mismatch indicates a CSRF attack.
 *
 * Returns null if the request is safe, or a 403 response if CSRF is detected.
 */
export function checkCsrf(request: NextRequest): NextResponse | null {
    const method = request.method.toUpperCase()

    // Only check state-changing methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        return null
    }

    // Allow Vercel cron jobs (they use bearer tokens, not browser requests)
    if (request.nextUrl.pathname.startsWith('/api/cron')) {
        return null
    }

    const origin = request.headers.get('origin')
    const host = request.headers.get('host')

    // If no Origin header, check Referer as fallback
    if (!origin) {
        const referer = request.headers.get('referer')
        if (referer) {
            try {
                const refererUrl = new URL(referer)
                if (refererUrl.host === host) {
                    return null // Same origin via Referer
                }
            } catch {
                // Invalid referer URL — block
            }
        }

        // No Origin and no valid same-origin Referer
        // Allow requests without Origin only if they have the correct Content-Type
        // (browsers won't send JSON content-type from a cross-origin form)
        const contentType = request.headers.get('content-type') || ''
        if (contentType.includes('application/json') || contentType.includes('multipart/form-data')) {
            return null
        }

        return NextResponse.json(
            { error: 'CSRF validation failed: missing origin' },
            { status: 403 }
        )
    }

    // Validate Origin matches Host
    try {
        const originUrl = new URL(origin)
        if (originUrl.host === host) {
            return null // Same origin — safe
        }
    } catch {
        // Invalid origin URL
    }

    return NextResponse.json(
        { error: 'CSRF validation failed: origin mismatch' },
        { status: 403 }
    )
}
