-- Migration: Update the valid_task_status constraint to include final_signoff
-- This allows the course_subtasks table to accept the new final_signoff status

-- First, update any invalid status values to a valid one
UPDATE course_subtasks 
SET status = 'pending' 
WHERE status IS NOT NULL 
  AND status NOT IN ('', 'pending', 'in_progress', 'completed', 'on_hold', 'alpha_review', 'beta_review', 'final', 'final_signoff');

-- Drop the existing constraint
ALTER TABLE course_subtasks DROP CONSTRAINT IF EXISTS valid_task_status;

-- Add the updated constraint that includes final_signoff
ALTER TABLE course_subtasks ADD CONSTRAINT valid_task_status 
CHECK (status IN ('', 'pending', 'in_progress', 'completed', 'on_hold', 'alpha_review', 'beta_review', 'final', 'final_signoff'));

-- Update any invalid phase_status_history values
UPDATE phase_status_history
SET status = 'alpha_review'
WHERE status IS NOT NULL
  AND status NOT IN ('alpha_review', 'beta_review', 'final', 'final_signoff');

-- Drop any existing constraint on phase_status_history table
ALTER TABLE phase_status_history DROP CONSTRAINT IF EXISTS valid_phase_status;

-- Add constraint to phase_status_history if needed
ALTER TABLE phase_status_history ADD CONSTRAINT valid_phase_status
CHECK (status IN ('alpha_review', 'beta_review', 'final', 'final_signoff'));