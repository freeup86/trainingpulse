-- Migration: Rename phase status values
-- final -> final_revision
-- final_signoff -> final_signoff_received

BEGIN;

-- Drop constraints temporarily
ALTER TABLE course_subtasks DROP CONSTRAINT IF EXISTS valid_task_status;
ALTER TABLE phase_status_history DROP CONSTRAINT IF EXISTS valid_phase_status_history_status;
ALTER TABLE phase_status_history DROP CONSTRAINT IF EXISTS valid_phase_status;

-- Update phase_statuses table
UPDATE phase_statuses 
SET value = 'final_revision' 
WHERE value = 'final';

UPDATE phase_statuses 
SET value = 'final_signoff_received' 
WHERE value = 'final_signoff';

-- Update course_subtasks table
UPDATE course_subtasks 
SET status = 'final_revision' 
WHERE status = 'final';

UPDATE course_subtasks 
SET status = 'final_signoff_received' 
WHERE status = 'final_signoff';

-- Update phase_status_history table
UPDATE phase_status_history 
SET status = 'final_revision' 
WHERE status = 'final';

UPDATE phase_status_history 
SET status = 'final_signoff_received' 
WHERE status = 'final_signoff';

-- Update course_phase_archives table (if any archived data exists)
UPDATE course_phase_archives 
SET phase_status = 'final_revision' 
WHERE phase_status = 'final';

UPDATE course_phase_archives 
SET phase_status = 'final_signoff_received' 
WHERE phase_status = 'final_signoff';

-- Update JSON phase_history field in course_phase_archives
UPDATE course_phase_archives 
SET phase_history = replace(replace(phase_history::text, '"final"', '"final_revision"'), '"final_signoff"', '"final_signoff_received"')::json
WHERE phase_history::text LIKE '%"final"%' OR phase_history::text LIKE '%"final_signoff"%';

-- Recreate constraints with new values
ALTER TABLE course_subtasks ADD CONSTRAINT valid_task_status 
CHECK (status IN ('', 'alpha_draft', 'alpha_review', 'beta_revision', 'beta_review', 'final_revision', 'final_signoff_sent', 'final_signoff_received', 'completed', 'in_progress', 'pending'));

ALTER TABLE phase_status_history ADD CONSTRAINT valid_phase_status 
CHECK (status IN ('alpha_draft', 'alpha_review', 'beta_revision', 'beta_review', 'final_revision', 'final_signoff_sent', 'final_signoff_received'));

COMMIT;