-- Migration: Add profile fields to users table
-- This migration adds user profile fields for the profile page

-- Add profile fields to users table
ALTER TABLE users 
ADD COLUMN phone VARCHAR(20),
ADD COLUMN location VARCHAR(100),
ADD COLUMN bio TEXT,
ADD COLUMN website VARCHAR(500),
ADD COLUMN linkedin VARCHAR(200);

-- Create indexes for performance
CREATE INDEX idx_users_location ON users(location) WHERE location IS NOT NULL;