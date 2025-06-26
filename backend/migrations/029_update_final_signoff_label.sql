-- Migration: Update Final Signoff label to Final Signoff Received
-- This clarifies the distinction between Final Signoff Sent and Final Signoff Received

UPDATE phase_statuses 
SET label = 'Final Signoff Received',
    description = 'Final signoff has been received',
    updated_at = CURRENT_TIMESTAMP
WHERE value = 'final_signoff';

-- Update comments to reflect the new label
COMMENT ON COLUMN course_subtasks.final_signoff_start_date IS 'Date when Final Signoff Received phase was started';
COMMENT ON COLUMN course_subtasks.final_signoff_end_date IS 'Date when Final Signoff Received phase was completed';