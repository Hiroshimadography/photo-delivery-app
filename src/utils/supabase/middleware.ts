import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkCsrf } from '@/utils/csrf'

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

    // CSRF protection for all state-changing API requests
    if (request.nextUrl.pathname.startsWith('/api/')) {
        const csrfResponse = checkCsrf(request)
        if (csrfResponse) {
            setSecurityHeaders(csrfResponse, supabaseUrl)
            return csrfResponse
        }
    }

    // Protect /api/admin/* routes — return 401 JSON instead of redirect
    if (
        !user &&
        request.nextUrl.pathname.startsWith('/api/admin')
    ) {
        const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        setSecurityHeaders(res, supabaseUrl)
        return res
    }

    if (
        !user &&
        request.nextUrl.pathname.startsWith('/admin') &&
        !request.nextUrl.pathname.startsWith('/admin/login')
    ) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin/login'
        const res = NextResponse.redirect(url)
        setSecurityHeaders(res, supabaseUrl)
        return res
    }

    // Allow logged-in users to access /admin. Let them redirect away from /admin/login if already logged in.
    if (user && request.nextUrl.pathname.startsWith('/admin/login')) {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        const res = NextResponse.redirect(url)
        setSecurityHeaders(res, supabaseUrl)
        return res
    }

    // Apply security headers to all responses
    setSecurityHeaders(supabaseResponse, supabaseUrl)

    return supabaseResponse
}

/**
 * Apply security headers to a response.
 */
function setSecurityHeaders(response: NextResponse, supabaseUrl: string) {
    // Prevent clickjacking — disallow embedding in iframes
    response.headers.set('X-Frame-Options', 'DENY')

    // Prevent MIME type sniffing — browser must trust declared Content-Type
    response.headers.set('X-Content-Type-Options', 'nosniff')

    // Force HTTPS for 1 year, including subdomains
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    // Control referrer info sent to other origins
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Disable unnecessary browser features
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')

    // Prevent reflected XSS (legacy header, still useful for older browsers)
    response.headers.set('X-XSS-Protection', '1; mode=block')

    // Content Security Policy
    const csp = [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' ${supabaseUrl} blob: data:`,
        `font-src 'self' data:`,
        `connect-src 'self' ${supabaseUrl} https://*.supabase.co`,
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; ')

    response.headers.set('Content-Security-Policy', csp)
}
