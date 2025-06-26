-- Migration: Update Final Signoff Sent color to differentiate from Final Signoff Received
-- Change final_signoff_sent color from green to blue to avoid confusion

UPDATE phase_statuses 
SET 
  color = 'text-blue-600',
  updated_at = CURRENT_TIMESTAMP
WHERE value = 'final_signoff_sent';

-- Add comment to document the color scheme
COMMENT ON TABLE phase_statuses IS 'Phase status colors: Sent items use blue (text-blue-600), Received/Completed items use green (text-green-600)';