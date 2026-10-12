# Nommable Portainer Setup - Complete Guide

## ✅ What Was Fixed

All Docker build issues have been resolved:

1. ✅ Added missing `concurrently` dependency
2. ✅ Fixed native module builds (canvas, etc.)
3. ✅ Added TypeScript type definitions
4. ✅ Optimized memory usage for builds
5. ✅ Created Portainer-specific configuration
6. ✅ Added build scripts for pre-built images

## 🎯 Two Deployment Options

### Option 1: Build in Portainer (Easiest)

**Best for**: Hosts with 4GB+ RAM

1. Push your code to Git (GitHub, GitLab, etc.)
2. In Portainer:
   - Stacks → Add stack
   - Name: `nommable`
   - Build method: **Repository**
   - Repository URL: `https://github.com/your-username/nommable`
   - Compose path: `docker-compose.portainer.yml`
   - Add environment variables (see below)
   - Deploy!

**Environment Variables to Add**:
```env
DATABASE_PASSWORD=your-secure-db-password
JWT_SECRET=your-secret-key-at-least-32-chars
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-admin-password
CORS_ORIGIN=http://your-domain.com:8765
```

### Option 2: Use Pre-Built Images (Recommended for Production)

**Best for**: Resource-constrained hosts or production deployments

1. **Build images locally** (where you have resources):

   **Windows**:
   ```batch
   build-and-push.bat your-dockerhub-username
   ```

   **Linux/Mac**:
   ```bash
   ./build-and-push.sh your-dockerhub-username
   ```

2. **Create docker-compose file for Portainer**:

   Copy this to Portainer's Web editor:

   ```yaml
   services:
     postgres:
       image: postgres:16-alpine
       container_name: nommable-postgres
       environment:
         POSTGRES_DB: nommable
         POSTGRES_USER: nommable
         POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
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
         DATABASE_PASSWORD: ${DATABASE_PASSWORD}
         JWT_SECRET: ${JWT_SECRET}
         JWT_EXPIRES_IN: 7d
         ADMIN_USERNAME: ${ADMIN_USERNAME}
         ADMIN_PASSWORD: ${ADMIN_PASSWORD}
         CORS_ORIGIN: ${CORS_ORIGIN}
       ports:
         - '8766:3001'
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
         - '8765:80'
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

3. **Deploy in Portainer** with the same environment variables as Option 1

## 🔐 Production Environment Variables

**Required for Production**:

```env
# Database Security
DATABASE_PASSWORD=<generate-strong-password>

# JWT Security (32+ characters)
JWT_SECRET=<generate-random-32-char-string>

# Admin Account
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<generate-strong-password>

# CORS (Update to your actual domain!)
CORS_ORIGIN=https://yourdomain.com
```

**Optional**:

```env
# Custom Ports (if needed)
FRONTEND_PORT=8765
BACKEND_PORT=8766
```

## 🔧 Generate Secure Secrets

### For JWT_SECRET (use one of these):

**Windows (PowerShell)**:
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

**Linux/Mac**:
```bash
openssl rand -base64 32
```

**Online**: https://www.grc.com/passwords.htm (use the "63 random printable ASCII characters" option)

### For Passwords:

Use a password manager or:
```bash
openssl rand -base64 24
```

## 📝 Step-by-Step Portainer Deployment

### Using Git Repository (Option 1)

1. **Commit and Push Your Code**:
   ```bash
   git add .
   git commit -m "Configure for Portainer deployment"
   git push origin main
   ```

2. **Open Portainer**:
   - Navigate to your Portainer instance
   - Go to **Stacks** → **Add stack**

3. **Configure Stack**:
   - Name: `nommable`
   - Build method: **Repository**
   - Repository URL: `https://github.com/your-username/nommable`
   - Repository reference: `main`
   - Compose path: `docker-compose.portainer.yml`

4. **Add Environment Variables**:
   Click "Add an environment variable" for each:
   - Name: `DATABASE_PASSWORD`, Value: `<your-secure-password>`
   - Name: `JWT_SECRET`, Value: `<your-32-char-secret>`
   - Name: `ADMIN_USERNAME`, Value: `admin`
   - Name: `ADMIN_PASSWORD`, Value: `<your-secure-password>`
   - Name: `CORS_ORIGIN`, Value: `http://your-portainer-host:8765`

5. **Deploy**:
   - Click **Deploy the stack**
   - Wait 5-10 minutes for build to complete
   - Monitor progress in Portainer logs

6. **Access Your App**:
   - Frontend: `http://your-portainer-host:8765`
   - Login with your `ADMIN_USERNAME` and `ADMIN_PASSWORD`

### Using Pre-Built Images (Option 2)

1. **Build and Push Images Locally**:
   ```bash
   # Login to Docker Hub first
   docker login

   # Build and push (Windows)
   build-and-push.bat your-dockerhub-username

   # Or on Linux/Mac
   ./build-and-push.sh your-dockerhub-username
   ```

2. **In Portainer**:
   - Stacks → Add stack
   - Name: `nommable`
   - Build method: **Web editor**
   - Paste the docker-compose from Option 2 above
   - Replace `your-dockerhub-username` with your actual username

3. **Add Environment Variables** (same as Option 1)

4. **Deploy** (instant - no build time!)

5. **Access Your App** (same as Option 1)

## 🚨 Troubleshooting

### Build Fails with "JavaScript heap out of memory"

**Solution**: Your Portainer host needs more RAM. Use **Option 2** (pre-built images) instead.

### Build Fails with "npm install failed"

**Solution**:
1. Check Portainer host has internet access
2. Try rebuilding: Stack → Update → Enable "Re-pull and redeploy"
3. Or use **Option 2** (pre-built images)

### Can't Access After Deployment

**Check**:
1. All containers are running: Stack → Containers (should see 3 green containers)
2. Backend logs: Click on `nommable-backend` container → Logs
3. Frontend logs: Click on `nommable-frontend` container → Logs
4. Firewall allows ports 8765 and 8766

### Login Doesn't Work

**Solution**:
1. Check `ADMIN_PASSWORD` in environment variables
2. View backend logs for errors
3. Try resetting: Stop stack, delete volumes, redeploy

## 📊 Monitoring Your Deployment

In Portainer, you can:

1. **View Container Stats**: Containers → Click container → Stats tab
2. **View Logs**: Containers → Click container → Logs tab
3. **Restart Services**: Containers → Click container → Restart button
4. **Update Stack**: Stacks → Click stack → Update button

## 🔄 Updating Your Application

### For Git Repository Method:
1. Commit changes to Git
2. Push to repository
3. In Portainer: Stack → Update → Enable "Re-pull and redeploy" → Update

### For Pre-Built Images Method:
1. Rebuild and push images locally
2. In Portainer: Stack → Update → Enable "Re-pull and redeploy" → Update

## 📚 Additional Resources

- **[README.docker.md](README.docker.md)** - Quick reference
- **[PORTAINER.md](PORTAINER.md)** - Complete Portainer guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - General deployment docs

## ✅ Deployment Checklist

Before deploying to production:

- [ ] Generated secure `DATABASE_PASSWORD`
- [ ] Generated secure `JWT_SECRET` (32+ chars)
- [ ] Set strong `ADMIN_PASSWORD`
- [ ] Updated `CORS_ORIGIN` to actual domain
- [ ] Committed code to Git repository
- [ ] Tested build locally first
- [ ] Configured firewall rules
- [ ] Set up SSL/HTTPS (using reverse proxy)
- [ ] Configured backup for PostgreSQL
- [ ] Documented credentials securely

## 🎉 You're Ready!

You now have everything needed to deploy Nommable to Portainer successfully. Choose your deployment option and follow the steps above.

**Recommended**: Start with **Option 1** (Git repository). If it fails due to memory, switch to **Option 2** (pre-built images).

Good luck! 🚀
