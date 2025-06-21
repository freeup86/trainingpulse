# TrainingPulse User Roles & Permissions

## Overview
TrainingPulse uses a role-based access control (RBAC) system to manage user permissions and access levels. Each role has specific capabilities and responsibilities within the training workflow management system.

## Role Hierarchy

```
Admin (Full Access)
  ↓
Manager (Team & Workflow Management)
  ↓
Designer (Content Creation & Development)
  ↓
Member (Basic Access)
```

---

## Role Descriptions

### 👤 Member
**Basic team member with limited access**

#### Capabilities:
- View courses assigned to them
- View their team information
- Update their own profile
- View course details and progress
- Complete assigned tasks
- View notifications related to their work

#### Restrictions:
- Cannot create or delete courses
- Cannot manage team members
- Cannot modify workflow templates
- Cannot access analytics or bulk operations
- Cannot assign tasks to others

#### Typical Use Case:
Subject Matter Experts (SMEs), reviewers, or stakeholders who need to view and provide input on specific courses but don't actively develop content.

---

### 🎨 Designer
**Content creators and course developers**

#### Capabilities:
- All Member permissions, plus:
- Create new courses
- Edit courses assigned to them
- Manage course subtasks
- Update course status and progress
- Upload and manage course materials
- Collaborate with team members on content
- View workflow states and transitions

#### Restrictions:
- Cannot delete courses (only admins/managers)
- Cannot manage team assignments
- Cannot modify workflow templates
- Limited analytics access (only their courses)
- Cannot perform bulk operations

#### Typical Use Case:
Instructional designers, content developers, and course creators who are responsible for building and maintaining training materials.

---

### 👔 Manager
**Team leaders and project managers**

#### Capabilities:
- All Designer permissions, plus:
- Create and manage teams
- Assign/remove team members
- Delete courses
- View all courses across teams
- Access full analytics and reporting
- Manage workflow instances
- Approve workflow transitions
- Perform bulk operations
- Set team capacity and schedules

#### Restrictions:
- Cannot modify system settings
- Cannot create/edit workflow templates
- Cannot manage other managers or admins
- Cannot access system configuration

#### Typical Use Case:
Training managers, project managers, and team leads who oversee course development projects and manage team resources.

---

### 🛡️ Admin
**System administrators with full access**

#### Capabilities:
- All Manager permissions, plus:
- Full system access
- Create/edit/delete workflow templates
- Manage all users and roles
- Access system settings and configuration
- View system-wide analytics
- Perform database maintenance
- Configure integrations
- Access audit logs
- Manage security settings

#### Restrictions:
- None - Admins have full system access

#### Typical Use Case:
System administrators, IT staff, and senior training leaders who need complete control over the TrainingPulse platform.

---

## Permission Matrix

| Feature | Member | Designer | Manager | Admin |
|---------|--------|----------|---------|-------|
| View assigned courses | ✅ | ✅ | ✅ | ✅ |
| View all courses | ❌ | ❌ | ✅ | ✅ |
| Create courses | ❌ | ✅ | ✅ | ✅ |
| Edit own courses | ❌ | ✅ | ✅ | ✅ |
| Edit any course | ❌ | ❌ | ✅ | ✅ |
| Delete courses | ❌ | ❌ | ✅ | ✅ |
| Manage teams | ❌ | ❌ | ✅ | ✅ |
| View analytics | ❌ | Limited | ✅ | ✅ |
| Bulk operations | ❌ | ❌ | ✅ | ✅ |
| Workflow templates | ❌ | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ❌ | ✅ |
| User management | ❌ | ❌ | Limited | ✅ |
| Audit logs | ❌ | ❌ | ❌ | ✅ |

---

## Role Assignment Guidelines

### When to assign Member role:
- New team members in training
- External stakeholders who need visibility
- Subject matter experts providing input
- Reviewers who don't create content

### When to assign Designer role:
- Instructional designers
- Content developers
- Course creators
- Technical writers

### When to assign Manager role:
- Team leads
- Project managers
- Department heads
- Senior designers with leadership responsibilities

### When to assign Admin role:
- System administrators
- IT support staff
- Platform owners
- Senior leadership requiring full access

---

## Role Transitions

Users can be promoted or demoted between roles based on their responsibilities:

1. **Member → Designer**: When a team member takes on content creation responsibilities
2. **Designer → Manager**: When a designer is promoted to team lead
3. **Manager → Admin**: When additional system access is required
4. **Any → Member**: When responsibilities are reduced or for contractors

---

## Security Considerations

- **Principle of Least Privilege**: Users should be assigned the minimum role necessary for their job function
- **Regular Audits**: Review role assignments quarterly
- **Separation of Duties**: Critical operations may require multiple roles (e.g., one creates, another approves)
- **Temporary Elevation**: Consider time-limited role upgrades for specific projects

---

## API Access by Role

Different roles have different API access levels:

- **Member**: Read-only access to assigned resources
- **Designer**: CRUD operations on owned resources
- **Manager**: CRUD operations on team resources
- **Admin**: Full API access including system endpoints