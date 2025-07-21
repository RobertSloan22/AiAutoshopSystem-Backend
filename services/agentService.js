import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let agentProcess = null;

/**
 * Start the agent service as a separate process
 */
export const startAgentService = () => {
  try {
    console.log('Starting Agent Research Service...');
    
    // Path to the agent server script (TypeScript)
    const agentServerPath = path.join(__dirname, '../agent-service/server.js');
    
    // Create a new agent process using node to run JavaScript directly
    agentProcess = spawn('node', [agentServerPath], {
      env: { 
        ...process.env,
        NODE_OPTIONS: '--no-warnings' // Suppress TypeScript warnings
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '../agent-service') // Make sure we're in the agent-service directory
    });
    
    // Handle output from the agent process
    agentProcess.stdout.on('data', (data) => {
      console.log(`[Agent Service] ${data.toString().trim()}`);
    });
    
    agentProcess.stderr.on('data', (data) => {
      console.error(`[Agent Service Error] ${data.toString().trim()}`);
    });
    
    // Handle agent process exit
    agentProcess.on('close', (code) => {
      console.log(`Agent Service process exited with code ${code}`);
      // Attempt to restart the agent service if it crashes
      if (code !== 0 && code !== null) {
        console.log('Attempting to restart Agent Service in 5 seconds...');
        setTimeout(() => {
          startAgentService();
        }, 5000);
      }
    });
    
    console.log('Agent Research Service started successfully');
    return true;
  } catch (error) {
    console.error('Failed to start Agent Research Service:', error);
    return false;
  }
};

/**
 * Stop the agent service
 */
export const stopAgentService = () => {
  if (agentProcess) {
    console.log('Stopping Agent Research Service...');
    agentProcess.kill();
    agentProcess = null;
    return true;
  }
  return false;
};

// Handle process exit to properly clean up
process.on('exit', () => {
  stopAgentService();
});

process.on('SIGINT', () => {
  stopAgentService();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAgentService();
  process.exit(0);
});