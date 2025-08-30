import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

// Tailwind class utility
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Date formatting utilities
export const formatDate = (date, formatStr = 'MMM d, yyyy') => {
  if (!date) return '';
  
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsedDate)) return '';
  
  return format(parsedDate, formatStr);
};

export const formatDateTime = (date) => {
  return formatDate(date, 'MMM d, yyyy h:mm a');
};

export const formatRelativeTime = (date) => {
  if (!date) return '';
  
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsedDate)) return '';
  
  return formatDistanceToNow(parsedDate, { addSuffix: true });
};

export const formatDuration = (hours) => {
  if (!hours || hours < 0) return '0h';
  
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
};

// Status and priority utilities
export const getStatusColor = (status, variant = 'badge') => {
  const colors = {
    '': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200', // Empty status
    'draft': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    'content_development': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'review': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'approval': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'published': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'archived': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    'not_started': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    'in_progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'completed': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'cancelled': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'on_hold': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'overdue': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'planning': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    'legal_review': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'alpha_review': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'beta_review': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'final_revision': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'final_signoff_received': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
};

export const getPriorityColor = (priority, variant = 'default') => {
  // Normalize priority to lowercase for comparison
  const normalizedPriority = (priority || 'low').toLowerCase();
  
  const colors = {
    'low': 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    'normal': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'high': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    'urgent': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    // Legacy support for old data
    'medium': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'critical': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  
  if (variant === 'badge') {
    return colors[normalizedPriority] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
  
  return colors[normalizedPriority] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

export const getModalityColor = (modality) => {
  const normalizedModality = (modality || '').toLowerCase().replace(/\//g, '').replace(/\s+/g, '');
  
  const colors = {
    'wbt': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'iltvlt': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'microlearning': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    'sims': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'blended': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    'selfpaced': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  };
  
  return colors[normalizedModality] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
};

export const getRoleColor = (role) => {
  const colors = {
    'admin': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'manager': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'designer': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'reviewer': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'viewer': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  };
  return colors[role] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
};

export const getWorkflowStatusColor = (status) => {
  const colors = {
    'active': 'bg-green-100 text-green-800',
    'paused': 'bg-yellow-100 text-yellow-800',
    'completed': 'bg-blue-100 text-blue-800',
    'cancelled': 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// Workload intensity utilities
export const getIntensityColor = (intensity) => {
  const colors = {
    'low': 'bg-green-100 text-green-800',
    'medium': 'bg-yellow-100 text-yellow-800',
    'high': 'bg-orange-100 text-orange-800',
    'critical': 'bg-red-100 text-red-800',
  };
  return colors[intensity] || 'bg-gray-100 text-gray-800';
};

export const getUtilizationColor = (utilization) => {
  if (utilization >= 100) return 'text-red-600';
  if (utilization >= 85) return 'text-orange-500';
  if (utilization >= 70) return 'text-yellow-500';
  return 'text-green-600';
};

// Data formatting utilities
export const formatPercentage = (value, decimals = 1) => {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
};

export const formatNumber = (value, decimals = 0) => {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  return value.toLocaleString('en-US', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  });
};

export const formatCurrency = (value, currency = 'USD') => {
  if (typeof value !== 'number' || isNaN(value)) return '$0';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency
  });
};

// Text utilities
export const truncateText = (text, maxLength = 100) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const capitalizeFirst = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const formatName = (firstName, lastName) => {
  if (!firstName && !lastName) return '';
  if (!lastName) return firstName;
  if (!firstName) return lastName;
  return `${firstName} ${lastName}`;
};

// URL utilities
export const buildQueryString = (params) => {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(item => searchParams.append(key, item));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });
  
  return searchParams.toString();
};

// Array utilities
export const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key];
    groups[group] = groups[group] || [];
    groups[group].push(item);
    return groups;
  }, {});
};

export const sortBy = (array, key, direction = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    
    if (aVal === bVal) return 0;
    
    const result = aVal < bVal ? -1 : 1;
    return direction === 'desc' ? -result : result;
  });
};

export const filterBy = (array, filters) => {
  return array.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === null || value === undefined || value === '') return true;
      
      if (Array.isArray(value)) {
        return value.includes(item[key]);
      }
      
      if (typeof value === 'string') {
        return String(item[key]).toLowerCase().includes(value.toLowerCase());
      }
      
      return item[key] === value;
    });
  });
};

// Validation utilities
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Local storage utilities
export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  }
};

// Debounce utility
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Theme utilities
export const getTheme = () => storage.get('theme') || 'light';

export const setTheme = (theme) => {
  storage.set('theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
};