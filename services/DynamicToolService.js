import mongoose from 'mongoose';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { DynamicTool, ToolExecutionContext } from '../models/dynamicTool.model.js';

dotenv.config();

const openai = new OpenAI();

class DynamicToolService {
  constructor() {
    this.toolRegistry = new Map();
    this.executionContexts = new Map();
    this.initializeDefaultTools();
  }

  /**
   * Initialize default tools that can be extended
   */
  async initializeDefaultTools() {
    try {
      // Check if tools already exist
      const existingTools = await DynamicTool.countDocuments();
      if (existingTools > 0) {
        console.log(`✅ Dynamic Tool Service: ${existingTools} tools already loaded`);
        return;
      }

      // Create default automotive tools
      const defaultTools = [
        {
          id: 'obd2_scan_devices',
          name: 'scan_obd2_devices',
          description: 'Scans for available OBD2 devices via Bluetooth',
          category: 'obd2-connection',
          agentSource: 'pidAgent',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false
          },
          implementation: {
            type: 'api_call',
            apiEndpoint: '/api/obd2/scan-devices',
            timeout: 10000
          },
          metadata: {
            version: '1.0.0',
            author: 'system',
            tags: ['obd2', 'bluetooth', 'scanning'],
            uiImpact: {
              type: 'notification',
              timing: 'immediate'
            },
            permissions: {
              read: true,
              write: false,
              execute: true
            }
          }
        },
        {
          id: 'obd2_get_live_data',
          name: 'get_obd2_live_data',
          description: 'Retrieves live OBD2 data from connected vehicle',
          category: 'obd2-data',
          agentSource: 'pidAgent',
          parameters: {
            type: 'object',
            properties: {
              pids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific PIDs to retrieve (optional)'
              }
            },
            required: [],
            additionalProperties: false
          },
          implementation: {
            type: 'api_call',
            apiEndpoint: '/api/obd2/live-data',
            timeout: 5000
          },
          metadata: {
            version: '1.0.0',
            author: 'system',
            tags: ['obd2', 'live-data', 'pids'],
            uiImpact: {
              type: 'dashboard',
              element: 'obd2-data-display',
              timing: 'immediate'
            },
            dependencies: ['obd2_connect_device'],
            permissions: {
              read: true,
              write: false,
              execute: true
            }
          }
        },
        {
          id: 'dtc_lookup_enhanced',
          name: 'dtc_lookup_enhanced',
          description: 'Enhanced DTC lookup with AI-powered analysis',
          category: 'dtc-analysis',
          agentSource: 'pidAgent',
          parameters: {
            type: 'object',
            properties: {
              dtc_codes: {
                type: 'array',
                items: { type: 'string' },
                description: 'DTC codes to lookup and analyze'
              },
              include_solutions: {
                type: 'boolean',
                description: 'Include potential solutions',
                default: true
              },
              analysis_depth: {
                type: 'string',
                enum: ['basic', 'detailed', 'comprehensive'],
                description: 'Depth of analysis',
                default: 'detailed'
              }
            },
            required: ['dtc_codes'],
            additionalProperties: false
          },
          implementation: {
            type: 'ai_generated',
            aiPrompt: 'Analyze the provided DTC codes and provide detailed diagnostic information including potential causes, symptoms, and repair procedures.',
            timeout: 15000
          },
          metadata: {
            version: '1.0.0',
            author: 'system',
            tags: ['dtc', 'analysis', 'ai', 'diagnostics'],
            uiImpact: {
              type: 'modal',
              element: 'dtc-analysis-modal',
              timing: 'delayed',
              delay: 1000
            },
            permissions: {
              read: true,
              write: false,
              execute: true
            }
          }
        }
      ];

      // Insert default tools
      await DynamicTool.insertMany(defaultTools);
      console.log(`✅ Dynamic Tool Service: Initialized ${defaultTools.length} default tools`);
    } catch (error) {
      console.error('❌ Error initializing default tools:', error);
    }
  }

  /**
   * Generate a new tool using AI
   */
  async generateTool(toolSpec) {
    try {
      const { name, description, category, agentSource, requirements } = toolSpec;

      // Use OpenAI to generate tool implementation
      const prompt = `
        Generate a JavaScript function implementation for an automotive diagnostic tool with the following specifications:
        
        Name: ${name}
        Description: ${description}
        Category: ${category}
        Agent Source: ${agentSource}
        Requirements: ${requirements}
        
        The function should:
        1. Be automotive-focused and practical
        2. Handle errors gracefully
        3. Return meaningful results
        4. Be compatible with the existing tool system
        5. Include proper parameter validation
        
        Return only the JavaScript function code, no explanations.
      `;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert automotive software developer. Generate clean, efficient JavaScript functions for automotive diagnostic tools.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      const generatedCode = completion.choices[0].message.content;

      // Create tool definition
      const toolDefinition = {
        id: `generated_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        name,
        description,
        category,
        agentSource,
        parameters: this.generateParametersFromRequirements(requirements),
        implementation: {
          type: 'function',
          code: generatedCode,
          timeout: 30000
        },
        metadata: {
          version: '1.0.0',
          author: 'ai-generated',
          tags: [category, 'ai-generated'],
          uiImpact: {
            type: 'notification',
            timing: 'immediate'
          },
          permissions: {
            read: true,
            write: false,
            execute: true
          }
        },
        status: 'draft'
      };

      return toolDefinition;
    } catch (error) {
      console.error('❌ Error generating tool:', error);
      throw new Error(`Failed to generate tool: ${error.message}`);
    }
  }

  /**
   * Register a new dynamic tool
   */
  async registerTool(toolDefinition) {
    try {
      // Validate tool definition
      this.validateToolDefinition(toolDefinition);

      // Check for conflicts
      const conflicts = await this.checkToolConflicts(toolDefinition);
      if (conflicts.length > 0) {
        throw new Error(`Tool conflicts detected: ${conflicts.join(', ')}`);
      }

      // Save to database
      const tool = new DynamicTool(toolDefinition);
      await tool.save();

      // Add to runtime registry
      this.toolRegistry.set(tool.id, tool);

      console.log(`✅ Dynamic Tool Service: Registered tool "${tool.name}"`);
      return tool;
    } catch (error) {
      console.error('❌ Error registering tool:', error);
      throw error;
    }
  }

  /**
   * Execute a dynamic tool
   */
  async executeTool(toolId, parameters, context) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      // Get tool definition
      const tool = await DynamicTool.findById(toolId);
      if (!tool) {
        throw new Error(`Tool not found: ${toolId}`);
      }

      // Create execution context
      const executionContext = new ToolExecutionContext({
        sessionId: context.sessionId,
        agentId: context.agentId,
        toolId,
        executionId,
        input: parameters,
        status: 'running',
        timestamp: new Date()
      });
      await executionContext.save();

      // Store in runtime context
      this.executionContexts.set(executionId, executionContext);

      const startTime = Date.now();
      let result;

      // Execute based on implementation type
      switch (tool.implementation.type) {
        case 'function':
          result = await this.executeFunctionTool(tool, parameters, context);
          break;
        case 'api_call':
          result = await this.executeApiCallTool(tool, parameters, context);
          break;
        case 'webhook':
          result = await this.executeWebhookTool(tool, parameters, context);
          break;
        case 'ai_generated':
          result = await this.executeAiGeneratedTool(tool, parameters, context);
          break;
        default:
          throw new Error(`Unknown implementation type: ${tool.implementation.type}`);
      }

      const executionTime = Date.now() - startTime;

      // Update execution context
      executionContext.status = 'completed';
      executionContext.output = result;
      executionContext.executionTime = executionTime;
      await executionContext.save();

      // Update tool usage statistics
      await this.updateToolUsage(toolId, executionTime, true);

      return {
        success: true,
        result,
        executionId,
        executionTime
      };
    } catch (error) {
      console.error('❌ Error executing tool:', error);

      // Update execution context with error
      const executionContext = this.executionContexts.get(executionId);
      if (executionContext) {
        executionContext.status = 'failed';
        executionContext.error = error.message;
        await executionContext.save();
      }

      // Update tool usage statistics
      await this.updateToolUsage(toolId, 0, false);

      throw error;
    }
  }

  /**
   * Execute a function-based tool
   */
  async executeFunctionTool(tool, parameters, context) {
    try {
      // Create a safe execution environment
      const safeEval = (code, params) => {
        // Create a function with limited scope
        const func = new Function('parameters', 'context', 'console', code);
        return func(parameters, context, console);
      };

      return await safeEval(tool.implementation.code, parameters);
    } catch (error) {
      throw new Error(`Function execution error: ${error.message}`);
    }
  }

  /**
   * Execute an API call tool
   */
  async executeApiCallTool(tool, parameters, context) {
    try {
      const response = await fetch(tool.implementation.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': context.authToken || ''
        },
        body: JSON.stringify({
          parameters,
          context: {
            sessionId: context.sessionId,
            agentId: context.agentId
          }
        }),
        timeout: tool.implementation.timeout || 30000
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`API call error: ${error.message}`);
    }
  }

  /**
   * Execute a webhook tool
   */
  async executeWebhookTool(tool, parameters, context) {
    try {
      const response = await fetch(tool.implementation.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tool-ID': tool.id,
          'X-Session-ID': context.sessionId
        },
        body: JSON.stringify({
          tool: tool.name,
          parameters,
          context
        }),
        timeout: tool.implementation.timeout || 30000
      });

      if (!response.ok) {
        throw new Error(`Webhook call failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Webhook call error: ${error.message}`);
    }
  }

  /**
   * Execute an AI-generated tool
   */
  async executeAiGeneratedTool(tool, parameters, context) {
    try {
      const prompt = `${tool.implementation.aiPrompt}\n\nParameters: ${JSON.stringify(parameters)}\nContext: ${JSON.stringify(context)}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an automotive diagnostic expert. Provide accurate, helpful responses for automotive diagnostic tasks.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      return {
        result: completion.choices[0].message.content,
        usage: completion.usage
      };
    } catch (error) {
      throw new Error(`AI generation error: ${error.message}`);
    }
  }

  /**
   * Get tools for a specific agent
   */
  async getToolsForAgent(agentId) {
    try {
      const tools = await DynamicTool.find({
        agentSource: agentId,
        status: 'active'
      }).sort({ createdAt: -1 });

      return tools.map(tool => this.formatToolForAgent(tool));
    } catch (error) {
      console.error('❌ Error getting tools for agent:', error);
      throw error;
    }
  }

  /**
   * Format tool for agent consumption
   */
  formatToolForAgent(tool) {
    return {
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      metadata: {
        id: tool.id,
        category: tool.category,
        uiImpact: tool.metadata.uiImpact,
        permissions: tool.metadata.permissions
      }
    };
  }

  /**
   * Update tool usage statistics
   */
  async updateToolUsage(toolId, executionTime, success) {
    try {
      const tool = await DynamicTool.findById(toolId);
      if (!tool) return;

      tool.usage.callCount += 1;
      tool.usage.lastUsed = new Date();
      
      // Update success rate
      const totalCalls = tool.usage.callCount;
      const currentSuccessRate = tool.usage.successRate;
      const newSuccessRate = ((currentSuccessRate * (totalCalls - 1)) + (success ? 1 : 0)) / totalCalls;
      tool.usage.successRate = newSuccessRate;

      // Update average execution time
      const currentAvgTime = tool.usage.averageExecutionTime;
      const newAvgTime = ((currentAvgTime * (totalCalls - 1)) + executionTime) / totalCalls;
      tool.usage.averageExecutionTime = newAvgTime;

      await tool.save();
    } catch (error) {
      console.error('❌ Error updating tool usage:', error);
    }
  }

  /**
   * Validate tool definition
   */
  validateToolDefinition(toolDefinition) {
    const required = ['id', 'name', 'description', 'category', 'agentSource', 'parameters', 'implementation'];
    
    for (const field of required) {
      if (!toolDefinition[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!toolDefinition.implementation.type) {
      throw new Error('Implementation type is required');
    }

    const validTypes = ['function', 'api_call', 'webhook', 'ai_generated'];
    if (!validTypes.includes(toolDefinition.implementation.type)) {
      throw new Error(`Invalid implementation type: ${toolDefinition.implementation.type}`);
    }
  }

  /**
   * Check for tool conflicts
   */
  async checkToolConflicts(toolDefinition) {
    const conflicts = [];

    // Check for name conflicts
    const existingTool = await DynamicTool.findOne({ name: toolDefinition.name });
    if (existingTool) {
      conflicts.push(`Name conflict with existing tool: ${toolDefinition.name}`);
    }

    // Check for ID conflicts
    const existingId = await DynamicTool.findOne({ id: toolDefinition.id });
    if (existingId) {
      conflicts.push(`ID conflict with existing tool: ${toolDefinition.id}`);
    }

    return conflicts;
  }

  /**
   * Generate parameters from requirements
   */
  generateParametersFromRequirements(requirements) {
    // Simple parameter generation based on requirements
    // This could be enhanced with AI to generate more sophisticated schemas
    return {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input data for the tool'
        }
      },
      required: ['input'],
      additionalProperties: false
    };
  }

  /**
   * Get tool execution history
   */
  async getToolExecutionHistory(toolId, limit = 50) {
    try {
      const executions = await ToolExecutionContext.find({ toolId })
        .sort({ timestamp: -1 })
        .limit(limit);

      return executions;
    } catch (error) {
      console.error('❌ Error getting tool execution history:', error);
      throw error;
    }
  }

  /**
   * Get tool analytics
   */
  async getToolAnalytics(toolId) {
    try {
      const tool = await DynamicTool.findById(toolId);
      if (!tool) {
        throw new Error(`Tool not found: ${toolId}`);
      }

      const recentExecutions = await ToolExecutionContext.find({ toolId })
        .sort({ timestamp: -1 })
        .limit(100);

      const analytics = {
        tool: {
          id: tool.id,
          name: tool.name,
          status: tool.status
        },
        usage: tool.usage,
        recentExecutions: recentExecutions.length,
        successRate: recentExecutions.length > 0 
          ? recentExecutions.filter(e => e.status === 'completed').length / recentExecutions.length
          : 0,
        averageExecutionTime: recentExecutions.length > 0
          ? recentExecutions.reduce((sum, e) => sum + (e.executionTime || 0), 0) / recentExecutions.length
          : 0
      };

      return analytics;
    } catch (error) {
      console.error('❌ Error getting tool analytics:', error);
      throw error;
    }
  }
}

export default DynamicToolService;