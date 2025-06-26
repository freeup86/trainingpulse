-- Migration: Add new phase statuses (Alpha Draft, Beta Revision, Final Signoff Sent)
-- This migration adds new phase statuses and updates completion percentages

-- First, let's add the new phase statuses
INSERT INTO phase_statuses (value, label, description, color, completion_percentage, sort_order, created_at, updated_at)
VALUES 
  ('alpha_draft', 'Alpha Draft', 'Initial draft of the phase', 'text-gray-500', 10, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('beta_revision', 'Beta Revision', 'Revisions based on alpha feedback', 'text-yellow-600', 50, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('final_signoff_sent', 'Final Signoff Sent', 'Final version sent for signoff', 'text-green-600', 90, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (value) DO NOTHING;

-- Update existing phase statuses with new completion percentages and sort orders
UPDATE phase_statuses SET 
  completion_percentage = 30,
  sort_order = 2,
  updated_at = CURRENT_TIMESTAMP
WHERE value = 'alpha_review';

UPDATE phase_statuses SET 
  completion_percentage = 75,
  sort_order = 4,
  updated_at = CURRENT_TIMESTAMP
WHERE value = 'beta_review';

UPDATE phase_statuses SET 
  completion_percentage = 85,
  sort_order = 5,
  label = 'Final (Gold)',
  updated_at = CURRENT_TIMESTAMP
WHERE value = 'final';

UPDATE phase_statuses SET 
  completion_percentage = 100,
  sort_order = 7,
  updated_at = CURRENT_TIMESTAMP
WHERE value = 'final_signoff';

-- Update any other existing statuses to have appropriate sort orders
UPDATE phase_statuses SET sort_order = 99 WHERE value = 'completed' AND sort_order < 99;
UPDATE phase_statuses SET sort_order = 98 WHERE value = 'on_hold' AND sort_order < 98;
UPDATE phase_statuses SET sort_order = 97 WHERE value = 'pending' AND sort_order < 97;
UPDATE phase_statuses SET sort_order = 96 WHERE value = 'in_progress' AND sort_order < 96;

-- Update the task status constraint to include new statuses
ALTER TABLE course_subtasks DROP CONSTRAINT IF EXISTS course_subtasks_status_check;
ALTER TABLE course_subtasks ADD CONSTRAINT course_subtasks_status_check 
  CHECK (status IN ('', 'pending', 'in_progress', 'completed', 'on_hold', 'alpha_draft', 'alpha_review', 'beta_revision', 'beta_review', 'final', 'final_signoff_sent', 'final_signoff'));

-- Add a comment to document the phase progression
COMMENT ON TABLE phase_statuses IS 'Phase statuses with completion percentages: Alpha Draft (10%), Alpha Review (30%), Beta Revision (50%), Beta Review (75%), Final/Gold (85%), Final Signoff Sent (90%), Final Signoff (100%)';