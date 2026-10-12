@echo off
REM Nommable - Build and Push Images Script (Windows)
REM This script builds Docker images locally and pushes them to a container registry

echo === Nommable Image Build and Push Script ===
echo.

if "%1"=="" (
    echo Error: Registry not specified
    echo Usage: build-and-push.bat ^<registry/username^> [version]
    echo.
    echo Examples:
    echo   build-and-push.bat dockerhub-username
    echo   build-and-push.bat ghcr.io/github-username
    echo   build-and-push.bat dockerhub-username v1.0.0
    echo.
    exit /b 1
)

set REGISTRY=%1
set VERSION=%2
if "%VERSION%"=="" set VERSION=latest

echo Registry: %REGISTRY%
echo Version: %VERSION%
echo.

REM Build images
echo Step 1: Building images...
docker-compose -f docker-compose.portainer.yml build --no-cache
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)

REM Tag images
echo.
echo Step 2: Tagging images...
docker tag nommable-backend:latest %REGISTRY%/nommable-backend:%VERSION%
docker tag nommable-frontend:latest %REGISTRY%/nommable-frontend:%VERSION%

if not "%VERSION%"=="latest" (
    docker tag nommable-backend:latest %REGISTRY%/nommable-backend:latest
    docker tag nommable-frontend:latest %REGISTRY%/nommable-frontend:latest
)

REM List images
echo.
echo Built images:
docker images | findstr /R "nommable REPOSITORY"

REM Push images
echo.
echo Step 3: Pushing images to registry...
echo Note: Make sure you're logged in to the registry first!
set /p CONFIRM=Continue with push? (y/n)

if /i "%CONFIRM%"=="y" (
    docker push %REGISTRY%/nommable-backend:%VERSION%
    docker push %REGISTRY%/nommable-frontend:%VERSION%

    if not "%VERSION%"=="latest" (
        docker push %REGISTRY%/nommable-backend:latest
        docker push %REGISTRY%/nommable-frontend:latest
    )

    echo.
    echo Images successfully pushed!
    echo.
    echo Use these images in your docker-compose.yml:
    echo   backend:
    echo     image: %REGISTRY%/nommable-backend:%VERSION%
    echo   frontend:
    echo     image: %REGISTRY%/nommable-frontend:%VERSION%
) else (
    echo.
    echo Push cancelled
)

echo.
echo Done!
