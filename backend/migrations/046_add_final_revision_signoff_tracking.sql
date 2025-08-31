-- Migration to add separate tracking for Final Revision and Final Signoff dates
-- This allows us to track both dates independently in the Final Start/End column

-- Add column for tracking when Final Revision was last entered
ALTER TABLE course_subtasks
ADD COLUMN IF NOT EXISTS final_revision_entered_date TIMESTAMP WITHOUT TIME ZONE;

-- Add column for tracking when Final Signoff was last entered  
ALTER TABLE course_subtasks
ADD COLUMN IF NOT EXISTS final_signoff_entered_date TIMESTAMP WITHOUT TIME ZONE;

-- Add comments to document the columns
COMMENT ON COLUMN course_subtasks.final_revision_entered_date IS 'Date when Final Revision status was last entered';
COMMENT ON COLUMN course_subtasks.final_signoff_entered_date IS 'Date when Final Signoff status was last entered';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_course_subtasks_final_revision_signoff_dates 
ON course_subtasks(final_revision_entered_date, final_signoff_entered_date);