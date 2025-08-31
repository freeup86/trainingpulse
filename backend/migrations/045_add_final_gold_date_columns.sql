-- Migration to add Final (Gold) phase tracking columns
-- These columns track when the Final phase is truly complete (after sign-off)

-- Add columns for Final (Gold) phase completion
ALTER TABLE course_subtasks
ADD COLUMN IF NOT EXISTS final_start_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS final_end_date TIMESTAMP WITHOUT TIME ZONE;

-- Add comments to document the columns
COMMENT ON COLUMN course_subtasks.final_start_date IS 'Date when Final (Gold) phase was started (typically when entering final_revision)';
COMMENT ON COLUMN course_subtasks.final_end_date IS 'Date when Final (Gold) phase was completed (when final_signoff_received is set)';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_course_subtasks_final_dates ON course_subtasks(final_start_date, final_end_date);