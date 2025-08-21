import OpenAI from 'openai';
import MCPService from './mcpService.js';
import PythonExecutionService from './pythonExecutionService.js';
import WebSearchService from './webSearchService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class ResponsesAPIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.error('WARNING: OPENAI_API_KEY environment variable is not set');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.mcpService = new MCPService(process.env.MCP_SERVER_URL || 'http://localhost:3700');
    this.pythonService = new PythonExecutionService();
    this.webSearchService = new WebSearchService();

    this.activeSessions = new Map();
    this.fallbackModels = ['gpt-3.5-turbo', 'claude-3-haiku-20240307'];
    this.primaryModel = 'gpt-4o-mini';
    
    // Set up periodic cleanup for Python outputs
    setInterval(() => {
      this.pythonService.cleanup().catch(err => 
        console.error('Python service cleanup error:', err)
      );
    }, 60 * 60 * 1000); // Clean up every hour
  }

  async createStreamingSession(message, vehicleContext = {}, customerContext = {}) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(vehicleContext, customerContext);
    
    // Get MCP tools, Python execution tool, and web search tools
    const mcpTools = this.mcpService.getToolDefinitions();
    const pythonTool = this.pythonService.getToolDefinition();
    const webSearchTools = this.webSearchService.getToolDefinitions();
    const tools = [...mcpTools, pythonTool, ...webSearchTools];
    // Get MCP tools and Python execution tool
    const mcpTools = this.mcpService.getToolDefinitions();
    const pythonTool = this.pythonService.getToolDefinition();
    const tools = [...mcpTools, pythonTool];
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    try {
      const stream = await this.openai.chat.completions.create({
        model: this.primaryModel,
        messages: messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        stream: true,
        response_format: { type: 'text' }
      });

      this.activeSessions.set(sessionId, {
        stream,
        messages,
        vehicleContext,
        customerContext,
        createdAt: Date.now()
      });

      return { sessionId, stream };
    } catch (error) {
      console.error('Failed to create OpenAI stream with primary model:', error);
      
      // Try fallback model if primary fails
      return this.createFallbackStreamingSession(message, vehicleContext, customerContext);
    }
  }

  async createFallbackStreamingSession(message, vehicleContext = {}, customerContext = {}) {
    const sessionId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(vehicleContext, customerContext);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    // Try each fallback model in sequence
    for (const fallbackModel of this.fallbackModels) {
      try {
        console.log(`Attempting fallback with model: ${fallbackModel}`);
        
        // Use fallback model without tools
        const stream = await this.openai.chat.completions.create({
          model: fallbackModel,
          messages: messages,
          stream: true,
          response_format: { type: 'text' }
        });

        this.activeSessions.set(sessionId, {
          stream,
          messages,
          vehicleContext,
          customerContext,
          createdAt: Date.now(),
          fallback: true,
          fallbackModel
        });

        console.log(`Successfully created fallback stream with model: ${fallbackModel}`);
        return { sessionId, stream, fallback: true, fallbackModel };
      } catch (fallbackError) {
        console.error(`Failed to create stream with fallback model ${fallbackModel}:`, fallbackError);
        // Continue to next fallback model
      }
    }

    // If all fallbacks fail, throw the error
    throw new Error('All streaming models failed to initialize');
  }

  // Simplified text-only response for emergency fallback
  async createTextFallbackResponse(message, vehicleContext = {}, customerContext = {}) {
    try {
      // Build system prompt with context
      const systemPrompt = this.buildSystemPrompt(vehicleContext, customerContext);
      
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ];

      // Use the most reliable model available with simple settings
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',  // Use the most stable model
        messages: messages,
        stream: false,  // No streaming to reduce complexity
        temperature: 0.7,
        max_tokens: 1000
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Failed to create text fallback response:', error);
      return "I'm sorry, I'm having trouble connecting to my services right now. Please try again in a few moments.";
    }
  }

  buildSystemPrompt(vehicleContext, customerContext) {
    let prompt = `You are an AI automotive diagnostic assistant with access to real-time OBD2 vehicle data through specialized tools and Python code execution capabilities for data analysis and visualization.

VEHICLE INFORMATION:`;

    if (vehicleContext?.year || vehicleContext?.make || vehicleContext?.model) {
      prompt += `
- Vehicle: ${vehicleContext.year || 'Unknown'} ${vehicleContext.make || 'Unknown'} ${vehicleContext.model || 'Unknown'}`;
    }
    
    if (vehicleContext?.vin) {
      prompt += `
- VIN: ${vehicleContext.vin}`;
    }

    if (customerContext?.name) {
      prompt += `

CUSTOMER INFORMATION:
- Customer: ${customerContext.name}`;
    }

    if (customerContext?.dtcCode) {
      prompt += `
- DTC Code Under Investigation: ${customerContext.dtcCode}`;
    }

    prompt += `

AVAILABLE TOOLS:
You have access to the following diagnostic and analysis tools:

OBD2 DIAGNOSTIC TOOLS:
- scan_obd2_adapters: Scan for available Bluetooth OBD2 adapters
- connect_obd2_adapter: Connect to a specific OBD2 adapter  
- get_obd2_live_data: Get real-time engine data (RPM, speed, temperature, etc.)
- read_dtc_codes: Read diagnostic trouble codes from the vehicle
- get_connection_status: Check current OBD2 connection status

PYTHON CODE EXECUTION:
- execute_python_code: Execute Python code with access to data analysis libraries
  * Available libraries: pandas, numpy, matplotlib, seaborn, scipy, sklearn
  * Can perform calculations, statistical analysis, and data visualization
  * Automatically saves generated plots as PNG files
  * Useful for analyzing sensor data trends, calculating performance metrics, etc.

WEB SEARCH CAPABILITIES:
- web_search: Search the web for current information, recalls, TSBs, and troubleshooting guides
  * Use for up-to-date information not in your training data
  * Search for recalls, technical service bulletins, and latest diagnostic procedures
  * Include vehicle context (make, model, year) for better results
  * Search types: general, automotive, technical, recall, tsb

- search_technical_images: Search for technical images and diagrams
  * Find wiring diagrams, parts diagrams, and diagnostic flowcharts
  * Search for visual guides and repair illustrations
  * Provide vehicle context for more relevant results
  * Image types: diagram, wiring, flowchart, parts, general


INSTRUCTIONS:
1. Use the appropriate tools to gather vehicle data when requested
2. When mathematical calculations or data analysis are needed, use the Python execution tool
3. Generate visualizations to help explain diagnostic findings when appropriate
4. Use web search tools to get current information about recalls, TSBs, and latest repair procedures
5. Search for technical diagrams when visual explanations would be helpful
6. Provide clear, professional diagnostic guidance
7. Always explain what you're doing when using tools
8. Include relevant vehicle context in your responses
9. Suggest specific diagnostic steps based on the data you collect
10. If asked about DTC codes, use the tools to read current codes and provide detailed explanations
11. When analyzing sensor data patterns, consider using Python to create trend charts
12. Use web search for recent recalls, TSBs, or when you need current information beyond your training data
13. Search for technical images when diagrams would help explain complex repairs or diagnostics
4. Provide clear, professional diagnostic guidance
5. Always explain what you're doing when using tools
6. Include relevant vehicle context in your responses
7. Suggest specific diagnostic steps based on the data you collect
8. If asked about DTC codes, use the tools to read current codes and provide detailed explanations
9. When analyzing sensor data patterns, consider using Python to create trend charts

PYTHON USAGE EXAMPLES:
- Calculate fuel efficiency from OBD2 data
- Plot engine temperature over time
- Analyze RPM vs speed relationships
- Create diagnostic trouble code frequency charts
- Perform statistical analysis on sensor readings

Be thorough, accurate, and helpful in your automotive diagnostic assistance. Use visualizations when they would help explain complex data patterns.`;

    return prompt;
  }

  async processToolCalls(toolCalls, sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Skip tool processing for fallback sessions
    if (session.fallback) {
      console.log('Skipping tool processing for fallback session');
      return [{
        tool_call_id: 'fallback',
        role: 'tool',
        content: JSON.stringify({
          message: 'Tool processing unavailable in fallback mode',
          status: 'fallback'
        })
      }];
    }

    const toolResults = [];

    for (const toolCall of toolCalls) {
      try {
        console.log(`Executing tool: ${toolCall.function.name}`);
        
        let parameters = {};
        if (toolCall.function.arguments) {
          try {
            parameters = typeof toolCall.function.arguments === 'string' 
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
          } catch (e) {
            parameters = {};
          }
        }

        let result;

        // Handle Python execution tool
        if (toolCall.function.name === 'execute_python_code') {
          console.log('Executing Python code...');
          result = await this.pythonService.executeCode(
            parameters.code,
            {
              save_plots: parameters.save_plots !== false,
              plot_filename: parameters.plot_filename,
              sessionId: sessionId,
              vehicleContext: session.vehicleContext,
              customerContext: session.customerContext,
              pythonCode: parameters.code
              plot_filename: parameters.plot_filename
            }
          );

          // Format the result for better display
          if (result.success) {
            let formattedResult = {
              success: true,
              output: result.output
            };

            // If plots were generated, include their paths
            if (result.plots && result.plots.length > 0) {
              formattedResult.plots_generated = result.plots.length;
              formattedResult.plot_paths = result.plots;
              
              // Process plot results with both API URLs and base64 data
              formattedResult.plots = [];
              for (const plotResult of result.plots) {
                const plotData = {
                  path: plotResult.path || plotResult, // Handle both new and old format
                  imageId: plotResult.imageId,
                  url: plotResult.imageId ? `/api/plots/${plotResult.imageId}` : null,
                  thumbnailUrl: plotResult.imageId ? `/api/plots/${plotResult.imageId}/thumbnail` : null
                };
                
                // Try to get base64 data from MongoDB first, then fallback to file system
                let base64Data = null;
                if (plotResult.imageId) {
                  const plotFromDB = await this.pythonService.getPlotFromDB(plotResult.imageId);
                  if (plotFromDB) {
                    base64Data = plotFromDB.base64Data;
                  }
                }
                
                // Fallback to file system if MongoDB doesn't have it
                if (!base64Data && plotData.path) {
                  base64Data = await this.pythonService.getPlotAsBase64(plotData.path);
                }
                
                if (base64Data) {
                  plotData.data = base64Data;
                }
                
                formattedResult.plots.push(plotData);
              // Try to get base64 data for the plots
              formattedResult.plots = [];
              for (const plotPath of result.plots) {
                const base64Data = await this.pythonService.getPlotAsBase64(plotPath);
                if (base64Data) {
                  formattedResult.plots.push({
                    path: plotPath,
                    data: base64Data
                  });
                }
              }
            }

            result = formattedResult;
          }
        } else if (['web_search', 'search_technical_images'].includes(toolCall.function.name)) {
          // Handle web search tools
          console.log(`Executing web search tool: ${toolCall.function.name}`);
          result = await this.webSearchService.executeTool(toolCall.function.name, parameters);

        } else {
          // Handle MCP tools
          result = await this.mcpService.callTool(toolCall.function.name, parameters);
        }
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result, null, 2)
        });

        console.log(`Tool ${toolCall.function.name} executed successfully`);
      } catch (error) {
        console.error(`Tool execution failed: ${toolCall.function.name}`, error);
        
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify({
            error: true,
            message: error.message,
            tool: toolCall.function.name
          })
        });
      }
    }

    return toolResults;
  }

  async continueStreamWithToolResults(sessionId, toolResults) {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // The last message should be an assistant message with tool_calls
    // We need to add the tool results right after it
    if (session.messages.length === 0 || session.messages[session.messages.length - 1].role !== 'assistant') {
      throw new Error('Invalid conversation state: expected assistant message with tool_calls');
    }

    // Add tool results to conversation - they must come immediately after the assistant message with tool_calls
    session.messages.push(...toolResults);

    // Log the conversation structure for debugging
    console.log('Conversation structure:', session.messages.map(m => ({
      role: m.role, 
      hasContent: !!m.content, 
      hasToolCalls: !!m.tool_calls,
      isToolResult: m.role === 'tool'
    })));

    // Get tools again in case they've changed
    const mcpTools = this.mcpService.getToolDefinitions();
    const pythonTool = this.pythonService.getToolDefinition();
    const webSearchTools = this.webSearchService.getToolDefinitions();
    const tools = [...mcpTools, pythonTool, ...webSearchTools];
    const tools = [...mcpTools, pythonTool];

    try {
      // Check if this is a fallback session
      if (session.fallback) {
        console.log('Continuing with fallback model (no tools):', session.fallbackModel);
        
        const stream = await this.openai.chat.completions.create({
          model: session.fallbackModel || 'gpt-3.5-turbo',
          messages: session.messages,
          stream: true
        });

        session.stream = stream;
        return stream;
      }
      
      // Normal session with tools
      const stream = await this.openai.chat.completions.create({
        model: this.primaryModel,
        messages: session.messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        stream: true
      });

      session.stream = stream;
      return stream;
    } catch (error) {
      console.error('Failed to continue stream:', error);
      
      // Try to continue with fallback model if primary fails
      if (!session.fallback) {
        try {
          console.log('Attempting to continue with fallback model after error');
          const fallbackModel = this.fallbackModels[0];
          
          const stream = await this.openai.chat.completions.create({
            model: fallbackModel,
            messages: session.messages,
            stream: true
          });
          
          session.fallback = true;
          session.fallbackModel = fallbackModel;
          session.stream = stream;
          return stream;
        } catch (fallbackError) {
          console.error('Fallback continuation also failed:', fallbackError);
          throw error; // Throw original error if fallback also fails
        }
      } else {
        throw error;
      }
    }
  }

  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  closeSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (session?.stream) {
      try {
        session.stream.destroy?.();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.activeSessions.delete(sessionId);
  }

  // Cleanup old sessions (call periodically)
  cleanupOldSessions(maxAgeMs = 30 * 60 * 1000) { // 30 minutes
    const now = Date.now();
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.createdAt > maxAgeMs) {
        this.closeSession(sessionId);
      }
    }
  }

  async getMCPStatus() {
    return await this.mcpService.getConnectionStatus();
  }

  async getWebSearchStatus() {
    return this.webSearchService.getStatus();
  }

  async getAllServicesStatus() {
    const [mcpStatus, webSearchStatus] = await Promise.all([
      this.getMCPStatus(),
      Promise.resolve(this.getWebSearchStatus())
    ]);

    return {
      mcp: mcpStatus,
      webSearch: webSearchStatus,
      python: {
        available: true,
        outputDir: this.pythonService.outputDir
      }
    };
  }
}

export default ResponsesAPIService;
