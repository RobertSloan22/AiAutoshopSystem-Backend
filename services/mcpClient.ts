import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

export class MCPClientService {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  
  async connect(serverCommand: string, serverArgs: string[] = []): Promise<void> {
    try {
      // Create transport for the MCP server
      this.transport = new StdioClientTransport({
        command: serverCommand,
        args: serverArgs,
      });

      // Create and connect the client
      this.client = new Client(
        {
          name: "react-mcp-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
            resources: {},
          },
        }
      );

      await this.client.connect(this.transport);
      console.log('Connected to MCP server');
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  async listTools() {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    
    const response = await this.client.listTools();
    return ListToolsResultSchema.parse(response);
  }

  async callTool(name: string, arguments_: Record<string, unknown>) {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    const response = await this.client.callTool({
      name,
      arguments: arguments_,
    });
    
    return CallToolResultSchema.parse(response);
  }

  async listResources() {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    
    return await this.client.listResources();
  }

  async readResource(uri: string) {
    if (!this.client) {
      throw new Error('Client not connected');
    }
    
    return await this.client.readResource({ uri });
  }

  isConnected(): boolean {
    return this.client !== null;
  }
}