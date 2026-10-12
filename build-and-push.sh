#!/bin/bash

# Nirugisa - Build and Push Images Script
# This script builds Docker images locally and pushes them to a container registry

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Nirugisa Image Build and Push Script ===${NC}\n"

# Check if registry is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Registry not specified${NC}"
    echo "Usage: ./build-and-push.sh <registry/username>"
    echo ""
    echo "Examples:"
    echo "  ./build-and-push.sh dockerhub-username"
    echo "  ./build-and-push.sh ghcr.io/github-username"
    echo ""
    exit 1
fi

REGISTRY=$1
VERSION=${2:-latest}

echo -e "${YELLOW}Registry:${NC} $REGISTRY"
echo -e "${YELLOW}Version:${NC} $VERSION"
echo ""

# Build images
echo -e "${GREEN}Step 1: Building images...${NC}"
docker-compose -f docker-compose.portainer.yml build --no-cache

# Tag images
echo -e "\n${GREEN}Step 2: Tagging images...${NC}"
docker tag nirugisa-backend:latest $REGISTRY/nirugisa-backend:$VERSION
docker tag nirugisa-frontend:latest $REGISTRY/nirugisa-frontend:$VERSION

if [ "$VERSION" != "latest" ]; then
    docker tag nirugisa-backend:latest $REGISTRY/nirugisa-backend:latest
    docker tag nirugisa-frontend:latest $REGISTRY/nirugisa-frontend:latest
fi

# List images
echo -e "\n${GREEN}Built images:${NC}"
docker images | grep -E "(nirugisa|REPOSITORY)"

# Push images
echo -e "\n${GREEN}Step 3: Pushing images to registry...${NC}"
echo -e "${YELLOW}Note: Make sure you're logged in to the registry first!${NC}"
read -p "Continue with push? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker push $REGISTRY/nirugisa-backend:$VERSION
    docker push $REGISTRY/nirugisa-frontend:$VERSION

    if [ "$VERSION" != "latest" ]; then
        docker push $REGISTRY/nirugisa-backend:latest
        docker push $REGISTRY/nirugisa-frontend:latest
    fi

    echo -e "\n${GREEN}✓ Images successfully pushed!${NC}"
    echo ""
    echo "Use these images in your docker-compose.yml:"
    echo "  backend:"
    echo "    image: $REGISTRY/nirugisa-backend:$VERSION"
    echo "  frontend:"
    echo "    image: $REGISTRY/nirugisa-frontend:$VERSION"
else
    echo -e "\n${YELLOW}Push cancelled${NC}"
fi

echo -e "\n${GREEN}Done!${NC}"
