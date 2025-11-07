# All-in-One Docker Container

This Docker image contains everything needed to run the autoshop system:
- Node.js backend application
- MongoDB database
- Redis cache
- ChromaDB vector database

## Building and Pushing to Docker Hub

```bash
# Build the all-in-one image
docker build -t robertsloan2023mit/autoshop-backend:latest .

# Push to Docker Hub
docker push robertsloan2023mit/autoshop-backend:latest
```

## Running on Any Machine (Simple)

**Just pull and run - that's it!**

```bash
# Pull and run the complete system
docker run -d \
  --name autoshop-system \
  -p 5005:5005 \
  -p 3001:3001 \
  -p 27017:27017 \
  -p 6379:6379 \
  -p 8000:8000 \
  robertsloan2023mit/autoshop-backend:latest
```

The container will automatically:
1. Start MongoDB on port 27017
2. Start Redis on port 6379  
3. Start ChromaDB on port 8000
4. Start the Node.js app on ports 5005 and 3001

**That's it!** No compose files, no dependencies, no setup required.

That's it! The application will:
- Pull your image from Docker Hub
- Start all services (backend, MongoDB, Redis, ChromaDB)
- Be accessible on port 5005

## What's Included in the Image

- All environment variables are built into the Docker image
- All application code and dependencies
- Python requirements and Node.js packages
- No local files or volumes are needed

## Ports

- **5005**: Main application
- **3001**: Secondary port (if used)
- **27017**: MongoDB
- **6379**: Redis  
- **8000**: ChromaDB

## Health Checks

All services have health checks configured. The application will only start when all dependencies are healthy.