# TrainingPulse Deployment Guide - Render + Aiven

This guide walks you through deploying TrainingPulse on Render using your existing Aiven PostgreSQL database.

## Prerequisites

1. **Render Account**: Sign up at https://render.com
2. **Aiven Database**: Your existing Aiven PostgreSQL database
3. **GitHub Repository**: Your TrainingPulse repository should be connected to GitHub

## Step 1: Prepare Your Repository

1. **Commit the updated render.yaml**:
   ```bash
   git add render.yaml DEPLOYMENT_GUIDE.md
   git commit -m "Configure Render deployment with Aiven database"
   git push origin main
   ```

## Step 2: Deploy on Render

1. **Go to Render Dashboard**: https://dashboard.render.com

2. **Connect GitHub Repository**:
   - Click "New +" → "Blueprint"
   - Connect your GitHub account if not already connected
   - Select your TrainingPulse repository
   - Select the branch (main)

3. **Deploy Services**:
   - Render will detect your `render.yaml` file
   - Review the services to be created:
     - `trainingpulse-api` (Backend)
     - `trainingpulse-frontend` (Frontend)
   - Click "Apply"

## Step 3: Configure Environment Variables

After the initial deployment, you need to set up the environment variables:

### Backend (trainingpulse-api)

1. Go to your backend service in Render Dashboard
2. Click on "Environment" tab
3. Add these environment variables:

```bash
# REQUIRED - Your Aiven Database URL
# Get this from your Aiven console or use the value from your local .env file
DATABASE_URL=postgres://username:YOUR_AIVEN_PASSWORD@your-aiven-host.aivencloud.com:port/database?sslmode=require

# REQUIRED - Frontend URL (update after frontend deploys)
CORS_ORIGIN=https://trainingpulse-frontend.onrender.com

# Optional - Email Service
SENDGRID_API_KEY=your_sendgrid_api_key

# Optional - AWS S3 for file uploads
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Optional - Microsoft Teams webhook
TEAMS_WEBHOOK_URL=your_teams_webhook_url
```

### Frontend (trainingpulse-frontend)

1. Go to your frontend service in Render Dashboard
2. Click on "Environment" tab
3. Add this environment variable:

```bash
# REQUIRED - Backend API URL (use your actual backend URL)
VITE_API_BASE_URL=https://trainingpulse-api.onrender.com
```

## Step 4: Verify Database Migrations

1. After the backend deploys, check the logs to ensure migrations run successfully
2. The backend should automatically run migrations on startup
3. If migrations fail, you may need to run them manually:
   - Use Render Shell to access your backend service
   - Run: `cd backend && node migrations/migrate.js`

## Step 5: Update Your Aiven Database (if needed)

Ensure your Aiven database:
1. Allows connections from Render's IP addresses
2. Has SSL enabled (which it should by default)
3. Has the correct database and schema created

## Step 6: Test Your Deployment

1. **Backend Health Check**:
   ```
   https://trainingpulse-api.onrender.com/health
   ```

2. **Frontend**:
   ```
   https://trainingpulse-frontend.onrender.com
   ```

3. **API Documentation**:
   ```
   https://trainingpulse-api.onrender.com/api/v1
   ```

## Important Notes

### Free Tier Limitations
- Services on Render's free tier will spin down after 15 minutes of inactivity
- First request after spin-down will be slow (30-60 seconds)
- Consider upgrading to paid tiers for production use

### Security Considerations
1. **JWT Secrets**: Render will auto-generate secure JWT secrets
2. **Database URL**: Keep your Aiven database URL secure
3. **CORS**: Update CORS_ORIGIN to match your frontend URL exactly
4. **SSL**: Render provides free SSL certificates automatically

### Monitoring
- Check service logs in Render Dashboard
- Set up health check alerts in Render
- Monitor your Aiven database metrics

## Troubleshooting

### Database Connection Issues
```bash
# Check if NODE_TLS_REJECT_UNAUTHORIZED is set to "0"
# Verify DATABASE_URL format is correct
# Ensure Aiven allows connections from Render
```

### Frontend Can't Connect to Backend
```bash
# Verify VITE_API_BASE_URL is correct
# Check CORS_ORIGIN matches frontend URL
# Ensure backend is running and healthy
```

### Build Failures
```bash
# Check build logs in Render Dashboard
# Ensure all dependencies are in package.json
# Verify Node version compatibility
```

## Post-Deployment Steps

1. **Create Admin User**:
   - Use the Render Shell to access backend
   - Run seed scripts or create admin manually

2. **Configure Workflows**:
   - Log in as admin
   - Set up initial workflows and configurations

3. **Test All Features**:
   - Create test courses
   - Verify email notifications (if configured)
   - Test file uploads (if S3 configured)

## Support

- Render Documentation: https://render.com/docs
- Aiven Documentation: https://docs.aiven.io
- TrainingPulse Issues: https://github.com/your-username/trainingpulse/issues