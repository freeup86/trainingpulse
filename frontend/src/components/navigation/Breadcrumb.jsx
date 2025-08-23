import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumb({ items = [], showHome = true, clickable = true }) {
  const allItems = showHome 
    ? [{ label: 'Home', href: '/dashboard', icon: Home }, ...items]
    : items;

  if (allItems.length === 0) return null;

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 mb-4">
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        const IconComponent = item.icon;

        return (
          <React.Fragment key={item.href || item.label}>
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
            )}
            
            {isLast ? (
              <span className="flex items-center font-medium text-gray-900 dark:text-white">
                {IconComponent && <IconComponent className="w-4 h-4 mr-1" />}
                {item.label}
              </span>
            ) : clickable ? (
              <Link
                to={item.href}
                className="flex items-center hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {IconComponent && <IconComponent className="w-4 h-4 mr-1" />}
                {item.label}
              </Link>
            ) : (
              <span className="flex items-center text-gray-500 dark:text-gray-400">
                {IconComponent && <IconComponent className="w-4 h-4 mr-1" />}
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// Helper hook to generate breadcrumb items based on current location
export function useBreadcrumbs() {
  const generateBreadcrumbs = (programData, folderData, listData, courseData, currentPage = 'course') => {
    const items = [];

    // Add program if available
    if (programData) {
      items.push({
        label: programData.name,
        href: `/programs/${programData.id}`,
        icon: null
      });
    }

    // Add folder if available
    if (folderData) {
      items.push({
        label: folderData.name,
        href: `/programs/${programData?.id}#folder-${folderData.id}`,
        icon: null
      });
    }

    // Add list if available
    if (listData) {
      items.push({
        label: listData.name,
        href: `/programs/${programData?.id}#list-${listData.id}`,
        icon: null
      });
    }

    // Add course if available and we're on a course page
    if (courseData && currentPage === 'course') {
      items.push({
        label: courseData.title || courseData.name,
        href: `/courses/${courseData.id}`,
        icon: null
      });
    }

    return items;
  };

  return { generateBreadcrumbs };
}

// Specific breadcrumb components for different pages
export function ProgramBreadcrumb({ program }) {
  if (!program) return null;

  const items = [
    { label: 'Programs', href: '/programs' },
    { label: program.name, href: `/programs/${program.id}` }
  ];

  return <Breadcrumb items={items} />;
}

export function ProgramSettingsBreadcrumb({ program }) {
  if (!program) return null;

  const items = [
    { label: 'Programs', href: '/programs' },
    { label: program.name, href: `/programs/${program.id}` },
    { label: 'Settings', href: `/programs/${program.id}/settings` }
  ];

  return <Breadcrumb items={items} />;
}

export function CourseBreadcrumb({ course, program, folder, list, clickable = true }) {
  const { generateBreadcrumbs } = useBreadcrumbs();
  
  // If we have hierarchy data, use it without the Courses prefix
  if (program && folder && list) {
    const hierarchyItems = generateBreadcrumbs(program, folder, list, course, 'course');
    return <Breadcrumb items={hierarchyItems} clickable={clickable} />;
  }
  
  // Fallback with Courses prefix if hierarchy is incomplete
  const baseItems = [
    { label: 'Courses', href: '/courses' }
  ];

  if (course) {
    baseItems.push({
      label: course.title || course.name,
      href: `/courses/${course.id}`
    });
  }

  return <Breadcrumb items={baseItems} clickable={clickable} />;
}

export function CourseCreateBreadcrumb({ selectedProgram, selectedFolder, selectedList, isEditing = false, courseTitle = null }) {
  const items = [
    { label: 'Courses', href: '/courses' }
  ];

  if (selectedProgram) {
    items.push({
      label: selectedProgram.name,
      href: `/programs/${selectedProgram.id}`
    });
  }

  if (selectedFolder) {
    items.push({
      label: selectedFolder.name,
      href: `/programs/${selectedProgram?.id}#folder-${selectedFolder.id}`
    });
  }

  if (selectedList) {
    items.push({
      label: selectedList.name,
      href: `/programs/${selectedProgram?.id}#list-${selectedList.id}`
    });
  }

  if (isEditing) {
    items.push({
      label: courseTitle || 'Edit Course',
      href: '#'
    });
  } else {
    items.push({
      label: 'Create Course',
      href: '/courses/create'
    });
  }

  return <Breadcrumb items={items} clickable={false} />;
}