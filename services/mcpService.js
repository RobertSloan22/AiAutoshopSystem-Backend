import axios from 'axios';

class MCPService {
  constructor(mcpServerUrl = 'http://localhost:3700') {
    this.mcpServerUrl = mcpServerUrl;
    this.isConnected = false;
    this.availableTools = [];
    this.checkConnection();
  }

  async checkConnection() {
    try {
      const response = await axios.get(`${this.mcpServerUrl}/health`, { timeout: 5000 });
      this.isConnected = response.status === 200;
      if (this.isConnected) {
        await this.loadAvailableTools();
      }
    } catch (error) {
      console.log('MCP server not available:', error.message);
      this.isConnected = false;
    }
  }

  async loadAvailableTools() {
    try {
      const response = await axios.post(`${this.mcpServerUrl}/rpc`, {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1
      });

      if (response.data?.result?.tools) {
        this.availableTools = response.data.result.tools;
        console.log('Loaded MCP tools:', this.availableTools.map(t => t.name));
      }
    } catch (error) {
      console.error('Failed to load MCP tools:', error.message);
    }
  }

  async callTool(toolName, parameters = {}) {
    if (!this.isConnected) {
      throw new Error('MCP server not connected');
    }

    try {
      const response = await axios.post(`${this.mcpServerUrl}/rpc`, {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: parameters
        },
        id: Date.now()
      });

      if (response.data?.error) {
        throw new Error(`MCP tool error: ${response.data.error.message}`);
      }

      return response.data?.result;
    } catch (error) {
      console.error(`MCP tool call failed (${toolName}):`, error.message);
      throw error;
    }
  }

  getToolDefinitions() {
    return this.availableTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));
  }

  async getConnectionStatus() {
    await this.checkConnection();
    return {
      connected: this.isConnected,
      serverUrl: this.mcpServerUrl,
      availableTools: this.availableTools.length,
      tools: this.availableTools.map(t => ({ name: t.name, description: t.description }))
    };
  }
}

export default MCPService;