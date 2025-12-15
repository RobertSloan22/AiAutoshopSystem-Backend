import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class OpenAIContainerService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.error('WARNING: OPENAI_API_KEY environment variable is not set');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.activeContainers = new Map(); // Track active containers
    this.containerExpiryTime = 20 * 60 * 1000; // 20 minutes in milliseconds
    
    // Cleanup expired containers every 5 minutes
    setInterval(() => {
      this.cleanupExpiredContainers();
    }, 5 * 60 * 1000);
  }

  /**
   * Create a new container
   * @param {string} name - Container name
   * @param {Array} fileIds - Optional file IDs to include
   * @returns {Object} Container object
   */
  async createContainer(name, fileIds = []) {
    try {
      const container = await this.openai.containers.create({
        name: name || `container_${Date.now()}`,
        file_ids: fileIds
      });

      // Track the container
      this.activeContainers.set(container.id, {
        ...container,
        createdAt: Date.now(),
        lastUsed: Date.now()
      });

      console.log(`✅ Created OpenAI container: ${container.id}`);
      return container;
    } catch (error) {
      console.error('❌ Failed to create container:', error);
      throw error;
    }
  }

  /**
   * Get container by ID
   * @param {string} containerId - Container ID
   * @returns {Object} Container object
   */
  async getContainer(containerId) {
    try {
      const container = await this.openai.containers.retrieve(containerId);
      
      // Update last used time
      if (this.activeContainers.has(containerId)) {
        this.activeContainers.get(containerId).lastUsed = Date.now();
      }

      return container;
    } catch (error) {
      console.error(`❌ Failed to get container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * List all containers
   * @param {Object} options - Query options
   * @returns {Array} List of containers
   */
  async listContainers(options = {}) {
    try {
      const containers = await this.openai.containers.list(options);
      return containers.data;
    } catch (error) {
      console.error('❌ Failed to list containers:', error);
      throw error;
    }
  }

  /**
   * Delete a container
   * @param {string} containerId - Container ID
   * @returns {Object} Deletion result
   */
  async deleteContainer(containerId) {
    try {
      const result = await this.openai.containers.del(containerId);
      
      // Remove from tracking
      this.activeContainers.delete(containerId);
      
      console.log(`✅ Deleted container: ${containerId}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to delete container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Upload a file to a container
   * @param {string} containerId - Container ID
   * @param {Buffer|File} file - File data
   * @param {string} filename - File name
   * @returns {Object} File object
   */
  async uploadFile(containerId, file, filename) {
    try {
      const containerFile = await this.openai.containerFiles.create({
        container_id: containerId,
        file: file,
        purpose: 'assistants'
      });

      console.log(`✅ Uploaded file ${filename} to container ${containerId}`);
      return containerFile;
    } catch (error) {
      console.error(`❌ Failed to upload file to container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * List files in a container
   * @param {string} containerId - Container ID
   * @returns {Array} List of files
   */
  async listContainerFiles(containerId) {
    try {
      const files = await this.openai.containerFiles.list(containerId);
      return files.data;
    } catch (error) {
      console.error(`❌ Failed to list files in container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Download file content from container
   * @param {string} containerId - Container ID
   * @param {string} fileId - File ID
   * @returns {Buffer} File content
   */
  async downloadFile(containerId, fileId) {
    try {
      const file = await this.openai.containerFiles.retrieve(containerId, fileId);
      return file;
    } catch (error) {
      console.error(`❌ Failed to download file ${fileId} from container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Execute code using OpenAI's Code Interpreter
   * @param {string} containerId - Container ID
   * @param {string} instructions - Instructions for the model
   * @param {string} input - Input prompt
   * @param {Object} options - Additional options
   * @returns {Object} Response with code execution results
   */
  async executeCode(containerId, instructions, input, options = {}) {
    try {
      const response = await this.openai.responses.create({
        model: options.model || 'gpt-4o-mini',
        tools: [{
          type: 'code_interpreter',
          container: containerId
        }],
        instructions: instructions,
        input: input,
        tool_choice: options.tool_choice || 'auto',
        ...options
      });

      // Update container last used time
      if (this.activeContainers.has(containerId)) {
        this.activeContainers.get(containerId).lastUsed = Date.now();
      }

      return response;
    } catch (error) {
      console.error(`❌ Failed to execute code in container ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Execute code with auto container creation
   * @param {string} instructions - Instructions for the model
   * @param {string} input - Input prompt
   * @param {Object} options - Additional options
   * @returns {Object} Response with code execution results
   */
  async executeCodeAuto(instructions, input, options = {}) {
    try {
      const response = await this.openai.responses.create({
        model: options.model || 'gpt-4o-mini',
        tools: [{
          type: 'code_interpreter',
          container: { type: 'auto' }
        }],
        instructions: instructions,
        input: input,
        tool_choice: options.tool_choice || 'auto',
        ...options
      });

      // Extract container ID from response if available
      const containerId = this.extractContainerIdFromResponse(response);
      if (containerId) {
        this.activeContainers.set(containerId, {
          id: containerId,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          autoCreated: true
        });
      }

      return response;
    } catch (error) {
      console.error('❌ Failed to execute code with auto container:', error);
      throw error;
    }
  }

  /**
   * Extract container ID from response
   * @param {Object} response - OpenAI response
   * @returns {string|null} Container ID
   */
  extractContainerIdFromResponse(response) {
    try {
      // Look for container_file_citation annotations
      if (response.output && Array.isArray(response.output)) {
        for (const item of response.output) {
          if (item.annotations) {
            for (const annotation of item.annotations) {
              if (annotation.type === 'container_file_citation' && annotation.container_id) {
                return annotation.container_id;
              }
            }
          }
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to extract container ID from response:', error);
      return null;
    }
  }

  /**
   * Get or create container for session
   * @param {string} sessionId - Session ID
   * @param {string} name - Container name
   * @returns {Object} Container object
   */
  async getOrCreateContainerForSession(sessionId, name) {
    const containerName = name || `session_${sessionId}_${Date.now()}`;
    
    // Check if we already have an active container for this session
    for (const [containerId, container] of this.activeContainers.entries()) {
      if (container.sessionId === sessionId && !this.isContainerExpired(container)) {
        return await this.getContainer(containerId);
      }
    }

    // Create new container
    const container = await this.createContainer(containerName);
    container.sessionId = sessionId;
    this.activeContainers.set(container.id, {
      ...container,
      sessionId: sessionId,
      createdAt: Date.now(),
      lastUsed: Date.now()
    });

    return container;
  }

  /**
   * Check if container is expired
   * @param {Object} container - Container object
   * @returns {boolean} True if expired
   */
  isContainerExpired(container) {
    const now = Date.now();
    return (now - container.lastUsed) > this.containerExpiryTime;
  }

  /**
   * Cleanup expired containers
   */
  async cleanupExpiredContainers() {
    const now = Date.now();
    const expiredContainers = [];

    for (const [containerId, container] of this.activeContainers.entries()) {
      if (this.isContainerExpired(container)) {
        expiredContainers.push(containerId);
      }
    }

    for (const containerId of expiredContainers) {
      try {
        await this.deleteContainer(containerId);
        console.log(`🧹 Cleaned up expired container: ${containerId}`);
      } catch (error) {
        console.error(`❌ Failed to cleanup container ${containerId}:`, error);
      }
    }
  }

  /**
   * Get container status
   * @param {string} containerId - Container ID
   * @returns {Object} Container status
   */
  async getContainerStatus(containerId) {
    try {
      const container = await this.getContainer(containerId);
      const files = await this.listContainerFiles(containerId);
      
      return {
        id: container.id,
        name: container.name,
        status: container.status,
        createdAt: container.created_at,
        lastActiveAt: container.last_active_at,
        fileCount: files.length,
        isExpired: this.isContainerExpired(this.activeContainers.get(containerId) || { lastUsed: 0 })
      };
    } catch (error) {
      console.error(`❌ Failed to get container status ${containerId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active containers status
   * @returns {Array} List of container statuses
   */
  async getAllContainersStatus() {
    const statuses = [];
    
    for (const [containerId, container] of this.activeContainers.entries()) {
      try {
        const status = await this.getContainerStatus(containerId);
        statuses.push(status);
      } catch (error) {
        console.error(`❌ Failed to get status for container ${containerId}:`, error);
      }
    }
    
    return statuses;
  }
}

export default OpenAIContainerService;
