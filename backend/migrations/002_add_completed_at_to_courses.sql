-- Add completed_at column to courses table
-- This column tracks when a course was actually completed

ALTER TABLE courses ADD COLUMN completed_at TIMESTAMP;

-- Update the column for existing completed courses to use updated_at as a placeholder
UPDATE courses 
SET completed_at = updated_at 
WHERE status = 'completed' AND completed_at IS NULL;

-- Add a trigger to automatically set completed_at when status changes to 'completed'
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
    -- If status is changing to 'completed' and completed_at is not set
    IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.completed_at IS NULL THEN
        NEW.completed_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- If status is changing from 'completed' to something else, clear completed_at
    IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
        NEW.completed_at = NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS courses_completed_at_trigger ON courses;
CREATE TRIGGER courses_completed_at_trigger
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION set_completed_at();