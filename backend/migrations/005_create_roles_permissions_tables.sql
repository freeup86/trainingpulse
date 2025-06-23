-- Migration: Create roles and permissions tables
-- This migration creates a comprehensive RBAC system

-- Create roles table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create permissions table
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- e.g., 'courses', 'users', 'teams', 'analytics'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions junction table
CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- Create indexes for better performance
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_roles_active ON roles(is_active);
CREATE INDEX idx_permissions_name ON permissions(name);
CREATE INDEX idx_permissions_category ON permissions(category);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Insert default roles
INSERT INTO roles (name, display_name, description) VALUES
('admin', 'Administrator', 'Full system access with all permissions'),
('manager', 'Manager', 'Team management and oversight capabilities'),
('designer', 'Designer', 'Content creation and course development'),
('reviewer', 'Reviewer', 'Course review and approval capabilities'),
('sme', 'Subject Matter Expert', 'Domain expertise and content validation'),
('instructor', 'Instructor', 'Course delivery and student interaction');

-- Insert default permissions
INSERT INTO permissions (name, display_name, description, category) VALUES
-- Course permissions
('course.create', 'Create Courses', 'Ability to create new courses', 'courses'),
('course.read', 'View Courses', 'Ability to view course details', 'courses'),
('course.update', 'Edit Courses', 'Ability to edit course information', 'courses'),
('course.delete', 'Delete Courses', 'Ability to delete courses', 'courses'),
('course.manage_workflow', 'Manage Course Workflow', 'Ability to transition course workflow states', 'courses'),
('course.approve', 'Approve Courses', 'Ability to approve courses for publication', 'courses'),

-- User permissions
('user.create', 'Create Users', 'Ability to create new user accounts', 'users'),
('user.read', 'View Users', 'Ability to view user information', 'users'),
('user.update', 'Edit Users', 'Ability to edit user information', 'users'),
('user.delete', 'Delete Users', 'Ability to deactivate user accounts', 'users'),
('user.manage_roles', 'Manage User Roles', 'Ability to assign roles to users', 'users'),

-- Team permissions
('team.create', 'Create Teams', 'Ability to create new teams', 'teams'),
('team.read', 'View Teams', 'Ability to view team information', 'teams'),
('team.update', 'Edit Teams', 'Ability to edit team information', 'teams'),
('team.delete', 'Delete Teams', 'Ability to delete teams', 'teams'),
('team.manage_members', 'Manage Team Members', 'Ability to add/remove team members', 'teams'),

-- Analytics permissions
('analytics.view', 'View Analytics', 'Ability to view analytics and reports', 'analytics'),
('analytics.export', 'Export Analytics', 'Ability to export analytics data', 'analytics'),

-- System permissions
('system.admin', 'System Administration', 'Full system administration capabilities', 'system'),
('system.settings', 'Manage Settings', 'Ability to manage system settings', 'system'),
('system.roles', 'Manage Roles', 'Ability to manage roles and permissions', 'system'),

-- Workflow permissions
('workflow.review', 'Review Workflow Items', 'Ability to review items in workflow', 'workflow'),
('workflow.approve', 'Approve Workflow Items', 'Ability to approve workflow transitions', 'workflow');

-- Assign default permissions to roles
-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'admin';

-- Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'manager' AND p.name IN (
    'course.create', 'course.read', 'course.update', 'course.delete', 'course.manage_workflow',
    'user.read', 'team.create', 'team.read', 'team.update', 'team.delete', 'team.manage_members',
    'analytics.view', 'analytics.export', 'workflow.review', 'workflow.approve'
);

-- Designer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'designer' AND p.name IN (
    'course.create', 'course.read', 'course.update', 'course.manage_workflow',
    'user.read', 'team.read'
);

-- Reviewer permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'reviewer' AND p.name IN (
    'course.read', 'course.approve', 'workflow.review', 'workflow.approve',
    'user.read', 'team.read', 'analytics.view'
);

-- SME permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'sme' AND p.name IN (
    'course.read', 'course.update', 'workflow.review',
    'user.read', 'team.read'
);

-- Instructor permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'instructor' AND p.name IN (
    'course.read', 'user.read', 'team.read', 'analytics.view'
);

-- Update users table to use role names instead of hardcoded values
-- First, add a temporary column
ALTER TABLE users ADD COLUMN new_role VARCHAR(50);

-- Map existing roles to new role names
UPDATE users SET new_role = CASE 
    WHEN role = 'admin' THEN 'admin'
    WHEN role = 'manager' THEN 'manager'
    WHEN role = 'designer' THEN 'designer'
    WHEN role = 'reviewer' THEN 'reviewer'
    WHEN role = 'user' THEN 'designer' -- Default user to designer
    ELSE 'designer'
END;

-- Drop the old role column and rename the new one
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN new_role TO role;

-- Add foreign key constraint to link users to roles
ALTER TABLE users ADD CONSTRAINT fk_user_role 
    FOREIGN KEY (role) REFERENCES roles(name) ON UPDATE CASCADE;

-- Add updated_at trigger for roles table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();