-- Migration: Add Final Signoff phase status
-- This adds a new phase status that comes after Final (Gold) and represents 100% completion

-- Add Final Signoff status
INSERT INTO phase_statuses (value, label, description, color, dark_color, icon, sort_order, is_default) VALUES
('final_signoff', 'Final Signoff', 'Final signoff and approval for production release', 'text-green-600', 'dark:text-green-400', 'CheckCircle', 4, false);

-- Update sort orders to maintain proper sequence:
-- Alpha Review = 1, Beta Review = 2, Final (Gold) = 3, Final Signoff = 4
UPDATE phase_statuses SET sort_order = 4 WHERE value = 'final_signoff';