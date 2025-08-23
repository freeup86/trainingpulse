-- Add Folders and Lists to create Program > Folder > List > Course hierarchy
-- Migration 034: Add folders and lists tables

-- Create folders table (within Programs)
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    color VARCHAR(7), -- hex color like #3B82F6
    position INTEGER DEFAULT 0, -- for ordering within program
    is_collapsed BOOLEAN DEFAULT false, -- for UI state
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    CONSTRAINT valid_color_format CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Create lists table (within Folders)
CREATE TABLE lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    color VARCHAR(7), -- hex color like #3B82F6
    position INTEGER DEFAULT 0, -- for ordering within folder
    is_collapsed BOOLEAN DEFAULT false, -- for UI state
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    CONSTRAINT valid_list_color_format CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Add list_id to courses table to link courses to lists instead of directly to programs
ALTER TABLE courses ADD COLUMN list_id UUID REFERENCES lists(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_folders_program_id ON folders(program_id);
CREATE INDEX idx_folders_position ON folders(program_id, position);
CREATE INDEX idx_lists_folder_id ON lists(folder_id);
CREATE INDEX idx_lists_position ON lists(folder_id, position);
CREATE INDEX idx_courses_list_id ON courses(list_id);

-- Add updated_at trigger for folders
CREATE OR REPLACE FUNCTION update_folders_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_folders_updated_at_column();

-- Add updated_at trigger for lists
CREATE OR REPLACE FUNCTION update_lists_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lists_updated_at
    BEFORE UPDATE ON lists
    FOR EACH ROW
    EXECUTE FUNCTION update_lists_updated_at_column();

-- Comment on tables
COMMENT ON TABLE folders IS 'Folders organize content within programs - second level of hierarchy';
COMMENT ON TABLE lists IS 'Lists organize courses within folders - third level of hierarchy';
COMMENT ON COLUMN courses.list_id IS 'Links courses to lists instead of directly to programs';