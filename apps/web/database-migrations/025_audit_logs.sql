-- Migration: Audit Logs Table
-- Description: Creates the audit_logs table for security event logging
--              Required for 2FA, admin actions, and security monitoring.

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category TEXT NOT NULL, -- auth, api_key, session, security, admin, payment
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info', -- debug, info, warning, error, critical
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs (category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs (severity) WHERE severity IN ('warning', 'error', 'critical');

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy: Only admins can read audit logs
CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- RLS policy: Service role can insert (for server-side logging)
-- Note: Service role bypasses RLS, so this is just for documentation
COMMENT ON TABLE public.audit_logs IS 'Security audit log for tracking authentication, API key usage, and administrative actions';
