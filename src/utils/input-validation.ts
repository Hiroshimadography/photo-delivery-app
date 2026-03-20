/**
 * Input validation utilities for API routes.
 * Prevents injection attacks, path traversal, and invalid data.
 */

/** Validate UUID v4 format */
export function isValidUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

/** Validate project name (no control characters, reasonable length) */
export function sanitizeProjectName(name: string): { valid: boolean; value: string; error?: string } {
    if (!name || typeof name !== 'string') {
        return { valid: false, value: '', error: 'Project name is required' }
    }

    // Remove control characters
    const sanitized = name.replace(/[\x00-\x1F\x7F]/g, '').trim()

    if (sanitized.length === 0) {
        return { valid: false, value: '', error: 'Project name cannot be empty' }
    }

    if (sanitized.length > 200) {
        return { valid: false, value: '', error: 'Project name too long (max 200 characters)' }
    }

    return { valid: true, value: sanitized }
}

/** Validate memo field */
export function sanitizeMemo(memo: string | null | undefined): string | null {
    if (!memo || typeof memo !== 'string') return null
    // Remove control characters except newlines and tabs
    return memo.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, 2000) || null
}

/** Validate password (reasonable length, no control characters) */
export function sanitizePassword(password: string | null | undefined): string | null {
    if (!password || typeof password !== 'string') return null
    const sanitized = password.replace(/[\x00-\x1F\x7F]/g, '').trim()
    if (sanitized.length === 0) return null
    if (sanitized.length > 128) return null // Reject excessively long passwords
    return sanitized
}

/** Validate positive integer */
export function validatePositiveInt(value: unknown, max: number = 10000): { valid: boolean; value: number; error?: string } {
    const num = typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : NaN
    if (isNaN(num) || num < 1 || num > max || !Number.isInteger(num)) {
        return { valid: false, value: 0, error: `Must be an integer between 1 and ${max}` }
    }
    return { valid: true, value: num }
}

/** Validate ISO date string */
export function isValidISODate(value: string): boolean {
    if (typeof value !== 'string') return false
    const date = new Date(value)
    return !isNaN(date.getTime()) && date.toISOString() === value
}

/** Validate folder_name parameter (UUID format in URL) */
export function validateFolderName(id: string): { valid: boolean; error?: string } {
    if (!id || typeof id !== 'string') {
        return { valid: false, error: 'Invalid project identifier' }
    }
    if (!isValidUUID(id)) {
        return { valid: false, error: 'Invalid project identifier format' }
    }
    return { valid: true }
}
