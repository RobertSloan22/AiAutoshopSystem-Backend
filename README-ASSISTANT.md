# OpenAI Assistant System Usage Guide

This guide explains how to use the OpenAI Assistant API system in this backend application.

## Prerequisites

1. Set up your environment variables in `.env`:
```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_ASSISTANT_ID=asst_your_assistant_id_here
```

## Step 1: Create an Assistant

### Using the API endpoint:
```bash
POST /api/openai/assistants/
Content-Type: application/json

{
  "name": "Auto Shop Assistant",
  "instructions": "You are a helpful automotive diagnostic assistant. Help users understand car problems and diagnostic data.",
  "model": "gpt-4-turbo-preview",
  "tools": [{"type": "file_search"}]
}
```

### Response:
```json
{
  "id": "asst_abc123...",
  "name": "Auto Shop Assistant",
  "instructions": "You are a helpful automotive diagnostic assistant...",
  "model": "gpt-4-turbo-preview",
  "tools": [{"type": "file_search"}]
}
```

**Important:** Copy the `id` from the response and set it as your `OPENAI_ASSISTANT_ID` environment variable.

## Step 2: Create a Knowledge Base (Upload Files)

### Upload a single file:
```bash
POST /api/openai/assistants/files
Content-Type: multipart/form-data

file: [your_file.pdf/txt/docx]
```

### Upload multiple files:
```bash
POST /api/openai/assistants/files/bulk
Content-Type: multipart/form-data

files: [file1.pdf, file2.txt, file3.docx]
```

### List uploaded files:
```bash
GET /api/openai/assistants/files
```

### Delete a file:
```bash
DELETE /api/openai/assistants/files/{fileId}
```

## Step 3: Chat with the Assistant

### Create a conversation thread:
```bash
POST /api/openai/assistants/threads
Content-Type: application/json

{}
```

### Response:
```json
{
  "id": "thread_abc123...",
  "created_at": 1234567890
}
```

### Send a message:
```bash
POST /api/openai/assistants/threads/{threadId}/messages
Content-Type: application/json

{
  "role": "user",
  "content": "What could cause engine misfires in a 2018 Honda Civic?"
}
```

### Create and run the assistant:
```bash
POST /api/openai/assistants/threads/{threadId}/runs
Content-Type: application/json

{
  "assistant_id": "asst_your_assistant_id"
}
```

### Check run status:
```bash
GET /api/openai/assistants/threads/{threadId}/runs/{runId}
```

### Get messages (including assistant response):
```bash
GET /api/openai/assistants/threads/{threadId}/messages
```

## Quick Start Example

### 1. Create Assistant
```bash
curl -X POST http://localhost:3000/api/openai/assistants/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Auto Diagnostic Assistant",
    "instructions": "Help with automotive diagnostics and repairs",
    "model": "gpt-4-turbo-preview",
    "tools": [{"type": "file_search"}]
  }'
```

### 2. Upload Knowledge Base Files
```bash
curl -X POST http://localhost:3000/api/openai/assistants/files \
  -F "file=@./diagnostic_manual.pdf"
```

### 3. Start Conversation
```bash
# Create thread
curl -X POST http://localhost:3000/api/openai/assistants/threads

# Send message
curl -X POST http://localhost:3000/api/openai/assistants/threads/thread_abc123/messages \
  -H "Content-Type: application/json" \
  -d '{
    "role": "user",
    "content": "Analyze this OBD-II code P0300"
  }'

# Run assistant
curl -X POST http://localhost:3000/api/openai/assistants/threads/thread_abc123/runs \
  -H "Content-Type: application/json" \
  -d '{
    "assistant_id": "asst_your_assistant_id"
  }'
```

## Supported File Types

The assistant can process various file formats:
- PDF documents
- Text files (.txt, .md)
- Word documents (.docx)
- Spreadsheets (.xlsx, .csv)
- Code files (.js, .py, .json, etc.)

## Error Handling

- **400 Bad Request**: Invalid assistant ID or missing files
- **401 Unauthorized**: Invalid OpenAI API key
- **404 Not Found**: Assistant or thread not found
- **500 Internal Server Error**: OpenAI API errors or server issues

## Best Practices

1. **Assistant Setup**: Create one assistant per use case/domain
2. **Knowledge Base**: Upload relevant documentation and manuals
3. **Thread Management**: Use separate threads for different conversations
4. **File Organization**: Keep uploaded files organized and remove outdated ones
5. **Error Handling**: Always check run status before retrieving messages

## Environment Configuration

Create a `.env` file:
```bash
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_ASSISTANT_ID=asst-your-assistant-id-here
PORT=3000
```

The system will throw an error if `OPENAI_ASSISTANT_ID` is not set or doesn't start with `'asst_'`.