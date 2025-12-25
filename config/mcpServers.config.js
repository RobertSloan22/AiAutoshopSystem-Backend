import dotenv from 'dotenv';

dotenv.config();

/**
 * MCP Servers Configuration
 * 
 * Defines configuration for multiple MCP servers that can be used by the backend agent.
 * Supports both HTTP-based and stdio-based servers.
 * Automatically detects Docker mode and uses HTTP endpoints when available.
 */

// Detect Docker mode
const isDockerMode = process.env.MCP_DOCKER_MODE === 'true' || 
                     process.env.DOCKER === 'true' ||
                     process.env.NODE_ENV === 'production';

const mcpServersConfig = {
  // Sequential Thinking Server - for complex problem-solving
  sequentialThinking: {
    type: isDockerMode ? 'http' : 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    url: isDockerMode 
      ? (process.env.MCP_SEQUENTIAL_THINKING_URL || 'http://mcp-sequential-thinking:3701')
      : null,
    enabled: process.env.MCP_SEQUENTIAL_THINKING_ENABLED !== 'false',
    name: 'sequential-thinking',
    description: 'Sequential thinking server for breaking down complex problems',
    timeout: 30000, // 30 seconds
    autoRestart: !isDockerMode, // Docker handles restarts
    maxRestarts: 3,
    healthCheckInterval: 30000
  },

  // Memory Server - for persistent context storage
  memory: {
    type: isDockerMode ? 'http' : 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    url: isDockerMode
      ? (process.env.MCP_MEMORY_URL || 'http://mcp-memory:3702')
      : null,
    enabled: process.env.MCP_MEMORY_ENABLED !== 'false',
    name: 'memory',
    description: 'Memory server for persistent context storage',
    timeout: 10000,
    autoRestart: !isDockerMode,
    maxRestarts: 3,
    healthCheckInterval: 30000
  },

  // Filesystem Server - for file operations
  filesystem: {
    type: isDockerMode ? 'http' : 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    url: isDockerMode
      ? (process.env.MCP_FILESYSTEM_URL || 'http://mcp-filesystem:3703')
      : null,
    enabled: process.env.MCP_FILESYSTEM_ENABLED !== 'false',
    name: 'filesystem',
    description: 'Filesystem server for file operations',
    timeout: 30000,
    autoRestart: !isDockerMode,
    maxRestarts: 3,
    healthCheckInterval: 30000
  },

  // Existing ELM327 HTTP-based MCP server
  elm327: {
    type: 'http',
    url: process.env.MCP_SERVER_URL || process.env.MCP_ELM327_URL || 'http://localhost:3700',
    enabled: process.env.MCP_ELM327_ENABLED !== 'false',
    name: 'elm327',
    description: 'ELM327 OBD2 diagnostic server',
    timeout: 10000,
    healthCheckInterval: 30000, // 30 seconds
    autoReconnect: true
  }
};

/**
 * Get all enabled MCP server configurations
 */
export function getEnabledServers() {
  return Object.entries(mcpServersConfig)
    .filter(([_, config]) => config.enabled)
    .map(([key, config]) => ({ key, ...config }));
}

/**
 * Get configuration for a specific server
 */
export function getServerConfig(serverName) {
  return mcpServersConfig[serverName];
}

/**
 * Get all server configurations
 */
export function getAllServerConfigs() {
  return mcpServersConfig;
}

export default mcpServersConfig;

