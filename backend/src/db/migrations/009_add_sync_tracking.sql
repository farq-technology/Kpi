-- Add sync tracking columns to survey_responses
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS sync_pending INTEGER DEFAULT 0;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS last_sync_attempt TIMESTAMPTZ;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Sync audit log table
CREATE TABLE IF NOT EXISTS sync_audit_log (
    id TEXT PRIMARY KEY,
    response_id TEXT REFERENCES survey_responses(id) ON DELETE CASCADE,
    direction TEXT NOT NULL,
    status TEXT NOT NULL,
    fields_changed TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_audit_response_id ON sync_audit_log(response_id);
CREATE INDEX IF NOT EXISTS idx_sync_pending ON survey_responses(sync_pending) WHERE sync_pending = 1;
