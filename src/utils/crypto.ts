import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get the encryption key from environment variable.
 * Must be a 64-character hex string (32 bytes).
 */
function getEncryptionKey(): Buffer {
    const key = process.env.PASSWORD_ENCRYPTION_KEY
    if (!key || key.length !== 64) {
        throw new Error(
            'PASSWORD_ENCRYPTION_KEY must be set as a 64-character hex string. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        )
    }
    return Buffer.from(key, 'hex')
}

/**
 * Encrypt a plain-text password using AES-256-GCM.
 * Returns a string in the format: iv:authTag:ciphertext (all hex-encoded)
 */
export function encryptPassword(plainPassword: string): string {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plainPassword, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt an encrypted password back to plain text.
 * Expects the format: iv:authTag:ciphertext (all hex-encoded)
 */
export function decryptPassword(encryptedPassword: string): string {
    const key = getEncryptionKey()
    const parts = encryptedPassword.split(':')

    if (parts.length !== 3) {
        throw new Error('Invalid encrypted password format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}

/**
 * Verify a password against an encrypted password using constant-time comparison.
 * Prevents timing attacks.
 */
export function verifyPassword(inputPassword: string, encryptedPassword: string): boolean {
    try {
        const decrypted = decryptPassword(encryptedPassword)

        // Use constant-time comparison to prevent timing attacks
        const inputBuf = Buffer.from(inputPassword, 'utf8')
        const storedBuf = Buffer.from(decrypted, 'utf8')

        if (inputBuf.length !== storedBuf.length) {
            // Still perform a comparison to maintain constant-ish timing
            timingSafeEqual(inputBuf, inputBuf)
            return false
        }

        return timingSafeEqual(inputBuf, storedBuf)
    } catch {
        return false
    }
}

/**
 * Check if a password string is already encrypted (vs plain text).
 * Encrypted passwords have the format: hex(32):hex(32):hex(n)
 */
export function isEncrypted(password: string): boolean {
    const parts = password.split(':')
    if (parts.length !== 3) return false
    // IV is 16 bytes = 32 hex chars, authTag is 16 bytes = 32 hex chars
    return parts[0].length === 32 && parts[1].length === 32 && /^[0-9a-f]+$/.test(parts[0] + parts[1] + parts[2])
}
