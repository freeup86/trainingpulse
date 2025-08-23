-- Migration 035: Migrate existing courses to new hierarchy structure
-- This creates default folders and lists for existing programs and moves courses into them

-- For each existing program, create a default folder and list structure
DO $$
DECLARE
    program_record RECORD;
    default_folder_id UUID;
    default_list_id UUID;
BEGIN
    -- Loop through all existing programs
    FOR program_record IN SELECT id, name, owner_id FROM programs
    LOOP
        -- Create a default folder for each program
        INSERT INTO folders (
            name, 
            description, 
            program_id, 
            color, 
            position, 
            created_by, 
            updated_by
        ) VALUES (
            'General', -- Default folder name
            'Default folder for ' || program_record.name,
            program_record.id,
            '#6B7280', -- Gray color for default folder
            0,
            program_record.owner_id,
            program_record.owner_id
        ) RETURNING id INTO default_folder_id;
        
        -- Create a default list within the folder
        INSERT INTO lists (
            name,
            description,
            folder_id,
            color,
            position,
            created_by,
            updated_by
        ) VALUES (
            'Courses', -- Default list name
            'Default list for courses in ' || program_record.name,
            default_folder_id,
            '#3B82F6', -- Blue color for default list
            0,
            program_record.owner_id,
            program_record.owner_id
        ) RETURNING id INTO default_list_id;
        
        -- Move all existing courses from this program to the default list
        UPDATE courses 
        SET 
            list_id = default_list_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE program_id = program_record.id;
        
        -- Log the migration
        RAISE NOTICE 'Migrated program % (%) to new hierarchy with folder % and list %', 
            program_record.name, program_record.id, default_folder_id, default_list_id;
    END LOOP;
END $$;

-- After migration, we could make list_id NOT NULL, but let's keep it nullable for now
-- in case we need to handle edge cases or rollback
-- ALTER TABLE courses ALTER COLUMN list_id SET NOT NULL;

-- Update statistics
ANALYZE folders;
ANALYZE lists;
ANALYZE courses;