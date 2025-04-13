import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';
import { extractBlenderCode, createBlenderScript, executeBlenderCode } from '../utils/blenderUtils.js';
import { createTempFilePaths, fileToBase64, cleanupTempFiles, TEMP_DIR } from '../utils/fileUtils.js';

// Define temporary directory - now imported from fileUtils
// const TEMP_DIR = path.join(process.cwd(), 'temp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  console.log(`Created temporary directory: ${TEMP_DIR}`);
}

/**
 * Generate a 3D scene from a diagram image
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const generateScene = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No diagram file provided' });
    }
    
    // Create unique filenames using timestamp
    const timestamp = Date.now();
    const paths = {
      diagram: path.join(TEMP_DIR, `diagram-${timestamp}.png`),
      cursorScript: path.join(TEMP_DIR, `cursor-script-${timestamp}.js`),
      render: path.join(TEMP_DIR, `render-${timestamp}.png`)
    };
    
    // Save the uploaded diagram
    fs.writeFileSync(paths.diagram, req.file.buffer);
    console.log(`Diagram saved to: ${paths.diagram}`);
    
    // Create a simplified script that focuses on the MCP integration
    const mcpScript = `
      import fs from 'fs';
      
      // Read the diagram image
      const diagramPath = "${paths.diagram.replace(/\\/g, '\\\\')}";
      const imageBuffer = fs.readFileSync(diagramPath);
      const base64Image = imageBuffer.toString('base64');
      
      // Define render output path
      const renderPath = "${paths.render.replace(/\\/g, '\\\\')}";
      
      async function generateModel() {
        try {
          console.log("Starting Blender generation process...");
          
          // Import the cursor API
          const { cursor } = await import('@cursor/cursor-api');
          
          // Create the prompt for model generation
          const prompt = \`
            Analyze this diagram and create detailed Blender Python code that accurately recreates it as a 3D model.
            The code should include proper setup, materials, and camera positioning.
            Make sure to include rendering code that saves the output to the specified path.
          \`;
          
          console.log("Sending image to Claude...");
          const response = await cursor.chat.complete(prompt, {
            attachments: [{ type: "image", data: base64Image }]
          });
          
          console.log("Received response from Claude");
          
          // Extract Python code from the response
          const text = response.text || response.toString();
          console.log("Claude response length:", text.length);
          
          const codeMatch = text.match(/\`\`\`python\\n([\\s\\S]*?)\\n\`\`\`/) || 
                           text.match(/\`\`\`([\\s\\S]*?)\`\`\`/);
          
          if (!codeMatch) {
            console.error("No code found in Claude response");
            return false;
          }
          
          // Add explicit rendering code to ensure output is saved
          const blenderCode = codeMatch[1] + \`
          
          # Setup rendering
          import bpy
          
          # Ensure the render path is set
          print("Setting render filepath to: ${paths.render.replace(/\\/g, '\\\\')}")
          bpy.context.scene.render.filepath = "${paths.render.replace(/\\/g, '\\\\')}"
          bpy.context.scene.render.resolution_x = 1200
          bpy.context.scene.render.resolution_y = 800
          bpy.context.scene.render.film_transparent = True
          
          # Force render and save
          print("Starting render...")
          bpy.ops.render.render(write_still=True)
          print(f"Render completed and saved to: {bpy.context.scene.render.filepath}")
          \`;
          
          console.log("Executing Blender code via MCP...");
          // Import and use the MCP Blender execution function
          const { mcp_blender_execute_blender_code } = await import('@cursor/mcp');
          
          console.log("MCP module imported successfully");
          const result = await mcp_blender_execute_blender_code({ code: blenderCode });
          console.log("Blender execution complete with result:", JSON.stringify(result));
          
          return true;
        } catch (error) {
          console.error("Error in generateModel:", error);
          return false;
        }
      }
      
      // Execute the model generation and log results
      generateModel().then(success => {
        console.log("Model generation " + (success ? "succeeded" : "failed"));
        if (success) {
          console.log("Checking for render file:", "${paths.render.replace(/\\/g, '\\\\')}");
          if (fs.existsSync("${paths.render.replace(/\\/g, '\\\\')}")) {
            console.log("Render file exists!");
          } else {
            console.log("Render file does not exist!");
          }
        }
      });
    `;
    
    // Save the Cursor script
    fs.writeFileSync(paths.cursorScript, mcpScript);
    console.log("Cursor script saved to:", paths.cursorScript);
    
    // Execute the script with Cursor
    console.log("Running Cursor script:", paths.cursorScript);
    const cursorCommand = `node "${paths.cursorScript}"`;
    
    exec(cursorCommand, (error, stdout, stderr) => {
      if (error) {
        console.error("Cursor execution error:", error);
        console.error("Stdout:", stdout);
        console.error("Stderr:", stderr);
        return res.status(500).json({ 
          success: false, 
          error: `Failed to process with Cursor: ${error.message}`,
          details: { stdout, stderr }
        });
      }
      
      console.log("Cursor execution complete. Checking for render...");
      console.log("Stdout:", stdout);
      
      // Wait for render to complete
      setTimeout(() => {
        if (fs.existsSync(paths.render)) {
          console.log("Render file found:", paths.render);
          
          // Read the render as base64
          const renderData = fs.readFileSync(paths.render);
          const renderBase64 = renderData.toString('base64');
          
          // Return success with rendered image
          res.json({ 
            success: true, 
            render: `data:image/png;base64,${renderBase64}`
          });
        } else {
          console.error("Render file not found:", paths.render);
          res.status(500).json({ 
            success: false, 
            error: 'Render not created by Blender',
            details: { stdout }
          });
        }
      }, 15000); // Increased timeout to 15 seconds for rendering
    });
  } catch (error) {
    console.error("Server error in generateScene:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get scene information from Blender
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getSceneInfo = async (req, res) => {
  try {
    // Create temporary file path
    const timestamp = Date.now();
    const cursorScriptPath = path.join(TEMP_DIR, `scene-info-${timestamp}.js`);
    
    console.log(`Getting scene info from Blender...`);
    
    // Create MCP command for getting scene info
    const mcpCommand = `
import fs from 'fs';
import path from 'path';

// Execution function to handle MCP calls
async function executeCommand() {
  try {
    const { mcp_blender_get_scene_info } = await import('@cursor/mcp');
    const sceneInfo = await mcp_blender_get_scene_info({ random_string: "get_scene" });
    return sceneInfo;
  } catch (error) {
    console.error('Error getting scene info:', error);
    return { error: error.message };
  }
}

// Execute and log results
executeCommand().then(result => {
  console.log(JSON.stringify(result));
});
`;
    
    // Save the MCP command to a temporary file
    fs.writeFileSync(cursorScriptPath, mcpCommand);
    
    // Execute the command
    exec(`node "${cursorScriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error getting scene info: ${error.message}`);
        return res.status(500).json({ success: false, error: `Failed to get scene info: ${error.message}` });
      }
      
      // Process the output to find the JSON object
      try {
        const jsonMatch = stdout.match(/{[\s\S]*}/);
        if (jsonMatch) {
          const sceneInfo = JSON.parse(jsonMatch[0]);
          return res.json({ success: true, sceneInfo });
        } else {
          return res.status(500).json({ success: false, error: 'Could not parse scene info' });
        }
      } catch (parseError) {
        console.error(`Error parsing scene info: ${parseError.message}`);
        return res.status(500).json({ success: false, error: `Failed to parse scene info: ${parseError.message}`, stdout });
      }
    });
  } catch (error) {
    console.error(`Server error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get object information from Blender
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getObjectInfo = async (req, res) => {
  try {
    const { objectName } = req.params;
    
    if (!objectName) {
      return res.status(400).json({ success: false, error: 'Object name is required' });
    }
    
    // Create temporary file path
    const timestamp = Date.now();
    const cursorScriptPath = path.join(TEMP_DIR, `object-info-${timestamp}.js`);
    
    console.log(`Getting object info from Blender for ${objectName}...`);
    
    // Create MCP command for getting object info
    const mcpCommand = `
import fs from 'fs';
import path from 'path';

// Execution function to handle MCP calls
async function executeCommand() {
  try {
    const { mcp_blender_get_object_info } = await import('@cursor/mcp');
    const objectInfo = await mcp_blender_get_object_info({ object_name: "${objectName}" });
    return objectInfo;
  } catch (error) {
    console.error('Error getting object info:', error);
    return { error: error.message };
  }
}

// Execute and log results
executeCommand().then(result => {
  console.log(JSON.stringify(result));
});
`;
    
    // Save the MCP command to a temporary file
    fs.writeFileSync(cursorScriptPath, mcpCommand);
    
    // Execute the command
    exec(`node "${cursorScriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error getting object info: ${error.message}`);
        return res.status(500).json({ success: false, error: `Failed to get object info: ${error.message}` });
      }
      
      // Process the output to find the JSON object
      try {
        const jsonMatch = stdout.match(/{[\s\S]*}/);
        if (jsonMatch) {
          const objectInfo = JSON.parse(jsonMatch[0]);
          return res.json({ success: true, objectInfo });
        } else {
          return res.status(500).json({ success: false, error: 'Could not parse object info' });
        }
      } catch (parseError) {
        console.error(`Error parsing object info: ${parseError.message}`);
        return res.status(500).json({ success: false, error: `Failed to parse object info: ${parseError.message}`, stdout });
      }
    });
  } catch (error) {
    console.error(`Server error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Execute custom Blender code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const executeCustomCode = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'Blender code is required' });
    }
    
    // Create temporary file paths
    const timestamp = Date.now();
    const scriptPath = path.join(TEMP_DIR, `blender-script-${timestamp}.py`);
    const cursorScriptPath = path.join(TEMP_DIR, `cursor-script-${timestamp}.js`); 
    const renderPath = path.join(TEMP_DIR, `render-${timestamp}.png`);
    
    // Prepare the script with rendering capability
    const finalBlenderScript = createBlenderScript(code, renderPath);
    
    // Save the script
    fs.writeFileSync(scriptPath, finalBlenderScript);
    
    console.log(`Executing custom Blender code via MCP...`);
    
    try {
      // Execute the Blender code
      await executeBlenderCode(scriptPath, cursorScriptPath);
      
      console.log(`Blender execution complete, checking for render...`);
      
      // Wait for the render to be created
      setTimeout(() => {
        let responseData = { success: true, message: 'Code executed successfully' };
        
        // If a render was created, include it
        if (fs.existsSync(renderPath)) {
          const renderData = fs.readFileSync(renderPath);
          const renderBase64 = renderData.toString('base64');
          responseData.render = `data:image/png;base64,${renderBase64}`;
        }
        
        res.json(responseData);
      }, 5000); // Wait 5 seconds for render to complete
    } catch (mcpError) {
      console.error(`Error executing Blender via MCP: ${mcpError.message}`);
      res.status(500).json({ success: false, error: `Failed to execute in Blender: ${mcpError.message}` });
    }
  } catch (error) {
    console.error(`Server error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
}; 