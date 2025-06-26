-- Migration: Fix valid_task_status constraint to include new phase statuses
-- The constraint was missing the new statuses: alpha_draft, beta_revision, final_signoff_sent

-- Drop the old constraint
ALTER TABLE course_subtasks DROP CONSTRAINT IF EXISTS valid_task_status;

-- Add the updated constraint with all new statuses
ALTER TABLE course_subtasks ADD CONSTRAINT valid_task_status 
  CHECK (status IN ('', 'pending', 'in_progress', 'completed', 'on_hold', 'alpha_draft', 'alpha_review', 'beta_revision', 'beta_review', 'final', 'final_signoff_sent', 'final_signoff'));

-- Also drop the duplicate constraint if it exists to avoid confusion
ALTER TABLE course_subtasks DROP CONSTRAINT IF EXISTS course_subtasks_status_check;