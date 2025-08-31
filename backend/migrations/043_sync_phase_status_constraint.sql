-- Migration to sync the valid_task_status constraint with the phase_statuses table

-- First, drop the existing constraint
ALTER TABLE course_subtasks DROP CONSTRAINT IF EXISTS valid_task_status;

-- Create a function to dynamically build the constraint based on phase_statuses table
DO $$
DECLARE
    status_values TEXT;
BEGIN
    -- Get all active status values from phase_statuses table
    SELECT string_agg(DISTINCT quote_literal(value), ', ')
    INTO status_values
    FROM phase_statuses
    WHERE is_active = true;
    
    -- Add the legacy/system statuses that should always be allowed
    status_values := status_values || ', '''', ''pending'', ''in_progress'', ''completed'', ''on_hold''';
    
    -- Create the new constraint with all valid values
    EXECUTE format('ALTER TABLE course_subtasks ADD CONSTRAINT valid_task_status CHECK (status IN (%s))', status_values);
END $$;

-- Also ensure the phase_statuses table has the expected values
-- If any of the expected statuses are missing, insert them
INSERT INTO phase_statuses (value, label, icon, color, dark_color, sort_order, is_active, is_default)
VALUES 
    ('alpha_draft', 'Alpha Draft', 'Edit', 'text-yellow-600', 'dark:text-yellow-400', 10, true, false),
    ('alpha_review', 'Alpha Review', 'AlertTriangle', 'text-orange-600', 'dark:text-orange-400', 20, true, false),
    ('beta_revision', 'Beta Revision', 'Edit', 'text-blue-600', 'dark:text-blue-400', 30, true, false),
    ('beta_review', 'Beta Review', 'AlertTriangle', 'text-indigo-600', 'dark:text-indigo-400', 40, true, false),
    ('final_revision', 'Final Revision', 'Edit', 'text-purple-600', 'dark:text-purple-400', 50, true, false),
    ('final_signoff_sent', 'Final Sign-off Sent', 'Send', 'text-pink-600', 'dark:text-pink-400', 60, true, false),
    ('final_signoff_received', 'Final Sign-off Received', 'CheckCircle', 'text-green-600', 'dark:text-green-400', 70, true, false)
ON CONFLICT (value) DO UPDATE SET
    is_active = EXCLUDED.is_active;

-- Update any subtasks that have invalid status values to empty string
UPDATE course_subtasks
SET status = ''
WHERE status IS NOT NULL 
  AND status NOT IN (
    SELECT value FROM phase_statuses WHERE is_active = true
    UNION ALL
    SELECT unnest(ARRAY['', 'pending', 'in_progress', 'completed', 'on_hold'])
  );

-- Add a comment to document the constraint
COMMENT ON CONSTRAINT valid_task_status ON course_subtasks IS 
'Ensures task status values match active phase_statuses entries plus legacy system statuses';