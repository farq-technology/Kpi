-- Add review tracking columns to survey_responses
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending';
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS reviewed_at TEXT;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS review_notes TEXT;
