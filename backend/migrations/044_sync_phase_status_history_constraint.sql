-- Migration to sync the valid_phase_status constraint in phase_status_history with the phase_statuses table

-- First, drop the existing constraint
ALTER TABLE phase_status_history DROP CONSTRAINT IF EXISTS valid_phase_status;

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
    EXECUTE format('ALTER TABLE phase_status_history ADD CONSTRAINT valid_phase_status CHECK (status IN (%s))', status_values);
END $$;

-- Add a comment to document the constraint
COMMENT ON CONSTRAINT valid_phase_status ON phase_status_history IS 
'Ensures phase status values match active phase_statuses entries plus legacy system statuses';