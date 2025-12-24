#!/usr/bin/env node

/**
 * MCP Servers Startup Script
 * 
 * Initializes all configured MCP servers on backend startup.
 * Can be run standalone or integrated into server startup.
 */

import multiMCPService from '../services/multiMCPService.js';
import { getEnabledServers } from '../config/mcpServers.config.js';
import dotenv from 'dotenv';

dotenv.config();

async function startMCPServers() {
  console.log('🚀 Starting MCP Servers...\n');

  try {
    // Initialize Multi-MCP Service (this will start all enabled servers)
    await multiMCPService.initialize();

    // Get status of all servers
    const status = await multiMCPService.getConnectionStatus();

    console.log('\n📊 MCP Servers Status:');
    console.log(`   Initialized: ${status.initialized ? '✅' : '❌'}`);
    console.log(`   Total Tools: ${status.totalTools}`);
    console.log(`   Total Servers: ${status.allServers.length}\n`);

    // Display individual server status
    if (status.allServers.length > 0) {
      console.log('📡 Server Details:');
      for (const server of status.allServers) {
        const statusIcon = server.connected || server.status === 'running' ? '✅' : '❌';
        console.log(`   ${statusIcon} ${server.name} (${server.type})`);
        console.log(`      Tools: ${server.availableTools || 0}`);
        if (server.type === 'http') {
          console.log(`      URL: ${server.serverUrl || 'N/A'}`);
        }
        if (server.status) {
          console.log(`      Status: ${server.status}`);
        }
      }
    } else {
      console.log('   ⚠️  No MCP servers configured or enabled');
    }

    console.log('\n✅ MCP Servers startup complete\n');

    return status;
  } catch (error) {
    console.error('❌ Failed to start MCP servers:', error);
    throw error;
  }
}

// Run if executed directly (check if this is the main module)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isMainModule) {
  startMCPServers()
    .then(() => {
      console.log('MCP servers started successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to start MCP servers:', error);
      process.exit(1);
    });
}

export default startMCPServers;

