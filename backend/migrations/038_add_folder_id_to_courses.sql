-- Add folder_id to courses table for direct folder reference
-- This denormalizes the data slightly but makes queries and UI much simpler

-- Add folder_id column to courses
ALTER TABLE courses ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_courses_folder_id ON courses(folder_id);

-- Update existing courses to set folder_id based on their list's folder
UPDATE courses c
SET folder_id = l.folder_id
FROM lists l
WHERE c.list_id = l.id;

-- Comment on the new column
COMMENT ON COLUMN courses.folder_id IS 'Direct reference to folder for easier hierarchy navigation';