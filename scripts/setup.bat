@echo off
echo 🍳 Nommable Setup Script
echo ========================
echo.

REM Check Node.js
echo Checking Node.js version...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js 18+
    exit /b 1
)
echo ✓ Node.js installed

REM Check Docker
echo.
echo Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Docker not found. Install Docker to use containerized setup.
) else (
    echo ✓ Docker installed
)

REM Install dependencies
echo.
echo Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    exit /b 1
)
echo ✓ Dependencies installed

REM Check .env file
echo.
if not exist "packages\backend\.env" (
    echo ⚠️  .env file not found. Creating from .env.example...
    copy packages\backend\.env.example packages\backend\.env
    echo ✓ .env file created
) else (
    echo ✓ .env file exists
)

REM Start PostgreSQL
echo.
echo Starting PostgreSQL...
docker-compose up -d postgres
if %errorlevel% neq 0 (
    echo ❌ Failed to start PostgreSQL
    echo Please ensure Docker is running or install PostgreSQL manually
    exit /b 1
)

REM Wait for PostgreSQL
echo Waiting for PostgreSQL to be ready...
timeout /t 5 /nobreak >nul

REM Build shared package
echo.
echo Building shared package...
call npm run build -w packages/shared
if %errorlevel% neq 0 (
    echo ❌ Failed to build shared package
    exit /b 1
)
echo ✓ Shared package built

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Start the backend: npm run dev:backend
echo 2. In a new terminal, start the frontend: npm run dev:frontend
echo 3. Open http://localhost:5173 in your browser
echo 4. Create an account and start cooking!
echo.
echo For Docker deployment: docker-compose up -d
