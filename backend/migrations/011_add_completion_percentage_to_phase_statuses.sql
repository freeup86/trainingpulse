-- Add completion_percentage field to phase_statuses table
-- This allows each phase status to contribute a specific percentage to overall phase completion

-- Add completion_percentage column
ALTER TABLE phase_statuses 
ADD COLUMN completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100);

-- Update existing phase statuses with default completion percentages
-- These values can be modified through the admin interface
UPDATE phase_statuses SET completion_percentage = 60 WHERE value = 'alpha_review';
UPDATE phase_statuses SET completion_percentage = 30 WHERE value = 'beta_review';
UPDATE phase_statuses SET completion_percentage = 10 WHERE value = 'final';

-- Add comment for documentation
COMMENT ON COLUMN phase_statuses.completion_percentage IS 'Percentage contribution of this status to overall phase completion (0-100)';