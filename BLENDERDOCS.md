# Blender Diagram-to-3D Integration

This document provides comprehensive information about the Blender integration for the Automotive AI Platform, explaining how to set up and use the system that converts diagrams to 3D models using Blender, Claude AI, and Cursor.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Server Setup](#server-setup)
5. [API Endpoints](#api-endpoints)
6. [Frontend Integration](#frontend-integration)
7. [Example Use Cases](#example-use-cases)
8. [Troubleshooting](#troubleshooting)
9. [System Architecture](#system-architecture)

## Overview

This system allows you to convert diagrams to 3D models using Blender, Claude AI, and Cursor. The diagram is processed by Claude via the Model Context Protocol (MCP), which generates Blender code that creates a 3D model.

The integration provides functionality to:

- Generate 3D scenes from diagram images using Claude AI and Blender
- Execute custom Blender Python code
- Retrieve information about the current Blender scene
- Retrieve information about specific objects in the Blender scene

## Prerequisites

Before using the Blender integration, ensure you have:

1. **Blender** 3.0 or newer
2. **Python** 3.10 or newer
3. **uv package manager**
4. **Cursor IDE** installed and configured
5. **Node.js and npm** (for the Electron app)
6. The **Automotive AI Platform** backend server

## Installation

### 1. Install the uv package manager

**Windows:**
```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
set Path=C:\Users\[username]\.local\bin;%Path%
```

**macOS:**
```bash
brew install uv
```

**Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. Install BlenderMCP

```bash
# Install BlenderMCP using uv
uvx blender-mcp
```

### 3. Install the Blender Addon

1. Download the `addon.py` file from the BlenderMCP repository
2. Open Blender
3. Go to Edit > Preferences > Add-ons
4. Click "Install..." and select the `addon.py` file
5. Enable the addon by checking the box next to "Interface: Blender MCP"

### 4. Configure Cursor for MCP

1. Install Cursor IDE from [cursor.sh](https://cursor.sh/)
2. Add Cursor to your PATH:
   
   **Windows:**
   ```powershell
   $cursorPath = "$env:LOCALAPPDATA\Programs\Cursor\resources\app\bin"
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";$cursorPath", "User")
   ```
   
   **macOS:**
   ```bash
   sudo ln -s "/Applications/Cursor.app/Contents/MacOS/Cursor" /usr/local/bin/cursor
   ```
   
   **Linux:**
   ```bash
   sudo ln -s /opt/Cursor/cursor /usr/local/bin/cursor
   ```

3. Verify Cursor installation:
   ```bash
   cursor --version
   ```

4. Set up MCP in Cursor:
   - Go to Settings > MCP > Add Server
   - Add the Blender MCP server

### 5. Testing the Setup

1. Start Blender
2. In the 3D View sidebar (press N if not visible), find the "BlenderMCP" tab
3. Click "Connect to Claude"
4. Verify connection (you should see a success message)

## Server Setup

The Blender functionality is integrated into the main server through the following components:

- `blender.js` - Main initialization module
- `routes/blenderRoutes.js` - API routes definition
- `controllers/blenderController.js` - Request handling logic
- `utils/blenderUtils.js` and `utils/fileUtils.js` - Utility functions

The integration is automatically initialized when the main server starts through the `initializeBlender(app)` function call in `server.js`.

## API Endpoints

All Blender endpoints are available under the base path `/api/blender`.

### 1. Generate 3D Scene from Diagram

```
POST /api/blender/generate-scene
```

Creates a 3D scene in Blender based on an uploaded diagram image.

**Request:**
- Content-Type: `multipart/form-data`
- Body:
  - `diagram`: Image file (PNG, JPG, etc.)

**Response:**
```json
{
  "success": true,
  "render": "data:image/png;base64,..."
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

### 2. Get Scene Information

```
GET /api/blender/scene-info
```

Retrieves information about the current Blender scene.

**Response:**
```json
{
  "success": true,
  "sceneInfo": {
    "objects": ["Cube", "Camera", "Light"],
    "active_object": "Cube",
    "render_settings": {
      "resolution_x": 1200,
      "resolution_y": 800
    }
  }
}
```

### 3. Get Object Information

```
GET /api/blender/object-info/:objectName
```

Retrieves detailed information about a specific object in the Blender scene.

**Parameters:**
- `objectName`: The name of the object to query (e.g., "Cube")

**Response:**
```json
{
  "success": true,
  "objectInfo": {
    "name": "Cube",
    "type": "MESH",
    "location": [0, 0, 0],
    "rotation": [0, 0, 0],
    "scale": [1, 1, 1],
    "dimensions": [2, 2, 2],
    "material_slots": ["Material"]
  }
}
```

### 4. Execute Custom Blender Code

```
POST /api/blender/execute-code
```

Executes custom Python code in Blender.

**Request:**
- Content-Type: `application/json`
- Body:
```json
{
  "code": "import bpy\nbpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Code executed successfully",
  "render": "data:image/png;base64,..." // Optional, if a render was created
}
```

## Frontend Integration

### Setting Up the Frontend (Web Application)

1. **Configure Axios** (or your preferred HTTP client):

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 minutes, as Blender operations can take time
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;
```

2. **Create Blender Service Functions**:

```javascript
// blenderService.js
import api from './api';

export const blenderService = {
  // Generate scene from diagram image
  generateScene: async (imageFile) => {
    const formData = new FormData();
    formData.append('diagram', imageFile);

    const response = await api.post('/blender/generate-scene', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get current scene information
  getSceneInfo: async () => {
    const response = await api.get('/blender/scene-info');
    return response.data;
  },

  // Get information about a specific object
  getObjectInfo: async (objectName) => {
    const response = await api.get(`/blender/object-info/${encodeURIComponent(objectName)}`);
    return response.data;
  },

  // Execute custom Blender code
  executeCode: async (code) => {
    const response = await api.post('/blender/execute-code', { code });
    return response.data;
  }
};
```

### Electron App Integration

For integrating with an Electron application:

#### Electron preload.ts:
```typescript
contextBridge.exposeInMainWorld('electron', {
  // ...existing code
  sendDiagram: (diagramFile) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = Buffer.from(reader.result);
        ipcRenderer.invoke('process-diagram', buffer)
          .then(resolve)
          .catch(reject);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(diagramFile);
    });
  }
  // ...other methods
});
```

#### Electron main.ts (handling the diagram processing):
```typescript
ipcMain.handle('process-diagram', async (event, diagramBuffer) => {
  try {
    // Create a temporary file for the diagram
    const tmpDir = path.join(app.getPath('temp'), 'blender-diagrams');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const diagramPath = path.join(tmpDir, `diagram-${Date.now()}.png`);
    fs.writeFileSync(diagramPath, diagramBuffer);
    
    // Send to the backend
    const formData = new FormData();
    formData.append('diagram', fs.createReadStream(diagramPath));
    
    const response = await axios.post('http://localhost:5000/api/blender/generate-scene', formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 180000 // 3 minutes timeout
    });
    
    // Cleanup
    fs.unlinkSync(diagramPath);
    
    return response.data;
  } catch (error) {
    console.error('Error processing diagram:', error);
    throw error;
  }
});
```

### React Component Examples

#### 1. Generate Scene from Diagram

```jsx
import React, { useState } from 'react';
import { blenderService } from '../services/blenderService';

const BlenderSceneGenerator = () => {
  const [render, setRender] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      
      const result = await blenderService.generateScene(file);
      
      if (result.success) {
        setRender(result.render);
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error generating scene:', err);
      setError(err.message || 'Failed to generate scene');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Generate 3D Scene from Diagram</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} />
      
      {loading && <p>Processing... (this can take up to a minute)</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      
      {render && (
        <div>
          <h3>Rendered Result:</h3>
          <img 
            src={render} 
            alt="Blender Render" 
            style={{ maxWidth: '100%', border: '1px solid #ccc' }} 
          />
        </div>
      )}
    </div>
  );
};

export default BlenderSceneGenerator;
```

## Example Use Cases

### 1. Automotive Part Visualization

Upload diagrams of automotive parts to generate 3D models that can be used for visualization, training, or documentation purposes.

### 2. Interactive Vehicle Configuration

Create custom Blender scripts to modify vehicle models based on user selections (color, wheels, accessories).

### 3. Mechanical Diagram Interpretation

Use the system to analyze mechanical diagrams and convert them into 3D representations for better understanding of complex systems.

### 4. Repair Procedure Visualization

Generate 3D visualizations of repair procedures from 2D diagrams to assist technicians with complex repairs.

## Troubleshooting

### Common Issues and Solutions

#### 1. 500 Internal Server Error when uploading diagrams

**Possible causes:**
- File too large
- Cursor CLI not properly installed or configured
- Blender MCP not running
- Temp directory permissions issues

**Solutions:**
- Check server logs for detailed error messages
- Verify Cursor CLI is installed and working from command line
- Ensure Blender is running with MCP addon enabled
- Check permissions on the temp directory
- Try with a smaller test image

#### 2. Long processing times

The image analysis and 3D model generation can take time, especially for complex diagrams. The default timeout for requests is set to 2 minutes, but you may need to increase this for complex operations.

#### 3. Poor quality 3D models

If the generated 3D models don't match expectations:
- Try using clearer, higher contrast diagrams
- Adjust the prompt in `controllers/blenderController.js` to provide more specific instructions
- Consider preprocessing the diagrams to enhance clarity

#### 4. CORS issues

If you encounter CORS errors when making requests from your frontend:
- Ensure your frontend origin is included in the `allowedOrigins` array in `server.js`
- Verify the CORS middleware is correctly configured

#### 5. Connection Issues

- **"Cursor Not Found"**: Ensure Cursor is installed and in your PATH
- **"Blender Connection Failed"**: Verify the addon is enabled in Blender
- **"Invalid Response from Claude"**: Check that you have access to Claude via Cursor
- **"MCP Server Not Starting"**: Make sure no other instance is running
- **"Error: Cursor did not generate a response file"**: Verify Cursor CLI is in your PATH and functioning correctly

### Logging and Debugging

To enable more detailed logging, modify the controllers to include additional console logs. Key areas to add logging:

1. File upload process
2. Cursor CLI execution
3. Blender code execution via MCP
4. Render file creation

Example debug logging to add to `blenderController.js`:

```javascript
// Debug-level logging
console.debug(`Uploaded file: ${req.file.originalname}, size: ${req.file.size} bytes`);
console.debug(`Temp files created at: ${JSON.stringify(paths)}`);
console.debug(`Cursor command: ${cursorCommand}`);
```

For production deployments, consider implementing a more sophisticated logging solution that captures logs to files for post-mortem analysis.

## System Architecture

```
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│               │    │               │    │               │
│  Electron App ├───►│  Cursor MCP   ├───►│    Claude     │
│               │    │               │    │               │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        │                    │                    │
        │                    ▼                    │
        │            ┌───────────────┐            │
        │            │               │            │
        │            │  Blender MCP  │◄───────────┘
        │            │   Addon       │
        │            │               │
        │            └───────┬───────┘
        │                    │
        │                    ▼
        │            ┌───────────────┐
        │            │               │
        └───────────►│    Blender    │
                     │               │
                     └───────────────┘
```

The diagram illustrates the flow of information in the system:

1. The Electron App sends a diagram to the backend server
2. The server uses Cursor CLI to communicate with Claude
3. Claude analyzes the diagram and generates Blender code
4. The Blender code is sent to Blender via the MCP addon
5. Blender executes the code, creating a 3D model
6. A render of the model is sent back to the Electron App for display 