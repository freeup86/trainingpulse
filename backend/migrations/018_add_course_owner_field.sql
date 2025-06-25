-- Migration: Add owner field to courses table
-- This migration adds a dedicated owner_id field to courses table

-- Add owner_id column to courses table
ALTER TABLE courses 
ADD COLUMN owner_id INTEGER REFERENCES users(id);

-- Set a default owner for existing courses (using created_by as fallback)
UPDATE courses 
SET owner_id = created_by 
WHERE owner_id IS NULL;

-- Create index for better performance on owner queries
CREATE INDEX idx_courses_owner_id ON courses(owner_id);