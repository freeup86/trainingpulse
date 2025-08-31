-- Migration to add a column for tracking when Final Revision ends
-- This is needed to show when revision ended before moving to signoff

ALTER TABLE course_subtasks
ADD COLUMN IF NOT EXISTS final_revision_end_date TIMESTAMP WITHOUT TIME ZONE;

-- Add comment to document the column
COMMENT ON COLUMN course_subtasks.final_revision_end_date IS 'Date when Final Revision ended (when moving to Final Signoff)';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_course_subtasks_final_revision_end ON course_subtasks(final_revision_end_date);