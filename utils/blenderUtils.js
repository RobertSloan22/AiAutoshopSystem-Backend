import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

/**
 * Creates a Blender script that includes rendering setup
 * @param {string} blenderCode - Python code for Blender
 * @param {string} renderPath - Path where the render should be saved
 * @returns {string} - Complete Blender script
 */
export const createBlenderScript = (blenderCode, renderPath) => {
  return `
${blenderCode}

# Setup rendering
import bpy
bpy.context.scene.render.filepath = "${renderPath.replace(/\\/g, '\\\\')}"
bpy.context.scene.render.resolution_x = 1200
bpy.context.scene.render.resolution_y = 800
bpy.context.scene.render.film_transparent = True
bpy.ops.render.render(write_still=True)
print(f"Render saved to: {bpy.context.scene.render.filepath}")
`;
};

/**
 * Creates an MCP command to execute Blender code
 * @param {string} scriptPath - Path to the Blender script
 * @returns {string} - MCP command
 */
export const createMCPCommand = (scriptPath) => {
  return `
import fs from 'fs';
const scriptPath = "${scriptPath.replace(/\\/g, '\\\\')}";
const blenderCode = fs.readFileSync(scriptPath, 'utf8');
mcp_blender_execute_blender_code({ code: blenderCode });
`;
};

/**
 * Execute code in Blender via MCP
 * @param {string} scriptPath - Path to the Blender script
 * @param {string} cursorScriptPath - Path for temporary cursor script
 * @returns {Promise} - Promise resolving with execution result
 */
export const executeBlenderCode = (scriptPath, cursorScriptPath) => {
  return new Promise((resolve, reject) => {
    // Save the MCP command to a temporary file
    const mcpCommand = createMCPCommand(scriptPath);
    fs.writeFileSync(cursorScriptPath, mcpCommand);
    
    // Execute the cursor script with MCP integration
    exec(`cursor run "${cursorScriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Blender code: ${error.message}`);
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
};

/**
 * Extracts Python code from Cursor LLM response
 * @param {string} cursorResponse - Response from Cursor
 * @returns {string|null} - Extracted Python code or null if not found
 */
export const extractBlenderCode = (cursorResponse) => {
  const codeMatch = cursorResponse.match(/```python\s*([\s\S]*?)\s*```/);
  if (!codeMatch || !codeMatch[1]) {
    return null;
  }
  return codeMatch[1];
}; 