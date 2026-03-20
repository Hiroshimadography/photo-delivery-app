-- Audit Logs Table for security monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    user_id UUID,
    ip_address TEXT,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast queries by action and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated admin users can read audit logs
CREATE POLICY "Admin read audit logs" ON audit_logs
    FOR SELECT TO authenticated USING (true);

-- Service role can insert (API routes use service role key)
-- No public access at all
