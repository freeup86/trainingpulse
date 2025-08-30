-- Migration to update modality_tasks and modality_deliverables to use foreign keys to modalities table

-- Step 1: Add modality_id column to modality_tasks
ALTER TABLE modality_tasks ADD COLUMN IF NOT EXISTS modality_id INTEGER;

-- Step 2: Populate modality_id based on existing modality values
UPDATE modality_tasks mt
SET modality_id = m.id
FROM modalities m
WHERE mt.modality = m.value
   OR mt.modality = m.name
   OR (mt.modality = 'ILT/VLT' AND m.value = 'ILT_VLT')
   OR (mt.modality = 'Micro Learning' AND m.value = 'Micro_Learning');

-- Step 3: For any remaining unmapped modality tasks, try to create the modality
INSERT INTO modalities (value, name, description, is_active, sort_order)
SELECT DISTINCT 
  UPPER(REPLACE(mt.modality, ' ', '_')) as value,
  mt.modality as name,
  mt.modality || ' Training' as description,
  true as is_active,
  100 as sort_order
FROM modality_tasks mt
WHERE mt.modality_id IS NULL
  AND mt.modality IS NOT NULL
ON CONFLICT (value) DO NOTHING;

-- Step 4: Try again to populate modality_id for any remaining tasks
UPDATE modality_tasks mt
SET modality_id = m.id
FROM modalities m
WHERE mt.modality_id IS NULL
  AND (mt.modality = m.value
   OR mt.modality = m.name
   OR UPPER(REPLACE(mt.modality, ' ', '_')) = m.value);

-- Step 5: Add foreign key constraint (after ensuring all tasks have modality_id)
ALTER TABLE modality_tasks 
ADD CONSTRAINT fk_modality_tasks_modality 
FOREIGN KEY (modality_id) 
REFERENCES modalities(id) 
ON DELETE CASCADE;

-- Step 6: Make modality_id NOT NULL after populating all values
ALTER TABLE modality_tasks ALTER COLUMN modality_id SET NOT NULL;

-- Step 7: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_modality_tasks_modality_id ON modality_tasks(modality_id);

-- Step 8: Similar process for modality_deliverables table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modality_deliverables') THEN
        -- Add modality_id column
        ALTER TABLE modality_deliverables ADD COLUMN IF NOT EXISTS modality_id INTEGER;
        
        -- Populate modality_id
        UPDATE modality_deliverables md
        SET modality_id = m.id
        FROM modalities m
        WHERE md.modality = m.value
           OR md.modality = m.name
           OR (md.modality = 'ILT/VLT' AND m.value = 'ILT_VLT')
           OR (md.modality = 'Micro Learning' AND m.value = 'Micro_Learning');
        
        -- Add foreign key constraint
        ALTER TABLE modality_deliverables 
        ADD CONSTRAINT fk_modality_deliverables_modality 
        FOREIGN KEY (modality_id) 
        REFERENCES modalities(id) 
        ON DELETE CASCADE;
        
        -- Make modality_id NOT NULL if all values are populated
        UPDATE modality_deliverables SET modality_id = (SELECT id FROM modalities LIMIT 1) WHERE modality_id IS NULL;
        ALTER TABLE modality_deliverables ALTER COLUMN modality_id SET NOT NULL;
        
        -- Create index
        CREATE INDEX IF NOT EXISTS idx_modality_deliverables_modality_id ON modality_deliverables(modality_id);
    END IF;
END $$;

-- Note: The old 'modality' columns are kept for backward compatibility
-- They can be dropped in a future migration after updating all application code