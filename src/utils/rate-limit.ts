/**
 * In-memory rate limiter using sliding window.
 * For production with multiple instances, replace with Redis-based solution.
 */

type RateLimitEntry = {
    timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every 5 minutes to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
    const now = Date.now()
    if (now - lastCleanup < CLEANUP_INTERVAL) return
    lastCleanup = now

    const cutoff = now - windowMs
    for (const [key, entry] of store.entries()) {
        entry.timestamps = entry.timestamps.filter(t => t > cutoff)
        if (entry.timestamps.length === 0) {
            store.delete(key)
        }
    }
}

type RateLimitConfig = {
    /** Maximum number of requests allowed in the window */
    maxRequests: number
    /** Time window in milliseconds */
    windowMs: number
}

type RateLimitResult = {
    allowed: boolean
    remaining: number
    retryAfterMs?: number
}

/**
 * Check if a request is within the rate limit.
 * @param key - Unique identifier (e.g., IP address or IP + route)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now()
    const cutoff = now - config.windowMs

    cleanup(config.windowMs)

    let entry = store.get(key)
    if (!entry) {
        entry = { timestamps: [] }
        store.set(key, entry)
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(t => t > cutoff)

    if (entry.timestamps.length >= config.maxRequests) {
        // Find when the oldest request in the window will expire
        const oldestInWindow = entry.timestamps[0]
        const retryAfterMs = oldestInWindow + config.windowMs - now

        return {
            allowed: false,
            remaining: 0,
            retryAfterMs,
        }
    }

    entry.timestamps.push(now)

    return {
        allowed: true,
        remaining: config.maxRequests - entry.timestamps.length,
    }
}

/**
 * Extract client IP from request headers.
 * Handles x-forwarded-for (Vercel/proxy) and falls back to 'unknown'.
 */
export function getClientIp(request: Request): string {
    // Vercel sets x-real-ip
    const realIp = request.headers.get('x-real-ip')
    if (realIp) return realIp

    // Standard proxy header - use first IP only (client IP)
    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
        const firstIp = forwarded.split(',')[0]?.trim()
        if (firstIp) return firstIp
    }

    return 'unknown'
}

// Pre-configured rate limiters for different routes
export const RATE_LIMITS = {
    /** Password attempts: 5 per 15 minutes */
    PASSWORD: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
    /** Upload operations: 30 per minute */
    UPLOAD: { maxRequests: 30, windowMs: 60 * 1000 },
    /** Download tracking: 20 per minute */
    DOWNLOAD: { maxRequests: 20, windowMs: 60 * 1000 },
    /** General API: 100 per minute */
    GENERAL: { maxRequests: 100, windowMs: 60 * 1000 },
} as const
