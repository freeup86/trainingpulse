-- Migration: Rename phase date columns to match new phase status names
-- final_* -> final_revision_*
-- final_signoff_* -> final_signoff_received_*

BEGIN;

-- Rename final_* columns to final_revision_*
ALTER TABLE course_subtasks 
RENAME COLUMN final_start_date TO final_revision_start_date;

ALTER TABLE course_subtasks 
RENAME COLUMN final_end_date TO final_revision_end_date;

ALTER TABLE course_subtasks 
RENAME COLUMN final_date TO final_revision_date;

-- Rename final_signoff_* columns to final_signoff_received_*
ALTER TABLE course_subtasks 
RENAME COLUMN final_signoff_start_date TO final_signoff_received_start_date;

ALTER TABLE course_subtasks 
RENAME COLUMN final_signoff_date TO final_signoff_received_date;

COMMIT;