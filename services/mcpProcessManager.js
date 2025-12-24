import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

/**
 * MCP Process Manager
 * 
 * Manages lifecycle of stdio-based MCP server processes.
 * The StdioClientTransport handles process spawning internally.
 */

class MCPProcessManager {
  constructor() {
    this.servers = new Map(); // serverName -> { client, transport, config, restartCount, status }
    this.healthCheckIntervals = new Map();
  }

  /**
   * Start an MCP server process
   */
  async startServer(serverName, config) {
    if (this.servers.has(serverName)) {
      console.log(`MCP server ${serverName} is already running`);
      return this.servers.get(serverName);
    }

    if (config.type !== 'stdio') {
      throw new Error(`Process manager only handles stdio servers, got ${config.type}`);
    }

    console.log(`Starting MCP server: ${serverName} with command: ${config.command} ${config.args.join(' ')}`);

    try {
      // Create transport (this will spawn the process internally)
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
      });

      // Create and connect client
      const client = new Client(
        {
          name: 'backend-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
          },
        }
      );

      await client.connect(transport);

      const serverInfo = {
        client,
        transport,
        config,
        restartCount: 0,
        status: 'running',
        startedAt: Date.now(),
        lastHealthCheck: null
      };

      this.servers.set(serverName, serverInfo);

      // Start health monitoring
      this.startHealthMonitoring(serverName, config);

      console.log(`✅ MCP server ${serverName} started successfully`);
      return serverInfo;
    } catch (error) {
      console.error(`Failed to start MCP server ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Stop an MCP server process
   */
  async stopServer(serverName) {
    const serverInfo = this.servers.get(serverName);
    if (!serverInfo) {
      console.log(`MCP server ${serverName} is not running`);
      return;
    }

    console.log(`Stopping MCP server: ${serverName}`);

    // Stop health monitoring
    this.stopHealthMonitoring(serverName);

    try {
      // Close client and transport (this will kill the process)
      if (serverInfo.client) {
        await serverInfo.client.close();
      }
      if (serverInfo.transport) {
        await serverInfo.transport.close();
      }
    } catch (error) {
      console.error(`Error stopping MCP server ${serverName}:`, error);
    }

    this.servers.delete(serverName);
    console.log(`✅ MCP server ${serverName} stopped`);
  }

  /**
   * Stop all MCP server processes
   */
  async stopAllServers() {
    const serverNames = Array.from(this.servers.keys());
    await Promise.all(serverNames.map(name => this.stopServer(name)));
  }

  /**
   * Get status of an MCP server
   */
  getServerStatus(serverName) {
    const serverInfo = this.servers.get(serverName);
    if (!serverInfo) {
      return { status: 'not_running' };
    }

    return {
      status: serverInfo.status,
      restartCount: serverInfo.restartCount,
      uptime: Date.now() - serverInfo.startedAt,
      lastHealthCheck: serverInfo.lastHealthCheck,
      isConnected: serverInfo.client !== null
    };
  }

  /**
   * Get status of all servers
   */
  getAllServerStatuses() {
    const statuses = {};
    for (const [name] of this.servers.entries()) {
      statuses[name] = this.getServerStatus(name);
    }
    return statuses;
  }

  /**
   * Get the client for a server
   */
  getClient(serverName) {
    const serverInfo = this.servers.get(serverName);
    return serverInfo?.client || null;
  }

  /**
   * Check if a server is running
   */
  isServerRunning(serverName) {
    const serverInfo = this.servers.get(serverName);
    return serverInfo?.status === 'running' && serverInfo?.client !== null;
  }

  /**
   * Restart a server
   */
  async restartServer(serverName) {
    const serverInfo = this.servers.get(serverName);
    if (!serverInfo) {
      console.log(`Cannot restart ${serverName}: server not found`);
      return;
    }

    serverInfo.restartCount++;
    console.log(`Restarting MCP server ${serverName} (attempt ${serverInfo.restartCount})`);

    try {
      await this.stopServer(serverName);
      await this.startServer(serverName, serverInfo.config);
    } catch (error) {
      console.error(`Failed to restart MCP server ${serverName}:`, error);
      const newServerInfo = this.servers.get(serverName);
      if (newServerInfo) {
        newServerInfo.status = 'failed';
      }
    }
  }

  /**
   * Start health monitoring for a server
   */
  startHealthMonitoring(serverName, config) {
    // Clear existing interval if any
    this.stopHealthMonitoring(serverName);

    const interval = setInterval(async () => {
      await this.performHealthCheck(serverName);
    }, config.healthCheckInterval || 30000); // Default 30 seconds

    this.healthCheckIntervals.set(serverName, interval);
  }

  /**
   * Stop health monitoring for a server
   */
  stopHealthMonitoring(serverName) {
    const interval = this.healthCheckIntervals.get(serverName);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serverName);
    }
  }

  /**
   * Perform health check on a server
   */
  async performHealthCheck(serverName) {
    const serverInfo = this.servers.get(serverName);
    if (!serverInfo) return;

    try {
      // Check if client is connected
      if (serverInfo.client) {
        // Try to list tools as a health check
        await serverInfo.client.listTools();
        serverInfo.status = 'running';
        serverInfo.lastHealthCheck = Date.now();
      } else {
        serverInfo.status = 'disconnected';
        console.warn(`MCP server ${serverName} health check failed: client not connected`);
        
        // Attempt restart if auto-restart is enabled
        if (serverInfo.config.autoRestart && 
            serverInfo.restartCount < (serverInfo.config.maxRestarts || 3)) {
          await this.restartServer(serverName);
        }
      }
    } catch (error) {
      serverInfo.status = 'unhealthy';
      console.error(`MCP server ${serverName} health check failed:`, error.message);
      
      // Attempt restart if unhealthy and auto-restart is enabled
      if (serverInfo.config.autoRestart && 
          serverInfo.restartCount < (serverInfo.config.maxRestarts || 3)) {
        await this.restartServer(serverName);
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('Cleaning up MCP process manager...');
    
    // Stop all health monitoring
    for (const serverName of this.healthCheckIntervals.keys()) {
      this.stopHealthMonitoring(serverName);
    }

    // Stop all servers
    await this.stopAllServers();
  }
}

// Export singleton instance
export default new MCPProcessManager();
