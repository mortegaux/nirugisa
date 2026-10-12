# Nommable Portainer Deployment Guide

This guide covers deploying Nommable specifically in Portainer, with solutions for common build issues.

## Prerequisites

- Portainer instance running (Community or Business Edition)
- Git repository with your Nommable code
- At least 2GB RAM available for building (4GB recommended)
- Docker host with sufficient disk space (~5GB for images)

## Quick Deploy (Recommended)

### Method 1: Using Git Repository

1. **Prepare Your Repository**
   - Commit all changes to your Git repository
   - Push to GitHub, GitLab, Bitbucket, or any Git hosting service

2. **Deploy in Portainer**
   - Navigate to **Stacks** → **Add stack**
   - Name: `nommable`
   - Build method: **Repository**
   - Fill in repository details:
     ```
     Repository URL: https://github.com/your-username/nommable
     Repository reference: main
     Compose path: docker-compose.portainer.yml
     ```

3. **Configure Environment Variables**

   In the "Environment variables" section, add:

   ```env
   DATABASE_PASSWORD=your-secure-db-password
   JWT_SECRET=your-secret-key-at-least-32-characters-long
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-admin-password
   CORS_ORIGIN=http://your-domain.com:8765
   ```

4. **Deploy**
   - Scroll down and click **Deploy the stack**
   - Portainer will clone, build, and start all services

5. **Access Your Application**
   - Frontend: `http://your-portainer-host:8765`
   - Backend API: `http://your-portainer-host:8766`
   - Login with your configured admin credentials

### Method 2: Using Web Editor (If Git Not Available)

1. **Copy docker-compose File**
   - Open `docker-compose.portainer.yml` from your repository
   - Copy all contents

2. **Create Stack in Portainer**
   - Navigate to **Stacks** → **Add stack**
   - Name: `nommable`
   - Build method: **Web editor**
   - Paste the docker-compose contents

3. **Upload Files** (Important!)

   Since Portainer needs the repository files for building, you'll need to:

   - Option A: Use Method 1 (Git Repository) - Much easier!
   - Option B: Pre-build images locally and push to a registry (see below)

## Troubleshooting Build Failures

### Issue: "npm install failed" or "JavaScript heap out of memory"

**Cause**: Insufficient memory during build

**Solutions**:

1. **Increase Docker Memory Limit**

   In Portainer, edit the stack and add to each build service:

   ```yaml
   backend:
     build:
       context: .
       dockerfile: packages/backend/Dockerfile
       args:
         - NODE_OPTIONS=--max-old-space-size=4096  # Increase from 2048 to 4096
   ```

2. **Build on a Larger Host**

   If your Portainer host is resource-constrained, build images locally and push to registry:

   ```bash
   # On your local machine with more resources
   docker-compose -f docker-compose.portainer.yml build

   # Tag for your registry
   docker tag nommable-backend:latest your-registry/nommable-backend:latest
   docker tag nommable-frontend:latest your-registry/nommable-frontend:latest

   # Push to registry
   docker push your-registry/nommable-backend:latest
   docker push your-registry/nommable-frontend:latest
   ```

   Then update your stack to use pre-built images:

   ```yaml
   backend:
     image: your-registry/nommable-backend:latest
     # Remove the 'build' section

   frontend:
     image: your-registry/nommable-frontend:latest
     # Remove the 'build' section
   ```

### Issue: "Canvas/native module build failed"

**Cause**: Missing build dependencies

**Solution**: The Dockerfiles already include all necessary dependencies. This error usually indicates:
- Build was interrupted mid-process
- Corrupted cache

**Fix**:
1. In Portainer, go to **Images**
2. Delete any partial `nommable-*` images
3. Redeploy the stack with "Re-pull image and redeploy" enabled

### Issue: "Failed to build: context canceled"

**Cause**: Build timeout

**Solution**:
1. Increase build timeout in Portainer settings
2. Or use pre-built images (see above)

### Issue: "TypeScript compilation errors"

**Cause**: Outdated dependencies or corrupted node_modules

**Solution**:
1. Ensure your `package-lock.json` is committed to the repository
2. Delete any cached layers in Portainer
3. Try building locally first to verify the code compiles

## Using Pre-Built Images (Recommended for Production)

For production deployments or resource-constrained environments, use pre-built images:

### 1. Build Images Locally

```bash
# Clone your repository
git clone https://github.com/your-username/nommable
cd nommable

# Build all images
docker-compose -f docker-compose.portainer.yml build --no-cache

# Test locally
docker-compose -f docker-compose.portainer.yml up -d

# If everything works, proceed to push
```

### 2. Push to Docker Hub

```bash
# Login to Docker Hub
docker login

# Tag images
docker tag nommable-backend:latest your-dockerhub-username/nommable-backend:latest
docker tag nommable-frontend:latest your-dockerhub-username/nommable-frontend:latest

# Push images
docker push your-dockerhub-username/nommable-backend:latest
docker push your-dockerhub-username/nommable-frontend:latest
```

### 3. Create Stack Using Pre-Built Images

Create a new file `docker-compose.prebuilt.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: nommable-postgres
    environment:
      POSTGRES_DB: nommable
      POSTGRES_USER: nommable
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-nommable_password}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U nommable']
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - nommable-network

  backend:
    image: your-dockerhub-username/nommable-backend:latest
    container_name: nommable-backend
    environment:
      NODE_ENV: production
      HOST: 0.0.0.0
      PORT: 3001
      DATABASE_HOST: postgres
      DATABASE_PORT: 5432
      DATABASE_NAME: nommable
      DATABASE_USER: nommable
      DATABASE_PASSWORD: ${DATABASE_PASSWORD:-nommable_password}
      JWT_SECRET: ${JWT_SECRET:-change-this-secret-key}
      JWT_EXPIRES_IN: 7d
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-admin}
      CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:8765}
    ports:
      - '${BACKEND_PORT:-8766}:3001'
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - uploads:/app/uploads
    networks:
      - nommable-network
    restart: unless-stopped

  frontend:
    image: your-dockerhub-username/nommable-frontend:latest
    container_name: nommable-frontend
    ports:
      - '${FRONTEND_PORT:-8765}:80'
    depends_on:
      - backend
    networks:
      - nommable-network
    restart: unless-stopped

volumes:
  postgres_data:
  uploads:

networks:
  nommable-network:
    driver: bridge
```

Deploy this in Portainer using the Web editor method.

## GitHub Container Registry Alternative

If you prefer GitHub Container Registry (ghcr.io):

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Tag images
docker tag nommable-backend:latest ghcr.io/your-github-username/nommable-backend:latest
docker tag nommable-frontend:latest ghcr.io/your-github-username/nommable-frontend:latest

# Push images
docker push ghcr.io/your-github-username/nommable-backend:latest
docker push ghcr.io/your-github-username/nommable-frontend:latest
```

Then use `ghcr.io/your-github-username/nommable-backend:latest` in your docker-compose file.

## Updating Your Deployment

### For Git Repository Method

1. Commit and push changes to your repository
2. In Portainer, go to your stack
3. Click **Update the stack**
4. Enable "Re-pull image and redeploy"
5. Click **Update**

### For Pre-Built Images Method

1. Build new images locally
2. Push to registry with same tags
3. In Portainer, go to your stack
4. Click **Update the stack**
5. Enable "Re-pull image and redeploy"
6. Click **Update**

## Resource Requirements

**Minimum**:
- 2 CPU cores
- 2GB RAM
- 10GB disk space

**Recommended**:
- 4 CPU cores
- 4GB RAM
- 20GB disk space

**For Building in Portainer**:
- Add +2GB RAM during build process
- Builds typically take 5-10 minutes depending on resources

## Security Checklist for Production

- [ ] Change `DATABASE_PASSWORD` to a strong password
- [ ] Change `JWT_SECRET` to a random 32+ character string
- [ ] Change `ADMIN_PASSWORD` to a strong password
- [ ] Update `CORS_ORIGIN` to your actual domain
- [ ] Use HTTPS (configure reverse proxy like Traefik or Nginx Proxy Manager)
- [ ] Set up regular database backups
- [ ] Restrict PostgreSQL port (remove from `ports:` section if not needed externally)
- [ ] Use Docker secrets for sensitive values (Portainer Business Edition)
- [ ] Enable Portainer access control
- [ ] Review and update container resource limits

## Monitoring Your Stack

In Portainer:

1. **View Logs**: Stack → Logs tab
2. **Container Stats**: Containers → Stats
3. **Health Checks**: Stack → Services (look for green checkmarks)

## Common Configuration Changes

### Change Ports

Edit environment variables in Portainer:
```env
FRONTEND_PORT=3000
BACKEND_PORT=4000
```

### Enable External PostgreSQL Access

Add to postgres service in stack:
```yaml
ports:
  - '5432:5432'
```

### Increase Upload Size Limit

Add to backend environment:
```yaml
MAX_FILE_SIZE=10485760  # 10MB in bytes
```

## Getting Help

If you encounter issues:

1. Check Portainer container logs for the failing service
2. Verify environment variables are set correctly
3. Ensure sufficient resources are available
4. Review this guide's troubleshooting section
5. Check the main [DEPLOYMENT.md](DEPLOYMENT.md) for general Docker issues

## Summary: Best Deployment Strategy

**For Resource-Constrained Hosts**:
- Use pre-built images from Docker Hub/GitHub Container Registry
- Build images on your local machine
- Deploy using `docker-compose.prebuilt.yml`

**For Adequate Resources (4GB+ RAM)**:
- Use Git repository method with `docker-compose.portainer.yml`
- Let Portainer build images directly
- Easier to maintain and update

**For Production**:
- Always use pre-built images for faster deployments
- Set up automated builds in CI/CD
- Use environment variables for all configuration
- Enable automatic security updates for base images
