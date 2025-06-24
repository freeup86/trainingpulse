-- Remove hardcoded status constraints to allow dynamic phase statuses
-- This enables the use of database-driven phase statuses configured via admin interface

-- Drop the hardcoded status constraint on course_subtasks
ALTER TABLE course_subtasks DROP CONSTRAINT IF EXISTS valid_task_status;

-- Note: We keep the task_type constraint as it's still used for deliverable types