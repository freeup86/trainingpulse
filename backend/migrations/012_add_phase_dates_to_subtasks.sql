-- Add start and finish dates to course_subtasks for phase tracking
-- These will be automatically set when phases are started and completed

-- Add start_date column (when phase status changes from pending to active)
ALTER TABLE course_subtasks 
ADD COLUMN start_date TIMESTAMP NULL;

-- Add finish_date column (when phase status changes to a completion status)
ALTER TABLE course_subtasks 
ADD COLUMN finish_date TIMESTAMP NULL;

-- Add comments for documentation
COMMENT ON COLUMN course_subtasks.start_date IS 'Timestamp when phase was started (status changed from pending)';
COMMENT ON COLUMN course_subtasks.finish_date IS 'Timestamp when phase was completed (status changed to completion state)';