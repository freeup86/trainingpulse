-- Create modalities table to store modality types
CREATE TABLE IF NOT EXISTS modalities (
  id SERIAL PRIMARY KEY,
  value VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'WBT', 'ILT_VLT'
  name VARCHAR(100) NOT NULL, -- e.g., 'WBT'
  description VARCHAR(255), -- e.g., 'Web-Based Training'
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default modalities
INSERT INTO modalities (value, name, description, sort_order) VALUES
  ('WBT', 'WBT', 'Web-Based Training', 1),
  ('ILT_VLT', 'ILT/VLT', 'Instructor-Led/Virtual-Led Training', 2),
  ('Micro_Learning', 'Micro Learning', 'Microlearning modules', 3),
  ('SIMS', 'SIMS', 'Software Simulations', 4),
  ('DAP', 'DAP', 'Digital Adoption Platform', 5)
ON CONFLICT (value) DO NOTHING;

-- Update modality_tasks table to reference modalities table (if needed)
-- This is optional - you can keep the existing structure or migrate to foreign keys