#!/bin/bash

echo "🍳 Nommable Setup Script"
echo "========================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi
echo "✓ Node.js version: $(node -v)"

# Check Docker
echo ""
echo "Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found. Install Docker to use containerized setup."
else
    echo "✓ Docker version: $(docker --version)"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✓ Dependencies installed"

# Check if .env exists
echo ""
if [ ! -f "packages/backend/.env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp packages/backend/.env.example packages/backend/.env
    echo "✓ .env file created"
else
    echo "✓ .env file exists"
fi

# Start PostgreSQL with Docker
echo ""
echo "Starting PostgreSQL..."
docker-compose up -d postgres
if [ $? -ne 0 ]; then
    echo "❌ Failed to start PostgreSQL"
    echo "Please ensure Docker is running or install PostgreSQL manually"
    exit 1
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Build shared package
echo ""
echo "Building shared package..."
npm run build -w packages/shared
if [ $? -ne 0 ]; then
    echo "❌ Failed to build shared package"
    exit 1
fi
echo "✓ Shared package built"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the backend: npm run dev:backend"
echo "2. In a new terminal, start the frontend: npm run dev:frontend"
echo "3. Open http://localhost:5173 in your browser"
echo "4. Create an account and start cooking!"
echo ""
echo "For Docker deployment: docker-compose up -d"
