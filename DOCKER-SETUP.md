# Docker Setup Guide

This guide explains how to set up and run the Automotive AI Platform backend using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Node environment
NODE_ENV=development  # or 'production' for production environment

# Server port
PORT=5000

# MongoDB
MONGO_INITDB_ROOT_USERNAME=root
MONGO_INITDB_ROOT_PASSWORD=rootpassword

# Vector storage options
USE_LOCAL_STORAGE=true
USE_OPENAI_STORAGE=false
USE_DUAL_STORAGE=false
LOCAL_EMBEDDING_URL=http://localhost:8080/embed  # Change if using external embedding service

# API keys
OPENAI_API_KEY=your_openai_api_key  # Only needed if USE_OPENAI_STORAGE=true
```

## Running the Application

1. Build and start the containers:

```bash
docker-compose up -d
```

2. Stop the application:

```bash
docker-compose down
```

3. View logs:

```bash
docker-compose logs -f
```

## Accessing Services

- Backend API: http://localhost:5000
- Swagger API Documentation: http://localhost:5000/api-docs
- MongoDB: localhost:27017
- ChromaDB: http://localhost:8000
- Qdrant: http://localhost:6333

## Docker Networking

The application uses a bridge network named `app-network` to connect all services. The backend can communicate with other services using their service names as hostnames:

- MongoDB: `mongodb`
- ChromaDB: `chromadb`
- Qdrant: `qdrant`

## Volumes

The application uses the following persistent volumes:

- `mongodb_data`: MongoDB data
- `chroma_data`: ChromaDB vector database
- `qdrant_data`: Qdrant vector database

## Development vs Production

For development:
- Set `NODE_ENV=development`
- Map your local code directory to the container for hot-reloading:
  ```yaml
  volumes:
    - ./:/app
    - /app/node_modules
  ```

For production:
- Set `NODE_ENV=production`
- Use the optimized Docker image without source code mapping

## Integrating with Frontend

When setting up the frontend to connect to this backend:

1. Ensure your frontend container is on the same Docker network
2. Configure the frontend to connect to the backend using the service name (`backend`) as the hostname
3. Example docker-compose configuration for frontend:

```yaml
frontend:
  build: ../frontend
  container_name: frontend
  restart: unless-stopped
  ports:
    - "3000:3000"
  environment:
    - VITE_API_URL=http://backend:5000
  networks:
    - app-network
```

## Troubleshooting

- If services fail to start, check logs: `docker-compose logs -f <service-name>`
- To rebuild a service: `docker-compose build --no-cache <service-name>`
- To reset data and start fresh: `docker-compose down -v` (this will delete all volumes) 