-- Create phase_statuses table to manage phase statuses dynamically
-- This allows admins to configure available phase statuses and their properties

CREATE TABLE phase_statuses (
  id SERIAL PRIMARY KEY,
  value VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(50) NOT NULL, -- CSS color class like 'text-blue-500'
  dark_color VARCHAR(50), -- Dark mode color like 'dark:text-blue-400'
  icon VARCHAR(50) DEFAULT 'PlayCircle', -- Lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- One status should be default for new phases
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default phase statuses
INSERT INTO phase_statuses (value, label, description, color, dark_color, icon, sort_order, is_default) VALUES
('alpha_review', 'Alpha Review', 'Initial review phase for content development', 'text-blue-500', 'dark:text-blue-400', 'PlayCircle', 1, true),
('beta_review', 'Beta Review', 'Secondary review phase for content refinement', 'text-orange-500', 'dark:text-orange-400', 'PlayCircle', 2, false),
('final', 'Final (Gold)', 'Final approved phase ready for production', 'text-yellow-600', 'dark:text-yellow-500', 'PlayCircle', 3, false);

-- Create index for performance
CREATE INDEX idx_phase_statuses_active ON phase_statuses (is_active);
CREATE INDEX idx_phase_statuses_sort ON phase_statuses (sort_order);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_phase_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER phase_statuses_updated_at_trigger
    BEFORE UPDATE ON phase_statuses
    FOR EACH ROW
    EXECUTE FUNCTION update_phase_statuses_updated_at();