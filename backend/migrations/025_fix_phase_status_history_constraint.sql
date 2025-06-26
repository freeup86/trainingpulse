-- Migration: Fix valid_phase_status constraint on phase_status_history table
-- The constraint was missing the new statuses: alpha_draft, beta_revision, final_signoff_sent

-- Drop the old constraint
ALTER TABLE phase_status_history DROP CONSTRAINT IF EXISTS valid_phase_status;

-- Add the updated constraint with all new statuses
ALTER TABLE phase_status_history ADD CONSTRAINT valid_phase_status 
  CHECK (status IN ('alpha_draft', 'alpha_review', 'beta_revision', 'beta_review', 'final', 'final_signoff_sent', 'final_signoff'));

-- Note: We don't include empty string, pending, in_progress, completed, on_hold in phase_status_history
-- because those are general task statuses, not specific phase progression statuses