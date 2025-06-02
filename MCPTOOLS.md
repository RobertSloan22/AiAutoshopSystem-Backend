# MCP (Model Context Protocol) Tools Integration

## Overview

This backend provides a complete MCP server integration that allows your frontend application to connect to and interact with MCP servers. The implementation includes a TypeScript service for MCP communication and RESTful API endpoints for frontend integration.

## Backend Architecture

### MCPClientService (`services/mcpClient.ts`)

The core service that handles MCP server communication:

```typescript
export class MCPClientService {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  
  // Key methods:
  async connect(serverCommand: string, serverArgs: string[] = [])
  async disconnect()
  async listTools()
  async callTool(name: string, arguments_: Record<string, unknown>)
  async listResources()
  async readResource(uri: string)
  isConnected(): boolean
}
```

### API Endpoints (`/api/mcp/*`)

All endpoints are available under the `/api/mcp` prefix:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/mcp/connect` | Connect to an MCP server |
| POST | `/api/mcp/disconnect` | Disconnect from current server |
| GET | `/api/mcp/status` | Check connection status |
| GET | `/api/mcp/tools` | List available tools |
| POST | `/api/mcp/tools/call` | Execute a specific tool |
| GET | `/api/mcp/resources` | List available resources |
| POST | `/api/mcp/resources/read` | Read a specific resource |

## Frontend Implementation Guide

### 1. Connection Management

#### Connect to MCP Server
```javascript
// Connect to a weather MCP server example
const connectToMCPServer = async () => {
  try {
    const response = await fetch('/api/mcp/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverCommand: 'npx',
        serverArgs: ['-y', '@modelcontextprotocol/server-weather']
      })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('Connected to MCP server');
    }
  } catch (error) {
    console.error('Connection failed:', error);
  }
};
```

#### Check Connection Status
```javascript
const checkStatus = async () => {
  const response = await fetch('/api/mcp/status');
  const status = await response.json();
  return status.connected; // boolean
};
```

#### Disconnect from Server
```javascript
const disconnect = async () => {
  const response = await fetch('/api/mcp/disconnect', {
    method: 'POST'
  });
  const result = await response.json();
  return result.success;
};
```

### 2. Tool Management

#### List Available Tools
```javascript
const getAvailableTools = async () => {
  try {
    const response = await fetch('/api/mcp/tools');
    const tools = await response.json();
    
    // tools.tools array contains:
    // [{ name: "tool_name", description: "...", inputSchema: {...} }]
    return tools.tools;
  } catch (error) {
    console.error('Failed to fetch tools:', error);
    return [];
  }
};
```

#### Call a Tool
```javascript
const callTool = async (toolName, arguments) => {
  try {
    const response = await fetch('/api/mcp/tools/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: toolName,
        arguments: arguments
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Tool execution failed:', error);
    throw error;
  }
};

// Example: Call weather tool
const getWeather = async (location) => {
  return await callTool('get-weather', { location });
};
```

### 3. Resource Management

#### List Available Resources
```javascript
const getResources = async () => {
  try {
    const response = await fetch('/api/mcp/resources');
    const resources = await response.json();
    return resources.resources;
  } catch (error) {
    console.error('Failed to fetch resources:', error);
    return [];
  }
};
```

#### Read a Resource
```javascript
const readResource = async (uri) => {
  try {
    const response = await fetch('/api/mcp/resources/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uri })
    });
    
    const resource = await response.json();
    return resource;
  } catch (error) {
    console.error('Failed to read resource:', error);
    throw error;
  }
};
```

## Complete React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const MCPToolsComponent = () => {
  const [connected, setConnected] = useState(false);
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/mcp/status');
      const status = await response.json();
      setConnected(status.connected);
      
      if (status.connected) {
        await loadTools();
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };

  const connectToServer = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverCommand: 'npx',
          serverArgs: ['-y', '@modelcontextprotocol/server-weather']
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setConnected(true);
        await loadTools();
      }
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTools = async () => {
    try {
      const response = await fetch('/api/mcp/tools');
      const toolsData = await response.json();
      setTools(toolsData.tools || []);
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  };

  const executeTool = async (toolName, args = {}) => {
    try {
      const response = await fetch('/api/mcp/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, arguments: args })
      });
      
      const result = await response.json();
      console.log('Tool result:', result);
      return result;
    } catch (error) {
      console.error('Tool execution failed:', error);
    }
  };

  const disconnect = async () => {
    try {
      const response = await fetch('/api/mcp/disconnect', {
        method: 'POST'
      });
      
      const result = await response.json();
      if (result.success) {
        setConnected(false);
        setTools([]);
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
    }
  };

  return (
    <div className="mcp-tools">
      <h2>MCP Tools Integration</h2>
      
      <div className="connection-status">
        Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <div className="controls">
        {!connected ? (
          <button onClick={connectToServer} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect to MCP Server'}
          </button>
        ) : (
          <button onClick={disconnect}>Disconnect</button>
        )}
      </div>

      {connected && (
        <div className="tools-section">
          <h3>Available Tools</h3>
          <ul>
            {tools.map((tool, index) => (
              <li key={index}>
                <strong>{tool.name}</strong>: {tool.description}
                <button 
                  onClick={() => executeTool(tool.name)}
                  style={{ marginLeft: '10px' }}
                >
                  Execute
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MCPToolsComponent;
```

## Common MCP Servers

### Weather Server
```javascript
// Connect to weather server
{
  serverCommand: 'npx',
  serverArgs: ['-y', '@modelcontextprotocol/server-weather']
}
```

### File System Server
```javascript
// Connect to filesystem server
{
  serverCommand: 'npx',
  serverArgs: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/directory']
}
```

### Custom Server
```javascript
// Connect to custom server
{
  serverCommand: 'node',
  serverArgs: ['path/to/your/mcp-server.js']
}
```

## Error Handling

All API endpoints return structured error responses:

```javascript
// Success response
{
  "success": true,
  "message": "Connected to MCP server"
}

// Error response
{
  "error": "Client not connected",
  "details": "Additional error information"
}
```

## Frontend State Management

Consider using a context provider or state management library to handle MCP connection state across your application:

```jsx
// MCPContext.js
import React, { createContext, useContext, useState } from 'react';

const MCPContext = createContext();

export const MCPProvider = ({ children }) => {
  const [mcpState, setMcpState] = useState({
    connected: false,
    tools: [],
    resources: []
  });

  const connectMCP = async (serverCommand, serverArgs) => {
    // Implementation here
  };

  const value = {
    mcpState,
    connectMCP,
    // ... other methods
  };

  return (
    <MCPContext.Provider value={value}>
      {children}
    </MCPContext.Provider>
  );
};

export const useMCP = () => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within MCPProvider');
  }
  return context;
};
```

## Security Considerations

1. **Server Command Validation**: The backend accepts arbitrary server commands. In production, consider whitelisting allowed MCP servers.

2. **Authentication**: Add authentication middleware to MCP endpoints if needed.

3. **Rate Limiting**: Implement rate limiting for tool execution endpoints.

4. **Input Validation**: Validate tool arguments and resource URIs before processing.

## Troubleshooting

### Common Issues

1. **Connection Timeout**: Ensure the MCP server is available and accessible
2. **Tool Not Found**: Verify the tool name matches exactly (case-sensitive)
3. **Invalid Arguments**: Check tool's input schema for required parameters
4. **Server Command Failed**: Ensure the server command/path is correct

### Debug Mode

Enable debug logging by checking the browser console and server logs for detailed error messages.