import axios from 'axios';
import mcpProcessManager from './mcpProcessManager.js';
import mcpServersConfig, { getEnabledServers } from '../config/mcpServers.config.js';
import MCPService from './mcpService.js';

/**
 * Multi-MCP Service
 * 
 * Manages multiple MCP servers (both HTTP and stdio-based).
 * Provides unified interface for tool aggregation and routing.
 */

class MultiMCPService {
  constructor() {
    this.httpServers = new Map(); // serverName -> MCPService instance
    this.stdioServers = new Map(); // serverName -> server info from process manager
    this.toolRegistry = new Map(); // toolName -> { serverName, serverType, tool }
    this.initialized = false;
  }

  /**
   * Initialize all enabled MCP servers
   */
  async initialize() {
    if (this.initialized) {
      console.log('Multi-MCP Service already initialized');
      return;
    }

    console.log('🚀 Initializing Multi-MCP Service...');

    const enabledServers = getEnabledServers();
    console.log(`Found ${enabledServers.length} enabled MCP servers`);

    // Initialize servers based on type
    for (const serverConfig of enabledServers) {
      if (serverConfig.type === 'http') {
        await this.initializeHTTPServer(serverConfig.name, serverConfig);
      } else if (serverConfig.type === 'stdio') {
        // In Docker mode, stdio servers are accessed via HTTP bridge
        if (serverConfig.url) {
          // Convert to HTTP server config
          const httpConfig = {
            ...serverConfig,
            type: 'http',
            url: serverConfig.url
          };
          await this.initializeHTTPServer(serverConfig.name, httpConfig);
        } else {
          // Local stdio mode
          await this.initializeStdioServer(serverConfig.name, serverConfig);
        }
      }
    }

    // Load tools from all servers
    await this.loadAllTools();

    this.initialized = true;
    console.log('✅ Multi-MCP Service initialized successfully');
    console.log(`   Total tools available: ${this.toolRegistry.size}`);
  }

  /**
   * Initialize an HTTP-based MCP server
   */
  async initializeHTTPServer(serverName, config) {
    try {
      console.log(`Initializing HTTP MCP server: ${serverName} at ${config.url}`);
      const mcpService = new MCPService(config.url);
      
      // Check connection
      await mcpService.checkConnection();
      
      if (mcpService.isConnected) {
        await mcpService.loadAvailableTools();
        this.httpServers.set(serverName, mcpService);
        console.log(`✅ HTTP MCP server ${serverName} initialized`);
      } else {
        console.warn(`⚠️ HTTP MCP server ${serverName} not available`);
      }
    } catch (error) {
      console.error(`Failed to initialize HTTP MCP server ${serverName}:`, error.message);
    }
  }

  /**
   * Initialize a stdio-based MCP server
   */
  async initializeStdioServer(serverName, config) {
    try {
      console.log(`Initializing stdio MCP server: ${serverName}`);
      await mcpProcessManager.startServer(serverName, config);
      
      if (mcpProcessManager.isServerRunning(serverName)) {
        this.stdioServers.set(serverName, mcpProcessManager.getServerStatus(serverName));
        console.log(`✅ stdio MCP server ${serverName} initialized`);
      } else {
        console.warn(`⚠️ stdio MCP server ${serverName} failed to start`);
      }
    } catch (error) {
      console.error(`Failed to initialize stdio MCP server ${serverName}:`, error.message);
    }
  }

  /**
   * Load tools from all connected servers
   */
  async loadAllTools() {
    this.toolRegistry.clear();

    // Load tools from HTTP servers
    for (const [serverName, mcpService] of this.httpServers.entries()) {
      try {
        const tools = mcpService.getToolDefinitions();
        for (const tool of tools) {
          const toolName = tool.function?.name || tool.name;
          if (toolName) {
            this.toolRegistry.set(toolName, {
              serverName,
              serverType: 'http',
              tool
            });
          }
        }
        console.log(`Loaded ${tools.length} tools from HTTP server ${serverName}`);
      } catch (error) {
        console.error(`Failed to load tools from HTTP server ${serverName}:`, error.message);
      }
    }

    // Load tools from stdio servers
    for (const serverName of this.stdioServers.keys()) {
      try {
        const client = mcpProcessManager.getClient(serverName);
        if (client) {
          const toolsResult = await client.listTools();
          const tools = toolsResult.tools || [];
          
          for (const tool of tools) {
            const toolName = tool.name;
            if (toolName) {
              // Convert MCP tool format to OpenAI function format
              const functionTool = {
                type: 'function',
                function: {
                  name: tool.name,
                  description: tool.description || '',
                  parameters: tool.inputSchema || {
                    type: 'object',
                    properties: {},
                    required: []
                  }
                }
              };
              
              this.toolRegistry.set(toolName, {
                serverName,
                serverType: 'stdio',
                tool: functionTool
              });
            }
          }
          console.log(`Loaded ${tools.length} tools from stdio server ${serverName}`);
        }
      } catch (error) {
        console.error(`Failed to load tools from stdio server ${serverName}:`, error.message);
      }
    }
  }

  /**
   * Get all tool definitions for OpenAI API
   */
  getToolDefinitions() {
    const tools = [];
    const seenNames = new Set();

    for (const [toolName, registryEntry] of this.toolRegistry.entries()) {
      // Deduplicate tools by name
      if (seenNames.has(toolName)) {
        console.warn(`Duplicate tool name detected: ${toolName}, skipping`);
        continue;
      }
      seenNames.add(toolName);
      tools.push(registryEntry.tool);
    }

    return tools;
  }

  /**
   * Get MCP server information for a tool
   */
  getToolServerInfo(toolName) {
    const registryEntry = this.toolRegistry.get(toolName);
    
    if (!registryEntry) {
      // Check if it's a non-MCP tool (Python, web search, PDF, etc.)
      if (toolName === 'execute_python_code') {
        return {
          mcpServer: null,
          mcpServerType: 'internal',
          serverName: 'python',
          serverStatus: 'available'
        };
      }
      if (['web_search', 'search_technical_images'].includes(toolName)) {
        return {
          mcpServer: null,
          mcpServerType: 'internal',
          serverName: 'websearch',
          serverStatus: 'available'
        };
      }
      if (toolName === 'process_pdf_from_url') {
        return {
          mcpServer: null,
          mcpServerType: 'internal',
          serverName: 'pdf',
          serverStatus: 'available'
        };
      }
      // Unknown tool
      return {
        mcpServer: null,
        mcpServerType: 'unknown',
        serverName: 'unknown',
        serverStatus: 'unknown'
      };
    }

    const { serverName, serverType } = registryEntry;
    
    // Get server status
    let serverStatus = 'unknown';
    if (serverType === 'http') {
      const mcpService = this.httpServers.get(serverName);
      serverStatus = mcpService && mcpService.isConnected ? 'connected' : 'disconnected';
    } else if (serverType === 'stdio') {
      serverStatus = mcpProcessManager.isServerRunning(serverName) ? 'running' : 'stopped';
    }

    return {
      mcpServer: serverName,
      mcpServerType: serverType,
      serverName: serverName,
      serverStatus: serverStatus
    };
  }

  /**
   * Get MCP server info for multiple tools
   */
  getToolsServerInfo(toolCalls) {
    return toolCalls.map(toolCall => {
      const toolName = toolCall.function?.name || toolCall.name;
      const serverInfo = this.getToolServerInfo(toolName);
      return {
        toolCallId: toolCall.id,
        toolName: toolName,
        ...serverInfo
      };
    });
  }

  /**
   * Call a tool by name
   */
  async callTool(toolName, parameters = {}) {
    const registryEntry = this.toolRegistry.get(toolName);
    
    if (!registryEntry) {
      throw new Error(`Tool ${toolName} not found in any MCP server`);
    }

    const { serverName, serverType } = registryEntry;

    try {
      if (serverType === 'http') {
        const mcpService = this.httpServers.get(serverName);
        if (!mcpService || !mcpService.isConnected) {
          throw new Error(`HTTP MCP server ${serverName} is not connected`);
        }
        return await mcpService.callTool(toolName, parameters);
      } else if (serverType === 'stdio') {
        const client = mcpProcessManager.getClient(serverName);
        if (!client) {
          throw new Error(`stdio MCP server ${serverName} is not connected`);
        }
        const result = await client.callTool(toolName, parameters);
        // Extract content from MCP result format
        if (result.content) {
          // MCP returns content as array of text/image objects
          const textContent = result.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');
          return textContent || result.content;
        }
        return result;
      }
    } catch (error) {
      console.error(`Error calling tool ${toolName} on server ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Get connection status for all servers
   */
  async getConnectionStatus() {
    const status = {
      initialized: this.initialized,
      totalTools: this.toolRegistry.size,
      httpServers: {},
      stdioServers: {},
      allServers: []
    };

    // HTTP servers status
    for (const [serverName, mcpService] of this.httpServers.entries()) {
      const serverStatus = await mcpService.getConnectionStatus();
      status.httpServers[serverName] = {
        type: 'http',
        connected: serverStatus.connected,
        serverUrl: serverStatus.serverUrl,
        availableTools: serverStatus.availableTools,
        tools: serverStatus.tools
      };
      status.allServers.push({
        name: serverName,
        type: 'http',
        ...status.httpServers[serverName]
      });
    }

    // stdio servers status
    const stdioStatuses = mcpProcessManager.getAllServerStatuses();
    for (const [serverName, serverStatus] of Object.entries(stdioStatuses)) {
      const client = mcpProcessManager.getClient(serverName);
      const tools = [];
      
      try {
        if (client) {
          const toolsResult = await client.listTools();
          tools.push(...(toolsResult.tools || []).map(t => ({
            name: t.name,
            description: t.description
          })));
        }
      } catch (error) {
        console.error(`Failed to get tools for ${serverName}:`, error.message);
      }

      status.stdioServers[serverName] = {
        type: 'stdio',
        ...serverStatus,
        availableTools: tools.length,
        tools
      };
      status.allServers.push({
        name: serverName,
        type: 'stdio',
        ...status.stdioServers[serverName]
      });
    }

    return status;
  }

  /**
   * Reload tools from all servers
   */
  async reloadTools() {
    console.log('Reloading tools from all MCP servers...');
    await this.loadAllTools();
    console.log(`✅ Reloaded ${this.toolRegistry.size} tools`);
  }

  /**
   * Cleanup all connections
   */
  async cleanup() {
    console.log('Cleaning up Multi-MCP Service...');
    
    // Stop all stdio servers
    await mcpProcessManager.cleanup();
    
    // Clear HTTP servers (they don't need explicit cleanup)
    this.httpServers.clear();
    this.stdioServers.clear();
    this.toolRegistry.clear();
    this.initialized = false;
    
    console.log('✅ Multi-MCP Service cleaned up');
  }
}

// Export singleton instance
export default new MultiMCPService();

