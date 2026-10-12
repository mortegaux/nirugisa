# Nommable Deployment Guide

This guide covers deploying Nommable both locally and in Portainer.

> **📘 Deploying to Portainer?** See the dedicated [PORTAINER.md](PORTAINER.md) guide for Portainer-specific instructions, troubleshooting, and optimization tips.

## Prerequisites

- Docker and Docker Compose installed
- Git (to clone the repository)
- For Portainer: A running Portainer instance (see [PORTAINER.md](PORTAINER.md))

## Quick Start (Local Development)

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd nommable
   ```

2. Build and start all services:
   ```bash
   docker-compose up -d
   ```

3. Access the application:
   - Frontend: http://localhost:8765
   - Backend API: http://localhost:8766
   - Default admin credentials: `admin` / `admin`

4. View logs:
   ```bash
   docker-compose logs -f
   ```

5. Stop services:
   ```bash
   docker-compose down
   ```

## Deployment to Portainer

### Method 1: Git Repository (Recommended)

1. Push your code to a Git repository (GitHub, GitLab, Bitbucket, etc.)

2. In Portainer:
   - Go to **Stacks** → **Add stack**
   - Name: `nommable`
   - Build method: **Repository**
   - Repository URL: Your Git repository URL
   - Repository reference: `main` (or your branch name)
   - Compose path: `docker-compose.yml`
   - Click **Deploy the stack**

3. Portainer will automatically:
   - Clone the repository
   - Build the Docker images
   - Start all services

### Method 2: Upload docker-compose.yml

1. In Portainer:
   - Go to **Stacks** → **Add stack**
   - Name: `nommable`
   - Build method: **Web editor**
   - Copy and paste the contents of `docker-compose.yml`
   - Click **Deploy the stack**

2. Note: This method requires the repository to be available on the Portainer host for building images.

### Method 3: Pre-built Images

If you want to avoid building on Portainer:

1. Build images locally:
   ```bash
   docker-compose build
   ```

2. Tag and push to a registry (Docker Hub, GitHub Container Registry, etc.):
   ```bash
   docker tag nommable-backend your-registry/nommable-backend:latest
   docker tag nommable-frontend your-registry/nommable-frontend:latest
   docker push your-registry/nommable-backend:latest
   docker push your-registry/nommable-frontend:latest
   ```

3. Update `docker-compose.yml` to use the registry images:
   ```yaml
   backend:
     image: your-registry/nommable-backend:latest
     # Remove the 'build' section

   frontend:
     image: your-registry/nommable-frontend:latest
     # Remove the 'build' section
   ```

4. Deploy in Portainer using Method 1 or 2 above.

## Configuration

### Environment Variables

You can customize the deployment by modifying environment variables in `docker-compose.yml`:

#### Backend Configuration

```yaml
environment:
  NODE_ENV: production
  HOST: 0.0.0.0
  PORT: 3001
  DATABASE_HOST: postgres
  DATABASE_PORT: 5432
  DATABASE_NAME: nommable
  DATABASE_USER: nommable
  DATABASE_PASSWORD: nommable_password  # Change this!
  JWT_SECRET: your-secret-here  # Change this!
  JWT_EXPIRES_IN: 7d
  ADMIN_USERNAME: admin  # Change this!
  ADMIN_PASSWORD: admin  # Change this!
  CORS_ORIGIN: http://localhost:8765  # Update for production!
```

#### PostgreSQL Configuration

```yaml
environment:
  POSTGRES_DB: nommable
  POSTGRES_USER: nommable
  POSTGRES_PASSWORD: nommable_password  # Change this!
```

### Port Configuration

Default ports:
- Frontend: 8765 → 80 (nginx)
- Backend: 8766 → 3001 (Node.js)
- PostgreSQL: 5432 → 5432 (internal only, not exposed by default)

To change ports, modify the `ports` section in `docker-compose.yml`:

```yaml
frontend:
  ports:
    - '3000:80'  # Changes frontend to port 3000

backend:
  ports:
    - '4000:3001'  # Changes backend to port 4000
```

## Production Deployment Checklist

Before deploying to production:

- [ ] Change `ADMIN_PASSWORD` to a strong password
- [ ] Change `JWT_SECRET` to a random secure string
- [ ] Change `DATABASE_PASSWORD` to a strong password
- [ ] Update `CORS_ORIGIN` to your actual frontend URL
- [ ] Consider using environment files instead of inline values
- [ ] Set up SSL/TLS (use a reverse proxy like Traefik or Nginx)
- [ ] Set up automated backups for PostgreSQL
- [ ] Configure proper logging and monitoring
- [ ] Review and adjust resource limits if needed

## Using Environment Files

For better security, use environment files:

1. Create `.env` file in the root directory:
   ```env
   DATABASE_PASSWORD=your-secure-password
   JWT_SECRET=your-jwt-secret
   ADMIN_PASSWORD=your-admin-password
   CORS_ORIGIN=https://your-domain.com
   ```

2. Update `docker-compose.yml` to use environment files:
   ```yaml
   backend:
     env_file:
       - .env
     environment:
       DATABASE_PASSWORD: ${DATABASE_PASSWORD}
       JWT_SECRET: ${JWT_SECRET}
       ADMIN_PASSWORD: ${ADMIN_PASSWORD}
       CORS_ORIGIN: ${CORS_ORIGIN}
   ```

3. Add `.env` to `.gitignore` to avoid committing secrets

## Troubleshooting

### Build Failures

**Issue**: npm install fails with native module errors

**Solution**: The Dockerfiles already include the necessary build dependencies. If you still see errors, ensure you're using the latest version of the code.

**Issue**: TypeScript compilation errors

**Solution**: Make sure all dependencies are up to date. Run `npm install` locally first to verify.

### Runtime Issues

**Issue**: Backend can't connect to database

**Solution**:
- Check that PostgreSQL is healthy: `docker-compose ps`
- Verify DATABASE_HOST matches the postgres service name
- Check DATABASE_PASSWORD matches between services

**Issue**: Frontend shows "Network Error"

**Solution**:
- Verify CORS_ORIGIN is set correctly in backend
- Check backend is accessible at the configured URL
- Review backend logs: `docker-compose logs backend`

### Portainer-Specific Issues

**Issue**: Build fails in Portainer but works locally

**Solution**:
- Portainer needs sufficient resources (CPU, RAM) for building
- Consider using pre-built images (Method 3 above)
- Check Portainer logs for specific error messages

**Issue**: Stack won't start

**Solution**:
- Check that all required ports are available
- Verify no other stacks are using the same port numbers
- Review the Portainer event logs for the stack

## Updating the Application

### Local Development

```bash
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Portainer (Git Repository Method)

1. Go to your stack in Portainer
2. Click **Update the stack**
3. Enable **Pull latest image version**
4. Enable **Re-pull image and redeploy**
5. Click **Update**

### Manual Update in Portainer

```bash
# On your local machine
git pull
docker-compose build --no-cache
docker tag nommable-backend your-registry/nommable-backend:latest
docker tag nommable-frontend your-registry/nommable-frontend:latest
docker push your-registry/nommable-backend:latest
docker push your-registry/nommable-frontend:latest
```

Then in Portainer, pull the new images and redeploy the stack.

## Backup and Restore

### Backup Database

```bash
docker-compose exec postgres pg_dump -U nommable nommable > backup.sql
```

### Restore Database

```bash
docker-compose exec -T postgres psql -U nommable nommable < backup.sql
```

### Backup Uploaded Files

```bash
docker cp nommable-backend:/app/uploads ./uploads-backup
```

## Monitoring

View container status:
```bash
docker-compose ps
```

View logs:
```bash
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

Check resource usage:
```bash
docker stats
```

## Support

For issues and questions:
- Check the main [README.md](README.md) for application usage
- Review [CLAUDE.md](CLAUDE.md) for development information
- Report bugs on GitHub Issues
