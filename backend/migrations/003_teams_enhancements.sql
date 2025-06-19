-- Enhance teams table with additional fields
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(active);
CREATE INDEX IF NOT EXISTS idx_teams_manager_id ON teams(manager_id);

-- Add unique constraint on team name
ALTER TABLE teams
ADD CONSTRAINT unique_team_name UNIQUE (name);