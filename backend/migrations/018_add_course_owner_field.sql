-- Migration: Add owner field to courses table
-- This migration adds a dedicated owner_id field to courses table

-- Add owner_id column to courses table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'courses' AND column_name = 'owner_id') THEN
        ALTER TABLE courses ADD COLUMN owner_id INTEGER REFERENCES users(id);
    END IF;
END $$;

-- Set a default owner for existing courses (using created_by as fallback)
UPDATE courses 
SET owner_id = created_by 
WHERE owner_id IS NULL;

-- Create index for better performance on owner queries if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_courses_owner_id') THEN
        CREATE INDEX idx_courses_owner_id ON courses(owner_id);
    END IF;
END $$;