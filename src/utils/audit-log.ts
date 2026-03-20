import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { autoRefreshToken: false, persistSession: false } }
)

export type AuditAction =
    | 'project.create'
    | 'project.delete'
    | 'photo.upload'
    | 'photo.delete'
    | 'photo.delete_all'
    | 'settings.update'
    | 'password.failed'
    | 'password.success'
    | 'download.request'
    | 'download.limit_reached'
    | 'cron.purge'

type AuditLogEntry = {
    action: AuditAction
    user_id?: string | null
    ip_address?: string
    resource_type?: string
    resource_id?: string
    details?: Record<string, unknown>
}

/**
 * Record an audit log entry.
 * Non-blocking — errors are logged but don't interrupt the caller.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
        await supabaseAdmin.from('audit_logs').insert([{
            action: entry.action,
            user_id: entry.user_id || null,
            ip_address: entry.ip_address || null,
            resource_type: entry.resource_type || null,
            resource_id: entry.resource_id || null,
            details: entry.details || null,
        }])
    } catch (error) {
        // Audit logging should never break the main flow
        console.error('Audit log failed:', error)
    }
}
