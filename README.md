# TrainingPulse

A specialized workflow management system designed specifically for training and development teams. TrainingPulse replaces generic project management tools with features tailored for course development, including intelligent status tracking, workflow automation, and comprehensive reporting.

## 🚀 Features

### Core Features (MVP)
- **Smart Status Aggregation** - Automatically calculate course status from subtask completion
- **Bottleneck Detection** - Identify and highlight workflow bottlenecks in real-time
- **Impact Analysis** - Show cascade effects of schedule changes
- **Resource Heatmaps** - Visualize team capacity and workload distribution
- **Bulk Update Wizard** - Update multiple courses simultaneously with impact preview
- **Smart Notifications Digest** - Intelligent notification aggregation and prioritization

### Target Benefits
- Reduce course development cycle time by 40%
- Achieve 90% on-time delivery rate
- Decrease status meeting time by 60%
- Improve resource utilization to 85%

## 🛠 Technology Stack

### Backend
- **Runtime**: Node.js 20.x LTS
- **Framework**: Express.js 4.18.0
- **Database**: PostgreSQL 15
- **Cache**: Redis 7.0
- **Queue**: BullMQ
- **Authentication**: JWT (RS256)

### Frontend
- **Framework**: React 18.2.0
- **Build Tool**: Vite
- **Styling**: TailwindCSS 3.3.0
- **State Management**: React Query
- **Routing**: React Router DOM

### Deployment
- **Platform**: Render.com
- **Architecture**: Modular monolith (microservices-ready)
- **API**: RESTful with /api/v1 prefix

## 🏗 Architecture

```
TrainingPulse/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Database, Redis configuration
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── models/         # Data models
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API routes
│   │   └── utils/          # Utilities, logger
│   ├── migrations/         # Database migrations
│   └── tests/              # Test files
├── frontend/               # React/Vite SPA
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API calls
│   │   ├── hooks/          # Custom hooks
│   │   └── utils/          # Utilities
└── render.yaml            # Deployment configuration
```

## 🚦 Getting Started

### Prerequisites
- Node.js 20.x or higher
- PostgreSQL 15
- Redis 7.0
- npm or yarn

### Local Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/your-org/trainingpulse.git
cd trainingpulse
```

2. **Environment Configuration**
```bash
# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your local database credentials

# Frontend environment
cp frontend/.env.example frontend/.env
# Edit frontend/.env if needed
```

3. **Database Setup**
```bash
# Create PostgreSQL database
createdb trainingpulse

# Run migrations
cd backend
npm install
npm run migrate
```

4. **Start Services**

**Option A: Manual startup**
```bash
# Start Redis (if not running)
redis-server

# Start Backend
cd backend
npm run dev

# Start Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

**Option B: Docker Compose**
```bash
docker-compose up -d
```

5. **Access the Application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Health Check: http://localhost:3001/health
- API Documentation: http://localhost:3001/api/v1

### Default Users

The system comes with pre-configured users for testing:

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| admin@trainingpulse.com | AdminPass123! | admin | System administrator |
| manager@trainingpulse.com | ManagerPass123! | manager | Training manager |
| designer@trainingpulse.com | DesignerPass123! | designer | Instructional designer |
| reviewer@trainingpulse.com | ReviewerPass123! | reviewer | Content reviewer |

**⚠️ Important**: Change these passwords in production!

## 📋 Development Workflow

### Backend Development
```bash
cd backend

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run migrations
npm run migrate

# Run tests
npm test

# Lint code
npm run lint
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## 🚀 Deployment

### Render.com Deployment

1. **Fork/Clone** this repository to your GitHub account

2. **Create Render Account** at https://render.com

3. **Connect Repository** to Render

4. **Deploy via render.yaml**
   - Render will automatically detect the `render.yaml` file
   - It will create all necessary services (API, Frontend, Database, Redis)

5. **Configure Environment Variables**
   - Set required secrets (SendGrid API key, AWS credentials, etc.)
   - Update CORS origins if needed

6. **Database Migration**
   - SSH into the backend service
   - Run `npm run migrate:production`

### Environment Variables

#### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@host:5432/trainingpulse
REDIS_URL=redis://host:6379
JWT_SECRET=your-super-secret-jwt-key-here-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here-min-32-chars
SENDGRID_API_KEY=your-sendgrid-api-key
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=https://your-api-domain.com/api/v1
```

## 📖 API Documentation

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user

### Courses
- `GET /api/v1/courses` - List courses with filters
- `POST /api/v1/courses` - Create new course
- `GET /api/v1/courses/:id` - Get course details
- `PUT /api/v1/courses/:id` - Update course
- `DELETE /api/v1/courses/:id` - Delete course
- `POST /api/v1/courses/:id/transition` - Execute workflow transition

### Analytics
- `GET /api/v1/analytics/bottlenecks` - Get bottleneck analysis
- `GET /api/v1/analytics/workload` - Get resource heatmap data
- `GET /api/v1/analytics/impact/:courseId` - Analyze schedule change impact

### Bulk Operations
- `POST /api/v1/bulk/preview` - Preview bulk update
- `POST /api/v1/bulk/execute` - Execute bulk update

### Notifications
- `GET /api/v1/notifications/digest` - Get notification digest
- `GET /api/v1/notifications` - Get user notifications
- `PUT /api/v1/notifications/:id/read` - Mark notification as read

## 🔒 Security

- HTTPS only with HSTS enabled
- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Input validation on all endpoints
- SQL injection prevention
- XSS protection
- Rate limiting (100 req/min)
- Audit logging
- Password hashing with bcrypt

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
```

### Frontend Tests
```bash
cd frontend
npm test                    # Run all tests
npm run test:ui            # Run tests with UI
```

## 📊 Monitoring

### Health Checks
- Backend: `GET /health`
- Database connectivity check
- Redis connectivity check

### Logging
- Structured logging with Winston
- Request/response logging
- Error tracking with stack traces
- Performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Standards
- Follow ESLint configuration
- Write unit tests for new features
- Update documentation for API changes
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@trainingpulse.com
- 📖 Documentation: https://docs.trainingpulse.com
- 🐛 Issues: https://github.com/your-org/trainingpulse/issues

## 🗺 Roadmap

### Phase 1: Foundation ✅
- [x] Project setup and database schema
- [x] Authentication system
- [x] Basic CRUD operations

### Phase 2: Core Features 🚧
- [ ] Smart Status Aggregation
- [ ] Bottleneck Detection
- [ ] Impact Analysis
- [ ] Resource Heatmaps
- [ ] Bulk Update Wizard
- [ ] Smart Notifications

### Phase 3: Advanced Features 📋
- [ ] Advanced analytics dashboard
- [ ] Microsoft Teams integration
- [ ] Advanced reporting
- [ ] Mobile app
- [ ] API webhooks
- [ ] Third-party integrations

---

**Built with ❤️ for training teams worldwide**