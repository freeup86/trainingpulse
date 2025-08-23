-- Fix entity_id column types to support both UUIDs and INTEGERs
-- Change entity_id from UUID to TEXT to support both courses (INTEGER) and other entities (UUID)

-- Update activities table
ALTER TABLE activities ALTER COLUMN entity_id TYPE TEXT;

-- Update comments table  
ALTER TABLE comments ALTER COLUMN entity_id TYPE TEXT;

-- Update any other tables that reference entity_id
-- (Add more ALTER statements here if needed for other tables)

-- Recreate indexes with the new data type
DROP INDEX IF EXISTS idx_activities_entity;
CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);

DROP INDEX IF EXISTS idx_comments_entity;
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);