-- Migration: Add start and end date columns for all phase statuses
-- This provides comprehensive tracking of when each phase begins and ends

-- Add start date columns for each phase status
ALTER TABLE course_subtasks 
ADD COLUMN alpha_draft_start_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN alpha_review_start_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN beta_revision_start_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN beta_review_start_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN final_start_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN final_signoff_sent_start_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN final_signoff_start_date TIMESTAMP WITHOUT TIME ZONE;

-- Add end date columns for each phase status
ALTER TABLE course_subtasks 
ADD COLUMN alpha_draft_end_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN alpha_review_end_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN beta_revision_end_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN beta_review_end_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN final_end_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN final_signoff_sent_end_date TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN final_signoff_end_date TIMESTAMP WITHOUT TIME ZONE;

-- Add comments to document the purpose of each column
COMMENT ON COLUMN course_subtasks.alpha_draft_start_date IS 'Date when Alpha Draft phase was started';
COMMENT ON COLUMN course_subtasks.alpha_draft_end_date IS 'Date when Alpha Draft phase was completed';
COMMENT ON COLUMN course_subtasks.alpha_review_start_date IS 'Date when Alpha Review phase was started';
COMMENT ON COLUMN course_subtasks.alpha_review_end_date IS 'Date when Alpha Review phase was completed';
COMMENT ON COLUMN course_subtasks.beta_revision_start_date IS 'Date when Beta Revision phase was started';
COMMENT ON COLUMN course_subtasks.beta_revision_end_date IS 'Date when Beta Revision phase was completed';
COMMENT ON COLUMN course_subtasks.beta_review_start_date IS 'Date when Beta Review phase was started';
COMMENT ON COLUMN course_subtasks.beta_review_end_date IS 'Date when Beta Review phase was completed';
COMMENT ON COLUMN course_subtasks.final_start_date IS 'Date when Final Revision phase was started';
COMMENT ON COLUMN course_subtasks.final_end_date IS 'Date when Final Revision phase was completed';
COMMENT ON COLUMN course_subtasks.final_signoff_sent_start_date IS 'Date when Final Signoff Sent phase was started';
COMMENT ON COLUMN course_subtasks.final_signoff_sent_end_date IS 'Date when Final Signoff Sent phase was completed';
COMMENT ON COLUMN course_subtasks.final_signoff_start_date IS 'Date when Final Signoff phase was started';
COMMENT ON COLUMN course_subtasks.final_signoff_end_date IS 'Date when Final Signoff phase was completed';

-- Create indexes for performance on frequently queried date columns
CREATE INDEX idx_course_subtasks_phase_start_dates ON course_subtasks(alpha_draft_start_date, alpha_review_start_date, beta_revision_start_date);
CREATE INDEX idx_course_subtasks_phase_end_dates ON course_subtasks(final_signoff_end_date, final_end_date, beta_review_end_date);