-- Add course_code field to courses table for human-readable course identifier
-- Format: C-000001, C-000002, etc.

-- Add course_code column to courses table
ALTER TABLE courses 
ADD COLUMN course_code VARCHAR(20) UNIQUE;

-- Add index for faster lookups by course_code
CREATE INDEX idx_courses_course_code ON courses(course_code);

-- Create a sequence for generating course codes
CREATE SEQUENCE IF NOT EXISTS course_code_seq START WITH 1;

-- Create a function to generate the next course code
CREATE OR REPLACE FUNCTION generate_course_code()
RETURNS VARCHAR AS $$
DECLARE
    next_val INTEGER;
    new_code VARCHAR(20);
BEGIN
    -- Get the next sequence value
    next_val := nextval('course_code_seq');
    -- Format as C-000001, C-000002, etc.
    new_code := 'C-' || LPAD(next_val::TEXT, 6, '0');
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to auto-assign course_code on insert
CREATE OR REPLACE FUNCTION assign_course_code()
RETURNS TRIGGER AS $$
BEGIN
    -- Only assign if course_code is not provided
    IF NEW.course_code IS NULL THEN
        NEW.course_code := generate_course_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trg_assign_course_code
    BEFORE INSERT ON courses
    FOR EACH ROW
    EXECUTE FUNCTION assign_course_code();

-- Backfill existing courses with course codes
-- First, get the max ID to set the sequence appropriately
DO $$
DECLARE
    max_id INTEGER;
BEGIN
    -- Get the maximum course ID
    SELECT COALESCE(MAX(id), 0) INTO max_id FROM courses;
    
    -- Reset sequence to start from 1
    PERFORM setval('course_code_seq', 1, false);
    
    -- Update existing courses with course codes based on their ID
    UPDATE courses 
    SET course_code = 'C-' || LPAD(id::TEXT, 6, '0')
    WHERE course_code IS NULL;
    
    -- Set the sequence to continue from the highest existing ID
    IF max_id > 0 THEN
        PERFORM setval('course_code_seq', max_id, true);
    END IF;
END $$;

-- Add a comment to describe the column
COMMENT ON COLUMN courses.course_code IS 'Human-readable course identifier (auto-generated: C-000001, C-000002, etc.)';