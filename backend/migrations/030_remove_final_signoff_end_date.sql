-- Migration: Remove final_signoff_end_date column as Final Signoff Received is a single point in time
-- Final Signoff Received represents when signoff is received, not a duration

-- Remove the unnecessary end date column
ALTER TABLE course_subtasks 
DROP COLUMN IF EXISTS final_signoff_end_date;

-- Update the comment for the start date to clarify it's the received date
COMMENT ON COLUMN course_subtasks.final_signoff_start_date IS 'Date when Final Signoff was received (single point in time, not a duration)';