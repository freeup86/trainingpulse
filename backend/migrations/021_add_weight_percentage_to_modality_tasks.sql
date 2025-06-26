-- Migration: Add weight percentage to modality tasks
-- This allows each phase to contribute a different percentage to overall course progress

-- Add weight_percentage column to modality_tasks table
ALTER TABLE modality_tasks 
ADD COLUMN weight_percentage INTEGER DEFAULT 100 CHECK (weight_percentage >= 0 AND weight_percentage <= 100);

-- Update existing tasks with equal weight distribution for each modality
-- This ensures existing data has reasonable defaults

-- WBT: 3 phases - distribute equally (33.33% each, rounded)
UPDATE modality_tasks 
SET weight_percentage = CASE 
  WHEN task_type = 'Outline' THEN 25
  WHEN task_type = 'Storyboard' THEN 35
  WHEN task_type = 'Development' THEN 40
  ELSE 100
END
WHERE modality = 'WBT';

-- ILT/VLT: 2 phases - distribute equally (50% each)
UPDATE modality_tasks 
SET weight_percentage = 50
WHERE modality = 'ILT/VLT';

-- Micro Learning: 3 phases - distribute equally (33.33% each, rounded)
UPDATE modality_tasks 
SET weight_percentage = CASE 
  WHEN task_type = 'Outline' THEN 25
  WHEN task_type = 'Storyboard' THEN 35
  WHEN task_type = 'Development' THEN 40
  ELSE 100
END
WHERE modality = 'Micro Learning';

-- SIMS: 2 phases - distribute equally (50% each)
UPDATE modality_tasks 
SET weight_percentage = 50
WHERE modality = 'SIMS';

-- DAP: 2 phases - distribute equally (50% each)
UPDATE modality_tasks 
SET weight_percentage = 50
WHERE modality = 'DAP';

-- Add comment to document the purpose
COMMENT ON COLUMN modality_tasks.weight_percentage IS 'Percentage weight this phase contributes to overall course progress (0-100)';

-- Create index for performance
CREATE INDEX idx_modality_tasks_weight ON modality_tasks(modality, weight_percentage) WHERE weight_percentage IS NOT NULL;