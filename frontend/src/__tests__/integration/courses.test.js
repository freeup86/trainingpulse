import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CoursesPage from '../../pages/CoursesPage';
import { courses, statuses, users, lists } from '../../lib/api';

vi.mock('../../lib/api');

const renderWithProviders = (component) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const mockCourses = [
  {
    id: 1,
    title: 'Test Course 1',
    description: 'Description 1',
    status: 'pre_development',
    priority: 'high',
    modality: 'WBT',
    start_date: '2024-01-01',
    due_date: '2024-12-31',
    owner: { id: 1, name: 'John Doe' },
    progress: 25,
  },
  {
    id: 2,
    title: 'Test Course 2',
    description: 'Description 2',
    status: 'completed',
    priority: 'medium',
    modality: 'ILT/VLT',
    start_date: '2024-02-01',
    due_date: '2024-11-30',
    owner: { id: 2, name: 'Jane Smith' },
    progress: 100,
  },
];

describe('Courses Page Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    courses.getAll.mockResolvedValue({
      data: {
        success: true,
        data: {
          courses: mockCourses,
          pagination: {
            total: 2,
            page: 1,
            pages: 1,
          },
        },
      },
    });

    statuses.getAll.mockResolvedValue({
      data: {
        success: true,
        data: [
          { value: 'pre_development', label: 'Pre-Development' },
          { value: 'completed', label: 'Completed' },
        ],
      },
    });

    users.getAll.mockResolvedValue({
      data: {
        success: true,
        data: [
          { id: 1, name: 'John Doe' },
          { id: 2, name: 'Jane Smith' },
        ],
      },
    });

    lists.getAll.mockResolvedValue({
      data: {
        success: true,
        data: [],
      },
    });
  });

  describe('Course Display', () => {
    it('should display all courses in the table', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
        expect(screen.getByText('Test Course 2')).toBeInTheDocument();
      });
    });

    it('should display course details correctly', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('high')).toBeInTheDocument();
        expect(screen.getByText('medium')).toBeInTheDocument();
        expect(screen.getByText('WBT')).toBeInTheDocument();
        expect(screen.getByText('ILT/VLT')).toBeInTheDocument();
      });
    });

    it('should show correct progress indicators', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        const progressBars = screen.getAllByRole('progressbar');
        expect(progressBars).toHaveLength(2);
      });
    });
  });

  describe('Filtering Functionality', () => {
    it('should filter courses by status', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      // Click on Status filter
      const statusFilterButton = screen.getByRole('button', { name: /status.*filter/i });
      fireEvent.click(statusFilterButton);

      // Select 'Completed' status
      const completedCheckbox = screen.getByLabelText(/completed/i);
      fireEvent.click(completedCheckbox);

      await waitFor(() => {
        expect(screen.queryByText('Test Course 1')).not.toBeInTheDocument();
        expect(screen.getByText('Test Course 2')).toBeInTheDocument();
      });
    });

    it('should filter courses by priority', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      // Click on Priority filter
      const priorityFilterButton = screen.getByRole('button', { name: /priority.*filter/i });
      fireEvent.click(priorityFilterButton);

      // Select 'High' priority
      const highCheckbox = screen.getByLabelText(/high/i);
      fireEvent.click(highCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
        expect(screen.queryByText('Test Course 2')).not.toBeInTheDocument();
      });
    });

    it('should filter courses by modality', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      // Click on Modality filter
      const modalityFilterButton = screen.getByRole('button', { name: /modality.*filter/i });
      fireEvent.click(modalityFilterButton);

      // Select 'WBT' modality
      const wbtCheckbox = screen.getByLabelText(/wbt/i);
      fireEvent.click(wbtCheckbox);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
        expect(screen.queryByText('Test Course 2')).not.toBeInTheDocument();
      });
    });

    it('should handle date range filters', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      // Click on Start Date filter
      const startDateFilterButton = screen.getByRole('button', { name: /start date.*filter/i });
      fireEvent.click(startDateFilterButton);

      // Enter date range
      const fromDateInput = screen.getByLabelText(/from/i);
      const toDateInput = screen.getByLabelText(/to/i);
      
      fireEvent.change(fromDateInput, { target: { value: '2024-01-01' } });
      fireEvent.change(toDateInput, { target: { value: '2024-01-31' } });

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
        expect(screen.queryByText('Test Course 2')).not.toBeInTheDocument();
      });
    });

    it('should clear all filters', async () => {
      renderWithProviders(<CoursesPage />);

      // Apply a filter first
      const statusFilterButton = screen.getByRole('button', { name: /status.*filter/i });
      fireEvent.click(statusFilterButton);
      
      const completedCheckbox = screen.getByLabelText(/completed/i);
      fireEvent.click(completedCheckbox);

      await waitFor(() => {
        expect(screen.queryByText('Test Course 1')).not.toBeInTheDocument();
      });

      // Clear filters
      const clearFiltersButton = screen.getByRole('button', { name: /clear filters/i });
      fireEvent.click(clearFiltersButton);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
        expect(screen.getByText('Test Course 2')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting Functionality', () => {
    it('should sort courses by title', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      // Click on Course column header to sort
      const courseHeader = screen.getByRole('columnheader', { name: /course/i });
      fireEvent.click(courseHeader);

      await waitFor(() => {
        const courseElements = screen.getAllByText(/Test Course/);
        expect(courseElements[0]).toHaveTextContent('Test Course 1');
        expect(courseElements[1]).toHaveTextContent('Test Course 2');
      });

      // Click again to reverse sort
      fireEvent.click(courseHeader);

      await waitFor(() => {
        const courseElements = screen.getAllByText(/Test Course/);
        expect(courseElements[0]).toHaveTextContent('Test Course 2');
        expect(courseElements[1]).toHaveTextContent('Test Course 1');
      });
    });

    it('should sort courses by due date', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      const dueDateHeader = screen.getByRole('columnheader', { name: /due date/i });
      fireEvent.click(dueDateHeader);

      // Verify sorting logic is applied
      expect(courses.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'due_date',
          sortOrder: 'asc',
        })
      );
    });
  });

  describe('Column Resize Functionality', () => {
    it('should allow resizing table columns', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      // Find resize handle
      const resizeHandles = document.querySelectorAll('.cursor-col-resize');
      expect(resizeHandles.length).toBeGreaterThan(0);

      // Simulate resize
      const firstHandle = resizeHandles[0];
      fireEvent.mouseDown(firstHandle, { clientX: 100 });
      fireEvent.mouseMove(document, { clientX: 150 });
      fireEvent.mouseUp(document);

      // Check that width was saved to localStorage
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should reset column widths to defaults', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      const resetButton = screen.getByRole('button', { name: /reset columns/i });
      fireEvent.click(resetButton);

      expect(localStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('Group By Functionality', () => {
    it('should group courses by status', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      // Change group by to status
      const groupBySelect = screen.getByLabelText(/group by/i);
      fireEvent.change(groupBySelect, { target: { value: 'status' } });

      await waitFor(() => {
        expect(screen.getByText(/pre-development/i)).toBeInTheDocument();
        expect(screen.getByText(/completed/i)).toBeInTheDocument();
      });
    });

    it('should expand and collapse status groups', async () => {
      renderWithProviders(<CoursesPage />);

      // Group by status
      const groupBySelect = screen.getByLabelText(/group by/i);
      fireEvent.change(groupBySelect, { target: { value: 'status' } });

      await waitFor(() => {
        const preDevGroup = screen.getByRole('button', { name: /pre-development/i });
        expect(preDevGroup).toBeInTheDocument();
      });

      // Collapse group
      const preDevGroup = screen.getByRole('button', { name: /pre-development/i });
      fireEvent.click(preDevGroup);

      await waitFor(() => {
        expect(screen.queryByText('Test Course 1')).not.toBeInTheDocument();
      });

      // Expand group
      fireEvent.click(preDevGroup);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });
    });
  });

  describe('Course Actions', () => {
    it('should navigate to course details on click', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        const courseLink = screen.getByText('Test Course 1');
        expect(courseLink).toBeInTheDocument();
      });

      const courseLink = screen.getByText('Test Course 1');
      fireEvent.click(courseLink);

      // Check navigation occurred
      expect(window.location.pathname).toBe('/courses/1');
    });

    it('should show course actions menu', async () => {
      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Course 1')).toBeInTheDocument();
      });

      // Find and click actions button
      const actionsButtons = screen.getAllByRole('button', { name: /actions/i });
      fireEvent.click(actionsButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/edit/i)).toBeInTheDocument();
        expect(screen.getByText(/duplicate/i)).toBeInTheDocument();
        expect(screen.getByText(/archive/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when courses fail to load', async () => {
      courses.getAll.mockRejectedValue(new Error('Failed to fetch courses'));

      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch courses/i)).toBeInTheDocument();
      });
    });

    it('should show no courses message when list is empty', async () => {
      courses.getAll.mockResolvedValue({
        data: {
          success: true,
          data: {
            courses: [],
            pagination: { total: 0, page: 1, pages: 0 },
          },
        },
      });

      renderWithProviders(<CoursesPage />);

      await waitFor(() => {
        expect(screen.getByText(/no courses found/i)).toBeInTheDocument();
      });
    });
  });
});