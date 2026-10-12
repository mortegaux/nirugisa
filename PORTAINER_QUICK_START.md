# Portainer Quick Start - After Fix

The Docker build error has been fixed. Follow these steps to deploy:

## ✅ What Was Fixed

- Added `package-lock.json` (required for `npm ci`)
- Dockerfiles now properly use `npm install` for monorepo builds
- Fixed TypeScript compilation error in jwt.sign() with type assertion
- Upgraded Docker images from Node 18 to Node 20 (required by undici/cheerio dependencies)
- Enabled database auto-sync (tables created automatically on first run)
- Added database connection retry logic (handles postgres startup delays)
- Fixed backend network binding (now listens on 0.0.0.0 for container-to-container communication)
- All dependencies properly configured
- Docker build and runtime now work successfully

## 🚀 Deploy in Portainer (After Fixing)

### Step 1: Remove Old Stack (If Exists)

If you already tried to deploy and it failed:

1. Go to **Stacks** in Portainer
2. Find the `nommable` stack (if it exists)
3. Click **Delete** to remove it completely
4. Go to **Images** and remove any nommable-related images
5. This ensures Portainer doesn't use cached broken builds

### Step 2: Deploy Fresh Stack

1. **Go to Stacks → Add stack**

2. **Stack Configuration:**
   - **Name**: `nommable`
   - **Build method**: Select **"Repository"**
   - **Repository URL**: `https://github.com/mortegaux/nommable`
   - **Repository reference**: `refs/heads/main`
   - **Compose path**: `docker-compose.yml`
   - **Enable automatic updates**: Optional (re-pull image automatically)

3. **Environment Variables**: No configuration needed! All defaults are pre-configured in docker-compose.yml

4. **Click "Deploy the stack"**

5. **Wait for Build** (5-10 minutes for first build)
   - You can monitor progress in the logs
   - The build will compile TypeScript code
   - Don't worry if it takes several minutes

### Step 3: Verify Deployment

Once deployed, check all services are running:

**In Portainer:**
- Go to **Stacks → nommable**
- You should see 3 containers:
  - ✅ `nommable-postgres` (running)
  - ✅ `nommable-backend` (running)
  - ✅ `nommable-frontend` (running)

**Check Container Logs:**
1. Click on each container
2. Click "Logs"
3. Look for:
   - Postgres: "database system is ready to accept connections"
   - Backend: "✓ Server running on http://localhost:3001" (internal port)
   - Frontend: Should show nginx startup messages

### Step 4: Access Your Application

**Find your server's IP address**, then:

- **Frontend**: `http://YOUR_SERVER_IP:8765`
- **Backend API**: `http://YOUR_SERVER_IP:8766/health`

If you're on the same machine as Portainer:
- Frontend: `http://localhost:8765`
- Backend: `http://localhost:8766/health`

### Step 5: First Use

1. Open the frontend URL in your browser
2. **Login with default admin account:**
   - **Username**: `admin`
   - **Password**: `admin`
3. You're in! The admin account is automatically created on first startup
4. **IMPORTANT**: Change the admin password in Settings after first login

**Note**: You can change the default admin credentials by setting these environment variables in docker-compose.yml:
- `ADMIN_USERNAME` (default: admin)
- `ADMIN_PASSWORD` (default: admin)

**Invitation-Only Registration**: Public registration is disabled. Only the admin can invite new users:
- Go to Settings → User Management
- Enter the email and role for the new user
- The invitation link will be shown in the backend console logs
- Share the link with the invited user to complete registration

## 🔧 Troubleshooting

### Build Still Fails

**Clear Docker cache:**
1. Delete the stack
2. Go to **Images** → Delete all nommable images
3. Go to **Volumes** → Delete `nommable_postgres_data` volume (only if starting fresh)
4. Try deploying again

### Backend Won't Start

**Check logs for database connection errors:**
```
Stacks → nommable → nommable-backend → Logs
```

**Common fix:**
- Wait 30-60 seconds for PostgreSQL to fully initialize
- Restart the backend container: Click container → Restart

### Can't Access Frontend

**Check ports:**
1. Ensure ports 8765 and 8766 are not in use
2. Check your server's firewall allows these ports
3. Try accessing via `http://SERVER_IP:8765` (not localhost)

**Check if containers are running:**
```
Stacks → nommable → All containers should show "running"
```

### Permission Denied Errors

**If you see permission errors in logs:**
1. Check the uploads volume permissions
2. You may need to create the uploads directory:
   ```bash
   mkdir -p uploads
   chmod 777 uploads
   ```

## 🎯 Expected Build Output

During deployment, you should see:

```
Step 1/X : FROM node:18-alpine
Step 2/X : WORKDIR /app
Step 3/X : COPY package*.json ./
...
Step X/X : RUN npm ci --workspaces
✓ Successfully built
✓ Successfully tagged
```

The build creates:
- `nommable-backend` image (~300-400 MB)
- `nommable-frontend` image (~50-100 MB)

## 📊 Resource Requirements

Minimum requirements for smooth operation:
- **RAM**: 2GB (4GB recommended)
- **CPU**: 1 core (2+ cores recommended)
- **Disk**: 5GB (for Docker images, database, and uploads)

## 🔐 Production Checklist

Before using in production:

- [ ] Change admin password from default (`changeme123`) - do this in Settings or update ADMIN_PASSWORD in docker-compose.yml
- [ ] Change JWT_SECRET in docker-compose.yml (generate with `openssl rand -base64 48`)
- [ ] Change PostgreSQL password from default in docker-compose.yml
- [ ] Set up HTTPS with reverse proxy (Nginx Proxy Manager, Traefik, Caddy)
- [ ] Configure firewall rules
- [ ] Set up regular database backups
- [ ] Review security settings
- [ ] Update CORS_ORIGIN to match your frontend domain

## 📝 Quick Commands Reference

**View all containers:**
```
Stacks → nommable
```

**View logs:**
```
Stacks → nommable → Click container → Logs
```

**Restart a service:**
```
Stacks → nommable → Click container → Restart
```

**Update to latest version:**
```
Stacks → nommable → Pull and redeploy
```

## ✅ Success Indicators

You'll know it's working when:

1. ✅ All 3 containers show "running" status
2. ✅ Backend logs show: "✓ Server running on http://localhost:3001"
3. ✅ You can access http://YOUR_IP:8765
4. ✅ You can create an account and log in
5. ✅ Health check returns: http://YOUR_IP:8766/health → `{"status":"ok"}`

## 🆘 Still Having Issues?

1. **Check Portainer logs**: Stacks → nommable → View logs
2. **Check GitHub**: https://github.com/mortegaux/nommable/issues
3. **Verify latest commit**: Make sure Portainer pulled the latest code (commit 9856aa8 or later)
4. **Try local Docker first** to rule out Portainer issues:
   ```bash
   git clone https://github.com/mortegaux/nommable
   cd nommable
   docker-compose up
   ```

---

**Latest Commit**: `e77413d` - "Fix 502 Bad Gateway - backend now listens on all interfaces"

If this commit is not in your deployment, Portainer may have cached the old version. Delete the stack completely and redeploy.

Good luck! 🎉
