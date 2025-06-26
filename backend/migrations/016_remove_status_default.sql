-- Remove default value from status column to allow empty status for new phases
-- This ensures that the application can control the initial status

ALTER TABLE course_subtasks 
ALTER COLUMN status DROP DEFAULT;