import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Verify that the request is from an authenticated admin user.
 * Returns the user if authenticated, or a 401 response if not.
 */
export async function requireAdmin(request: NextRequest): Promise<
    { authenticated: true; userId: string } | { authenticated: false; response: NextResponse }
> {
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll() {
                    // API routes don't need to set cookies
                },
            },
        }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        return {
            authenticated: false,
            response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        }
    }

    return { authenticated: true, userId: user.id }
}
