const request = require('supertest');
const app = require('../../app');
const { Pool } = require('pg');

// Mock the database
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('Courses API Tests', () => {
  let pool;
  let token = 'test-jwt-token';

  beforeAll(() => {
    pool = new Pool();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/courses', () => {
    it('should return all courses with pagination', async () => {
      const mockCourses = [
        {
          id: 1,
          title: 'Test Course 1',
          status: 'pre_development',
          priority: 'high',
        },
        {
          id: 2,
          title: 'Test Course 2',
          status: 'completed',
          priority: 'medium',
        },
      ];

      pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      pool.query.mockResolvedValueOnce({ rows: mockCourses });

      const response = await request(app)
        .get('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.courses).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should filter courses by status', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      pool.query.mockResolvedValueOnce({ 
        rows: [{
          id: 1,
          title: 'Active Course',
          status: 'pre_development',
        }]
      });

      const response = await request(app)
        .get('/api/v1/courses?status=pre_development')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.courses).toHaveLength(1);
      expect(response.body.data.courses[0].status).toBe('pre_development');
    });

    it('should filter courses by priority', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      pool.query.mockResolvedValueOnce({ 
        rows: [{
          id: 1,
          title: 'High Priority Course',
          priority: 'high',
        }]
      });

      const response = await request(app)
        .get('/api/v1/courses?priority=high')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.courses[0].priority).toBe('high');
    });

    it('should sort courses by due date', async () => {
      const sortedCourses = [
        { id: 1, title: 'Course 1', due_date: '2024-01-01' },
        { id: 2, title: 'Course 2', due_date: '2024-02-01' },
      ];

      pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      pool.query.mockResolvedValueOnce({ rows: sortedCourses });

      const response = await request(app)
        .get('/api/v1/courses?sortBy=due_date&sortOrder=asc')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.courses[0].due_date).toBe('2024-01-01');
      expect(response.body.data.courses[1].due_date).toBe('2024-02-01');
    });

    it('should handle pagination correctly', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '100' }] });
      pool.query.mockResolvedValueOnce({ rows: Array(20).fill({}) });

      const response = await request(app)
        .get('/api/v1/courses?page=2&limit=20')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.limit).toBe(20);
      expect(response.body.data.pagination.total).toBe(100);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/v1/courses')
        .expect(401);
    });
  });

  describe('GET /api/v1/courses/:id', () => {
    it('should return a single course with details', async () => {
      const mockCourse = {
        id: 1,
        title: 'Test Course',
        description: 'Test Description',
        status: 'pre_development',
        priority: 'high',
        modality: 'WBT',
        phases: [],
      };

      pool.query.mockResolvedValueOnce({ rows: [mockCourse] });
      pool.query.mockResolvedValueOnce({ rows: [] }); // phases

      const response = await request(app)
        .get('/api/v1/courses/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(1);
      expect(response.body.data.title).toBe('Test Course');
    });

    it('should return 404 for non-existent course', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/v1/courses/999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/courses', () => {
    it('should create a new course', async () => {
      const newCourse = {
        title: 'New Course',
        description: 'New Description',
        modality: 'WBT',
        priority: 'high',
        status: 'pre_development',
      };

      pool.query.mockResolvedValueOnce({ 
        rows: [{ id: 1, ...newCourse }]
      });

      const response = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .send(newCourse)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('New Course');
    });

    it('should validate required fields', async () => {
      const invalidCourse = {
        description: 'Missing title',
      };

      await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidCourse)
        .expect(400);
    });

    it('should validate modality values', async () => {
      const invalidCourse = {
        title: 'Test',
        modality: 'INVALID',
      };

      await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidCourse)
        .expect(400);
    });
  });

  describe('PUT /api/v1/courses/:id', () => {
    it('should update an existing course', async () => {
      const updates = {
        title: 'Updated Title',
        priority: 'medium',
      };

      pool.query.mockResolvedValueOnce({ 
        rows: [{ id: 1, ...updates }]
      });

      const response = await request(app)
        .put('/api/v1/courses/1')
        .set('Authorization', `Bearer ${token}`)
        .send(updates)
        .expect(200);

      expect(response.body.data.title).toBe('Updated Title');
      expect(response.body.data.priority).toBe('medium');
    });

    it('should return 404 for non-existent course', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .put('/api/v1/courses/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/courses/:id', () => {
    it('should delete a course', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [{ id: 1 }],
        rowCount: 1
      });

      const response = await request(app)
        .delete('/api/v1/courses/1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent course', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [],
        rowCount: 0
      });

      await request(app)
        .delete('/api/v1/courses/999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('Phase Status Updates', () => {
    it('should update phase status', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [{ id: 1, status: 'completed' }]
      });

      const response = await request(app)
        .put('/api/v1/courses/1/phases/1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body.data.status).toBe('completed');
    });

    it('should validate status values', async () => {
      await request(app)
        .put('/api/v1/courses/1/phases/1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk update course statuses', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [
          { id: 1, status: 'completed' },
          { id: 2, status: 'completed' },
        ]
      });

      const response = await request(app)
        .post('/api/v1/bulk/courses/update-status')
        .set('Authorization', `Bearer ${token}`)
        .send({
          courseIds: [1, 2],
          status: 'completed'
        })
        .expect(200);

      expect(response.body.data.updated).toBe(2);
    });

    it('should bulk assign courses', async () => {
      pool.query.mockResolvedValueOnce({ 
        rows: [
          { course_id: 1, user_id: 1 },
          { course_id: 1, user_id: 2 },
        ]
      });

      const response = await request(app)
        .post('/api/v1/bulk/courses/assign')
        .set('Authorization', `Bearer ${token}`)
        .send({
          courseIds: [1],
          userIds: [1, 2]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Search and Filters', () => {
    it('should search courses by title', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      pool.query.mockResolvedValueOnce({ 
        rows: [{
          id: 1,
          title: 'JavaScript Course',
        }]
      });

      const response = await request(app)
        .get('/api/v1/courses?search=JavaScript')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.courses[0].title).toContain('JavaScript');
    });

    it('should filter by date range', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
      pool.query.mockResolvedValueOnce({ 
        rows: [
          { id: 1, start_date: '2024-01-15' },
          { id: 2, start_date: '2024-01-20' },
        ]
      });

      const response = await request(app)
        .get('/api/v1/courses?startDateFrom=2024-01-01&startDateTo=2024-01-31')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.courses).toHaveLength(2);
    });

    it('should filter by owner', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      pool.query.mockResolvedValueOnce({ 
        rows: [{
          id: 1,
          owner_id: 1,
          owner_name: 'John Doe',
        }]
      });

      const response = await request(app)
        .get('/api/v1/courses?ownerId=1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data.courses[0].owner_id).toBe(1);
    });
  });
});