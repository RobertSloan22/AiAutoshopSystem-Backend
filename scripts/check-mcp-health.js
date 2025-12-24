#!/usr/bin/env node

/**
 * MCP Server Health Check Script
 * 
 * Checks the health of all configured MCP servers.
 * Can be used by Docker health checks or called directly.
 */

import axios from 'axios';
import mcpServersConfig, { getEnabledServers } from '../config/mcpServers.config.js';

const TIMEOUT = 5000; // 5 seconds

async function checkServerHealth(serverName, config) {
  try {
    if (config.type === 'http' || config.url) {
      const url = config.url || `http://localhost:${config.port || 3700}`;
      const healthUrl = `${url}/health`;
      
      const response = await axios.get(healthUrl, {
        timeout: TIMEOUT,
        validateStatus: (status) => status < 500 // Accept 4xx as "server responding"
      });
      
      return {
        serverName,
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        httpStatus: response.status,
        connected: response.data?.connected || response.data?.status === 'healthy',
        message: response.data?.message || 'OK'
      };
    } else {
      // stdio servers - check if process manager reports them as running
      // This would require importing the process manager, but for Docker health checks
      // we'll assume HTTP bridge is used
      return {
        serverName,
        status: 'unknown',
        message: 'stdio server health check not available in Docker mode'
      };
    }
  } catch (error) {
    return {
      serverName,
      status: 'unhealthy',
      error: error.message,
      connected: false
    };
  }
}

async function checkAllServers() {
  const enabledServers = getEnabledServers();
  const results = [];
  
  for (const serverConfig of enabledServers) {
    const result = await checkServerHealth(serverConfig.name, serverConfig);
    results.push(result);
  }
  
  return results;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('check-mcp-health')) {
  checkAllServers()
    .then(results => {
      const allHealthy = results.every(r => r.status === 'healthy');
      const output = {
        timestamp: new Date().toISOString(),
        overall: allHealthy ? 'healthy' : 'unhealthy',
        servers: results
      };
      
      console.log(JSON.stringify(output, null, 2));
      process.exit(allHealthy ? 0 : 1);
    })
    .catch(error => {
      console.error('Health check failed:', error);
      process.exit(1);
    });
}

export { checkAllServers, checkServerHealth };




