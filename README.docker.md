# Nommable Docker Quick Start

This is a quick reference for deploying Nommable with Docker.

## 🚀 Local Development (5 minutes)

```bash
# Clone and start
git clone <your-repo-url>
cd nommable
docker-compose up -d

# Access at http://localhost:8765
# Login: admin / admin
```

## 📦 Portainer Deployment

**See the detailed guide**: [PORTAINER.md](PORTAINER.md)

### Quick Portainer Deploy

1. **In Portainer**: Stacks → Add stack
2. **Name**: `nommable`
3. **Build method**: Repository
4. **Repository URL**: Your Git repo URL
5. **Compose path**: `docker-compose.portainer.yml`
6. **Environment variables**:
   ```env
   DATABASE_PASSWORD=your-secure-password
   JWT_SECRET=your-secret-key-32-chars-minimum
   ADMIN_PASSWORD=your-admin-password
   CORS_ORIGIN=http://your-domain.com:8765
   ```
7. **Deploy!**

### If Build Fails in Portainer

Use pre-built images instead:

```bash
# Build locally
./build-and-push.bat your-dockerhub-username
# or on Linux/Mac:
./build-and-push.sh your-dockerhub-username

# Then deploy using pre-built images (see PORTAINER.md)
```

## 📁 Files Overview

- **docker-compose.yml** - For local development
- **docker-compose.portainer.yml** - For Portainer deployment (optimized)
- **PORTAINER.md** - Complete Portainer deployment guide
- **DEPLOYMENT.md** - General deployment documentation
- **build-and-push.sh/.bat** - Scripts to build and push images

## 🔧 Environment Variables

All environment variables are optional with defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PASSWORD` | `nommable_password` | PostgreSQL password |
| `JWT_SECRET` | `auto-generated` | JWT signing key |
| `ADMIN_USERNAME` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `admin` | Initial admin password |
| `CORS_ORIGIN` | `http://localhost:8765` | Frontend URL |
| `FRONTEND_PORT` | `8765` | Frontend port |
| `BACKEND_PORT` | `8766` | Backend API port |

## 🐳 Useful Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild images
docker-compose build --no-cache

# View running containers
docker-compose ps

# Access database
docker-compose exec postgres psql -U nommable nommable
```

## 📊 Default Ports

- Frontend: **http://localhost:8765**
- Backend API: **http://localhost:8766**
- PostgreSQL: **localhost:5432** (internal)

## 🔒 Security Checklist

Before deploying to production:

- [ ] Change `DATABASE_PASSWORD`
- [ ] Change `JWT_SECRET`
- [ ] Change `ADMIN_PASSWORD`
- [ ] Update `CORS_ORIGIN` to your domain
- [ ] Set up HTTPS/SSL
- [ ] Configure backups
- [ ] Review firewall rules

## 🆘 Troubleshooting

### "Can't login with admin/admin"

1. Check services are running: `docker-compose ps`
2. View backend logs: `docker-compose logs backend`
3. Verify admin user exists:
   ```bash
   docker-compose exec postgres psql -U nommable nommable -c "SELECT username FROM users WHERE is_system_admin = true;"
   ```

### "Build fails with memory error"

- Increase Docker memory in Docker Desktop settings
- Or use pre-built images (see PORTAINER.md)

### "Can't access frontend"

- Check if port 8765 is available
- View frontend logs: `docker-compose logs frontend`
- Try accessing directly: `http://localhost:8765`

## 📚 More Documentation

- **[PORTAINER.md](PORTAINER.md)** - Detailed Portainer deployment guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - General deployment documentation
- **[CLAUDE.md](CLAUDE.md)** - Development guide and architecture

## 🎯 Quick Access URLs

After deployment:

- **Frontend**: http://your-host:8765
- **API Docs**: http://your-host:8766/api/docs (Swagger)
- **Health Check**: http://your-host:8766/api/health

---

**Need help?** Check [PORTAINER.md](PORTAINER.md) for detailed troubleshooting!
