-- Migration: Fix constraint to match actual phase_statuses values
-- The constraint had 'final' and 'final_signoff' but the phase_statuses table has 'final_revision' and 'final_signoff_received'

-- First, update the phase_statuses table to match our intended values
UPDATE phase_statuses SET value = 'final' WHERE value = 'final_revision';
UPDATE phase_statuses SET value = 'final_signoff', label = 'Final Signoff' WHERE value = 'final_signoff_received';

-- Update the constraint to match
ALTER TABLE course_subtasks DROP CONSTRAINT IF EXISTS valid_task_status;
ALTER TABLE course_subtasks ADD CONSTRAINT valid_task_status 
  CHECK (status IN ('', 'pending', 'in_progress', 'completed', 'on_hold', 'alpha_draft', 'alpha_review', 'beta_revision', 'beta_review', 'final', 'final_signoff_sent', 'final_signoff'));

-- Also update the phase_status_history constraint
ALTER TABLE phase_status_history DROP CONSTRAINT IF EXISTS valid_phase_status;
ALTER TABLE phase_status_history ADD CONSTRAINT valid_phase_status 
  CHECK (status IN ('alpha_draft', 'alpha_review', 'beta_revision', 'beta_review', 'final', 'final_signoff_sent', 'final_signoff'));

-- Update any existing data that might have the old values
UPDATE course_subtasks SET status = 'final' WHERE status = 'final_revision';
UPDATE course_subtasks SET status = 'final_signoff' WHERE status = 'final_signoff_received';
UPDATE phase_status_history SET status = 'final' WHERE status = 'final_revision';
UPDATE phase_status_history SET status = 'final_signoff' WHERE status = 'final_signoff_received';