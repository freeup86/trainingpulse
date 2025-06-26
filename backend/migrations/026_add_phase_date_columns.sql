-- Migration: Add date columns for all phase statuses to course_subtasks table
-- This allows tracking completion dates for each phase status individually

-- Add date columns for each phase status
ALTER TABLE course_subtasks 
ADD COLUMN alpha_draft_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN alpha_review_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN beta_revision_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN beta_review_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN final_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN final_signoff_sent_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN final_signoff_date TIMESTAMP WITHOUT TIME ZONE;

-- Add comments to document the purpose of each column
COMMENT ON COLUMN course_subtasks.alpha_draft_date IS 'Date when Alpha Draft phase was completed';
COMMENT ON COLUMN course_subtasks.alpha_review_date IS 'Date when Alpha Review phase was completed';
COMMENT ON COLUMN course_subtasks.beta_revision_date IS 'Date when Beta Revision phase was completed';
COMMENT ON COLUMN course_subtasks.beta_review_date IS 'Date when Beta Review phase was completed';
COMMENT ON COLUMN course_subtasks.final_date IS 'Date when Final (Gold) phase was completed';
COMMENT ON COLUMN course_subtasks.final_signoff_sent_date IS 'Date when Final Signoff was sent';
COMMENT ON COLUMN course_subtasks.final_signoff_date IS 'Date when Final Signoff was received';

-- Create an index for performance on frequently queried date columns
CREATE INDEX idx_course_subtasks_phase_dates ON course_subtasks(final_signoff_date, final_date, beta_review_date);