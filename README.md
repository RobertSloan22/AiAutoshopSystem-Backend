# Unified Vector Storage System

This system provides a unified approach to vector storage for applications requiring vector embeddings and similarity search. It supports both local ChromaDB storage and OpenAI's vector database for redundancy.

## Features

- Unified API for vector operations
- Dual storage in both local ChromaDB and OpenAI's vector database
- Fallback mechanisms if one storage system is unavailable
- Optimized for forum content crawling and retrieval
- Docker setup for easy deployment

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your configuration values
3. Start the Docker containers:

```bash
docker-compose up -d
```

## Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `CHROMA_URL`: URL for local ChromaDB (default: http://localhost:8000)
- `LOCAL_EMBEDDING_URL`: URL for local embedding service (default: http://localhost:1234)
- `OPENAI_API_KEY`: Your OpenAI API key (required for OpenAI vector storage)
- `USE_DUAL_STORAGE`: Set to true to store vectors in both local and OpenAI systems

## API Usage

The system exposes a RESTful API for processing forum content:

- `POST /api/forum-crawler/process`: Process content from a forum URL
- `POST /api/forum-crawler/query`: Query processed content

Example:

```javascript
// Process a forum
const response = await axios.post('/api/forum-crawler/process', {
  url: 'https://example-forum.com'
});

// Query the processed content
const queryResponse = await axios.post('/api/forum-crawler/query', {
  question: 'How do I fix P0300 code on BMW?'
});
```

## Architecture

The system consists of the following components:

1. **VectorService**: Central service that manages connections to both local and OpenAI vector storage
2. **ForumCrawlerService**: Service for crawling forum content and adding it to vector storage
3. **ChromaDB**: Local vector database running in Docker
4. **Embedding Service**: Local embedding model for generating vectors

## Troubleshooting

**Connection Issues**:
- Ensure ChromaDB container is running: `docker-compose ps`
- Check ChromaDB logs: `docker-compose logs chromadb`
- Verify the embedding service is running: `docker-compose logs local-embeddings`

**OpenAI Integration**:
- Verify your OpenAI API key is valid
- Check API rate limits in OpenAI dashboard

## Development

To run the system in development mode:

```bash
npm install
npm run dev
```

## License

MIT
