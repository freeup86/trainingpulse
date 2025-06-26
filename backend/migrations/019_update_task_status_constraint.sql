-- Migration: Update the valid_task_status constraint to include final_signoff
-- This allows the course_subtasks table to accept the new final_signoff status

-- First, drop the existing constraint
ALTER TABLE course_subtasks DROP CONSTRAINT IF EXISTS valid_task_status;

-- Add the updated constraint that includes final_signoff
ALTER TABLE course_subtasks ADD CONSTRAINT valid_task_status 
CHECK (status IN ('', 'pending', 'in_progress', 'completed', 'on_hold', 'alpha_review', 'beta_review', 'final', 'final_signoff'));

-- Also ensure the phase_status_history table can handle the new status
-- Drop any existing constraint on that table
ALTER TABLE phase_status_history DROP CONSTRAINT IF EXISTS valid_phase_status;

-- Add constraint to phase_status_history if needed
ALTER TABLE phase_status_history ADD CONSTRAINT valid_phase_status
CHECK (status IN ('alpha_review', 'beta_review', 'final', 'final_signoff'));