# Portainer Deployment Guide

This guide will help you deploy Nommable on Portainer.

## Prerequisites

- Portainer installed and running
- Access to your Portainer instance
- GitHub repository URL: https://github.com/mortegaux/nommable

## Deployment Steps

### Option 1: Deploy from Git Repository (Recommended)

1. **Navigate to Stacks in Portainer**
   - Go to your Portainer dashboard
   - Click on "Stacks" in the left menu
   - Click "Add stack"

2. **Configure Stack**
   - **Name**: `nommable`
   - **Build method**: Select "Repository"
   - **Repository URL**: `https://github.com/mortegaux/nommable`
   - **Repository reference**: `refs/heads/main`
   - **Compose path**: `docker-compose.yml`

3. **Set Environment Variables**

   Add these environment variables in the "Environment variables" section:

   ```env
   JWT_SECRET=your-super-secret-jwt-key-change-this-to-something-random-and-long
   ```

   **Important**: Change the JWT_SECRET to a long, random string for security!

4. **Deploy**
   - Click "Deploy the stack"
   - Wait for the build and deployment to complete

### Option 2: Deploy from Docker Compose File

1. **Copy docker-compose.yml content**

2. **Create Stack in Portainer**
   - Go to Stacks → Add stack
   - **Name**: `nommable`
   - **Build method**: Select "Web editor"
   - Paste the docker-compose.yml content

3. **Add Environment Variables**

   Same as Option 1 above.

4. **Deploy**

## Environment Variables Reference

### Required Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (none) | **REQUIRED** - Secret key for JWT tokens. Use a long random string |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PASSWORD` | `nommable_password` | PostgreSQL password |
| `DATABASE_USER` | `nommable` | PostgreSQL username |
| `DATABASE_NAME` | `nommable` | PostgreSQL database name |
| `OPENAI_API_KEY` | (none) | OpenAI API key (optional, can be configured per-user) |
| `ANTHROPIC_API_KEY` | (none) | Anthropic API key (optional, can be configured per-user) |
| `GOOGLE_AI_API_KEY` | (none) | Google AI API key (optional, can be configured per-user) |

## After Deployment

### 1. Check Stack Status

- Go to Stacks → nommable
- Verify all 3 services are running:
  - ✅ nommable-postgres (PostgreSQL database)
  - ✅ nommable-backend (API server)
  - ✅ nommable-frontend (Web interface)

### 2. Access the Application

- **Frontend**: `http://your-server-ip:3000`
- **Backend API**: `http://your-server-ip:3001`
- **Health Check**: `http://your-server-ip:3001/health`

### 3. Create Your First Account

1. Navigate to the frontend URL
2. Click "Sign Up"
3. Create your admin account
4. Start adding recipes!

## Troubleshooting

### Build Errors

If you see build errors:

1. **Check logs**: Click on the stack → View logs
2. **Common issues**:
   - Missing environment variables (add JWT_SECRET)
   - Port conflicts (change ports in docker-compose.yml)
   - Insufficient memory (Docker needs at least 2GB RAM for builds)

### Service Won't Start

1. **Check logs for each service**:
   ```
   Stacks → nommable → Container logs
   ```

2. **Common issues**:
   - PostgreSQL not ready: Wait 30 seconds and restart backend
   - Database connection error: Check DATABASE_* environment variables
   - Port already in use: Change ports in docker-compose.yml

### Database Issues

If database won't initialize:

1. Stop the stack
2. Remove the postgres volume: Volumes → postgres_data → Remove
3. Redeploy the stack

### Can't Access the Application

1. **Check ports are exposed**:
   - Frontend should be on port 3000
   - Backend should be on port 3001

2. **Check firewall rules**:
   - Ensure ports 3000 and 3001 are open
   - Check Docker network settings

3. **Verify services are running**:
   - All containers should show "running" status
   - Check container logs for errors

## Updating the Application

To update to the latest version:

1. Go to Stacks → nommable
2. Click "Pull and redeploy"
3. Wait for the update to complete

Or manually:

1. Stop the stack
2. Pull latest changes from GitHub
3. Start the stack again

## Custom Configuration

### Changing Ports

Edit the docker-compose.yml ports section:

```yaml
frontend:
  ports:
    - '8080:80'  # Change 3000 to 8080

backend:
  ports:
    - '8081:3001'  # Change 3001 to 8081
```

### Using External PostgreSQL

1. Remove the `postgres` service from docker-compose.yml
2. Set these environment variables in backend service:
   ```env
   DATABASE_HOST=your-postgres-host
   DATABASE_PORT=5432
   DATABASE_NAME=nommable
   DATABASE_USER=your-user
   DATABASE_PASSWORD=your-password
   ```

### Adding SSL/HTTPS

For production, use a reverse proxy (Nginx Proxy Manager, Traefik, or Caddy) in front of the frontend service:

1. Deploy reverse proxy in Portainer
2. Configure SSL certificate
3. Point proxy to `nommable-frontend:80`

## Security Recommendations

### Production Deployment

1. ✅ **Change JWT_SECRET** to a long random string
2. ✅ **Change database password** from default
3. ✅ **Use HTTPS** with valid SSL certificate
4. ✅ **Enable firewall** on your server
5. ✅ **Regular backups** of postgres_data volume
6. ✅ **Keep Docker images updated**

### Backup Strategy

**Database Backup:**
```bash
docker exec nommable-postgres pg_dump -U nommable nommable > backup.sql
```

**Restore:**
```bash
docker exec -i nommable-postgres psql -U nommable nommable < backup.sql
```

**Volume Backup:**
1. Go to Volumes → postgres_data
2. Use Portainer backup feature or Docker volume backup tools

## Support

If you encounter issues:

1. Check the logs in Portainer
2. Review the main README.md for configuration options
3. Check GitHub issues: https://github.com/mortegaux/nommable/issues
4. Verify environment variables are set correctly

## Next Steps

After successful deployment:

1. Create your first user account
2. (Optional) Configure AI settings in the app
3. Import your first recipe
4. Create a meal plan
5. Generate a shopping list

Happy cooking! 👨‍🍳👩‍🍳
