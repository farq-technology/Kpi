-- Fix missing_fields from TEXT[] to TEXT (stores JSON strings from webhook)
ALTER TABLE survey_responses ALTER COLUMN missing_fields TYPE TEXT USING missing_fields::TEXT;

-- Fix is_complete from BOOLEAN to INTEGER for SQLite compatibility
ALTER TABLE survey_responses ALTER COLUMN is_complete TYPE INTEGER USING CASE WHEN is_complete THEN 1 ELSE 0 END;
ALTER TABLE survey_responses ALTER COLUMN is_complete SET DEFAULT 1;
