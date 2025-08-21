# AI Autoshop System Backend API Documentation

This document provides a comprehensive overview of all available API endpoints in the AI Autoshop System Backend.

## Table of Contents

- [Authentication & User Management](#authentication--user-management)
- [Customer Management](#customer-management)
- [Vehicle Data Management](#vehicle-data-management)
- [Image Analysis & Processing](#image-analysis--processing)
- [Chat & Streaming Response Endpoints](#chat--streaming-response-endpoints)
- [Service & Invoice Management](#service--invoice-management)
- [Research & Information Retrieval](#research--information-retrieval)
- [Notes & Documentation](#notes--documentation)
- [3D Visualization & Diagrams](#3d-visualization--diagrams)
- [Parts & Technicians](#parts--technicians)
- [Eliza & LLM Integration](#eliza--llm-integration)
- [Proxy Services](#proxy-services)

## Authentication & User Management

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/auth/signup` | Register a new user | None |
| POST | `/api/auth/login` | Login a user and get authentication token | None |
| POST | `/api/auth/logout` | Logout the current user | None |
| POST | `/api/auth/refresh` | Refresh authentication token | None |
| GET | `/api/users/` | Get users for sidebar | Required (JWT) |

## Customer Management

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/api/customers/all` | Get all customers | Required (JWT) |
| GET | `/api/customers/search` | Search customers by query | Required (JWT) |
| GET | `/api/customers/search-by-name` | Search customers by name | Required (JWT) |
| GET | `/api/customers/search-by-lastname` | Search customers by last name | Required (JWT) |
| GET | `/api/customers/:id` | Get customer by ID | Required (JWT) |
| POST | `/api/customers/` | Create a new customer | Required (JWT) |
| PUT | `/api/customers/:id` | Update customer details | Required (JWT) |
| DELETE | `/api/customers/:id` | Delete a customer | Required (JWT) |
| GET | `/api/customers/:id/vehicles` | Get customer's vehicles | Required (JWT) |
| GET | `/api/customers/:id/invoices` | Get customer's invoices | Required (JWT) |
| PUT | `/api/customers/:id/with-vehicle` | Update customer with vehicle | Required (JWT) |

## Vehicle Data Management

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/api/vehicles/` | Get all vehicles | Required (JWT) |
| GET | `/api/vehicles/customer` | Get vehicles by customer name | Required (JWT) |
| GET | `/api/vehicles/:id` | Get vehicle by ID | Required (JWT) |
| POST | `/api/vehicles/` | Create a new vehicle | Required (JWT) |
| PUT | `/api/vehicles/:id` | Update vehicle details | Required (JWT) |
| DELETE | `/api/vehicles/:id` | Delete a vehicle | Required (JWT) |
| GET | `/api/vehicles/:id/service-history` | Get vehicle service history | Required (JWT) |
| GET | `/api/vehicles/invoices/recent` | Get recent vehicles with invoices | Required (JWT) |
| GET | `/api/vehicle-questions/` | Get vehicle related questions | Required (JWT) |
| GET | `/api/license-plate/` | Get information from license plate | Required (JWT) |
| GET | `/api/plate-to-vin/` | Convert license plate to VIN | Required (JWT) |

## Image Analysis & Processing

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/openai/upload-image` | Upload and process an image | None |
| POST | `/api/openai/dashboard-image` | Analyze image for dashboard with automotive expertise | None |
| POST | `/api/openai/explain-image` | Analyze image with automotive technical expertise | None |
| POST | `/api/openai/explain-image/annotated` | Analyze image with annotations | None |
| GET | `/api/openai/annotated-analyses/:originalConversationId` | Retrieve annotated analyses by conversation ID | None |
| GET | `/api/openai/annotated-analysis/:analysisId` | Retrieve specific annotated analysis | None |
| POST | `/api/openai/explain-image/batch-annotated` | Process multiple images with annotations | None |
| POST | `/api/images` | Save image metadata to database | Required (JWT) |
| GET | `/api/images` | Get all saved images | Required (JWT) |
| DELETE | `/api/images/:id` | Delete an image | Required (JWT) |

## Chat & Streaming Response Endpoints

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/responses/chat/stream` | Stream chat responses with vehicle and customer context | None |
| POST | `/api/responses/chat/stream-vehicle` | Stream chat responses with vehicle context | None |
| POST | `/api/responses/chat/stream-customer` | Stream chat responses with customer context | None |
| POST | `/api/v1/responses/` | Process turn-based responses | None |
| POST | `/api/conversations/` | Create a new conversation | Required (JWT) |
| GET | `/api/conversations/:id` | Get conversation by ID | Required (JWT) |
| GET | `/api/conversations/recent` | Get recent conversations | Required (JWT) |
| DELETE | `/api/conversations/:id` | Delete a conversation | Required (JWT) |
| GET | `/api/conversations/search` | Search conversations | Required (JWT) |
| GET | `/api/messages/` | Get messages for a conversation | Required (JWT) |

## Service & Invoice Management

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/invoices/create` | Create a new invoice | Required (JWT) |
| GET | `/api/invoices/recent` | Get recent invoices | Required (JWT) |
| GET | `/api/invoices/customer/:id` | Get invoices for a specific customer | Required (JWT) |
| GET | `/api/invoices/all` | Get all invoices | Required (JWT) |
| GET | `/api/invoices/:id` | Get invoice by ID | Required (JWT) |
| PUT | `/api/invoices/:id` | Update invoice | Required (JWT) |
| DELETE | `/api/invoices/:id` | Delete invoice | Required (JWT) |
| GET | `/api/services/` | Get all services | Required (JWT) |
| POST | `/api/appointments/` | Create a new appointment | Required (JWT) |
| GET | `/api/appointments/` | Get all appointments | Required (JWT) |

## Research & Information Retrieval

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/search/` | Search for information | Required (JWT) |
| POST | `/api/serper/` | Search using Serper API | Required (JWT) |
| GET | `/api/serp/` | Search using SERP API | Required (JWT) |
| GET | `/api/functions/` | Access external functions | Required (JWT) |
| GET | `/api/research/` | Access research data | Required (JWT) |
| GET | `/api/researchl/` | Access local research data | Required (JWT) |
| GET | `/api/embeddings/` | Access embeddings data | Required (JWT) |
| GET | `/api/dtc/` | Access DTC (Diagnostic Trouble Codes) information | Required (JWT) |

## Notes & Documentation

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/api/notes/:id` | Get notes by ID | Required (JWT) |
| POST | `/api/notes/` | Create new notes | Required (JWT) |
| PUT | `/api/notes/:id` | Update notes | Required (JWT) |
| DELETE | `/api/notes/:id` | Delete notes | Required (JWT) |

## 3D Visualization & Diagrams

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/blender/generate-scene` | Generate a 3D scene from diagram | None |
| GET | `/api/blender/scene-info` | Get scene information from Blender | None |
| GET | `/api/blender/object-info/:objectName` | Get object information from Blender | None |
| POST | `/api/blender/execute-code` | Execute custom Blender code | None |
| POST | `/api/diagram/` | Generate diagrams | None |

## Parts & Technicians

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| GET | `/api/parts/` | Get parts information | Required (JWT) |
| GET | `/api/technicians/` | Get technicians information | Required (JWT) |
| POST | `/api/technicians/` | Create a new technician | Required (JWT) |

## Eliza & LLM Integration

| Method | Endpoint | Description | Authentication |
|--------|----------|-------------|----------------|
| POST | `/api/eliza-direct/` | Communicate directly with Eliza system | None |
| GET | `/api/lmStudio/` | Access LM Studio functionality | Required (JWT) |
| POST | `/api/agent/` | Interact with AI agent | Required (JWT) |

## Proxy Services

The backend also provides several proxy services that forward requests to other services:

| Endpoint | Target | Description |
|----------|--------|-------------|
| `/eliza` | `http://localhost:3000` | Eliza chat system |
| `/ws` | `http://localhost:8001` | WebSocket server |
| `/research-ws` | `http://localhost:8001` | Research WebSocket server |
| `/research` | `http://localhost:8001` | Research REST API |
| `/upload` | `http://localhost:8001` | File upload for analysis |
| `/analysis` | `http://localhost:8001` | Data analysis API |
| `/visualization` | `http://localhost:8001` | Visualization API |
| `/install-data-analysis-deps` | `http://localhost:8001` | Install data analysis dependencies |

## Additional Features

### Content Buffering for Streaming
The system implements an advanced content buffering mechanism for streaming responses that:
- Ensures smooth text delivery with optimal chunk sizes
- Prevents fragmentation of responses
- Handles streaming timeouts gracefully
- Provides real-time updates to the client

### Environment Variables
Important configuration is managed through environment variables:
- `OPENAI_API_KEY` - API key for OpenAI services
- `MONGO_DB_URI` - MongoDB connection string
- `PORT` - Server port (default: 5000)
- `ENABLE_VECTOR_SERVICES` - Enable vector storage services (true/false)
- `NODE_ENV` - Environment setting (development/production)

### Authentication
The system uses JWT (JSON Web Tokens) for authentication. Protected routes require a valid JWT token in the Authorization header.

### CORS Configuration
The server includes comprehensive CORS configuration to allow requests from specified origins including:
- Local development URLs
- Production domains
- Vercel deployment domains
- ngrok domains for tunneling

## API Documentation Interface
A Swagger UI documentation interface is available at `/api-docs` when the server is running.