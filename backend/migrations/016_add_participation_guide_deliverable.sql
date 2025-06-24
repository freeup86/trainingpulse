-- Migration: Add Participation Guide deliverable for ILT/VLT modality
-- This migration adds a new "Participation Guide" deliverable and associates it with ILT/VLT modality

-- Insert new deliverable
INSERT INTO deliverables (name, description) VALUES
('Participation Guide', 'Participation guide for ILT/VLT courses');

-- Associate the new deliverable with ILT/VLT modality
INSERT INTO modality_deliverables (modality, deliverable_id, is_optional) 
SELECT 'ILT/VLT', id, false FROM deliverables WHERE name = 'Participation Guide';