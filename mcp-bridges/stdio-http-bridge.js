#!/usr/bin/env node

/**
 * stdio-to-HTTP Bridge for MCP Servers
 * 
 * Wraps stdio-based MCP servers and exposes them via HTTP.
 * This allows stdio servers to be accessed from Docker containers.
 */

import express from 'express';
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3701;
const MCP_SERVER_COMMAND = process.env.MCP_SERVER_COMMAND || 'npx';
const MCP_SERVER_ARGS = process.env.MCP_SERVER_ARGS ? 
  process.env.MCP_SERVER_ARGS.split(' ') : 
  ['-y', '@modelcontextprotocol/server-sequential-thinking'];

let mcpClient = null;
let mcpTransport = null;
let isConnected = false;

/**
 * Initialize MCP client connection
 */
async function initializeMCPClient() {
  try {
    console.log(`Starting MCP server: ${MCP_SERVER_COMMAND} ${MCP_SERVER_ARGS.join(' ')}`);
    
    // Create transport (spawns the process internally)
    mcpTransport = new StdioClientTransport({
      command: MCP_SERVER_COMMAND,
      args: MCP_SERVER_ARGS,
    });

    // Create and connect client
    mcpClient = new Client(
      {
        name: 'mcp-http-bridge',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    await mcpClient.connect(mcpTransport);
    isConnected = true;
    console.log('✅ MCP client connected successfully');
    
    return true;
  } catch (error) {
    console.error('Failed to initialize MCP client:', error);
    isConnected = false;
    return false;
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: isConnected ? 'healthy' : 'unhealthy',
    connected: isConnected,
    server: MCP_SERVER_COMMAND,
    args: MCP_SERVER_ARGS
  });
});

/**
 * List available tools
 */
app.post('/rpc', async (req, res) => {
  if (!isConnected || !mcpClient) {
    return res.status(503).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'MCP server not connected'
      },
      id: req.body.id || null
    });
  }

  try {
    const { method, params, id } = req.body;

    if (method === 'tools/list') {
      const tools = await mcpClient.listTools();
      res.json({
        jsonrpc: '2.0',
        result: {
          tools: tools.tools || []
        },
        id
      });
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      const result = await mcpClient.callTool({
        name,
        arguments: args || {}
      });
      
      res.json({
        jsonrpc: '2.0',
        result: result,
        id
      });
    } else if (method === 'resources/list') {
      const resources = await mcpClient.listResources();
      res.json({
        jsonrpc: '2.0',
        result: {
          resources: resources.resources || []
        },
        id
      });
    } else if (method === 'resources/read') {
      const { uri } = params;
      const resource = await mcpClient.readResource({ uri });
      res.json({
        jsonrpc: '2.0',
        result: resource,
        id
      });
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        },
        id
      });
    }
  } catch (error) {
    console.error('RPC error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: error.message || 'Internal server error'
      },
      id: req.body.id || null
    });
  }
});

/**
 * Start the HTTP bridge server
 */
async function startServer() {
  // Initialize MCP client
  const initialized = await initializeMCPClient();
  
  if (!initialized) {
    console.error('Failed to initialize MCP client, server will start but may not be fully functional');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 MCP HTTP Bridge listening on port ${PORT}`);
    console.log(`   Server: ${MCP_SERVER_COMMAND} ${MCP_SERVER_ARGS.join(' ')}`);
    console.log(`   Status: ${isConnected ? 'Connected' : 'Disconnected'}`);
  });
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (mcpClient) {
    await mcpClient.close();
  }
  if (mcpTransport) {
    await mcpTransport.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (mcpClient) {
    await mcpClient.close();
  }
  if (mcpTransport) {
    await mcpTransport.close();
  }
  process.exit(0);
});

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('stdio-http-bridge')) {
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { startServer, initializeMCPClient };




