import OpenAI from 'openai';
import MCPService from './mcpService.js';
import PythonExecutionService from './pythonExecutionService.js';
import WebSearchService from './webSearchService.js';
import PDFProcessingService from './pdfProcessingService.js';
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
    this.pdfService = new PDFProcessingService();
    this.activeSessions = new Map();
    this.conversationHistory = new Map(); // Add conversation history storage
    this.fallbackModels = ['gpt-3.5-turbo', 'claude-3-haiku-20240307'];
    this.primaryModel = 'gpt-4o-mini';
    
    // Set up periodic cleanup for Python outputs
    setInterval(() => {
      this.pythonService.cleanup().catch(err => 
        console.error('Python service cleanup error:', err)
      );
    }, 60 * 60 * 1000); // Clean up every hour
  }

  async createStreamingSession(message, vehicleContext = {}, customerContext = {}, conversationId = null, obd2SessionId = null) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('📊 CREATE SESSION: Creating streaming session');
    console.log('  Internal SessionId:', sessionId);
    console.log('  OBD2 SessionId:', obd2SessionId);
    console.log('  VehicleContext:', JSON.stringify(vehicleContext));
    
    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(vehicleContext, customerContext);
    
    // Get MCP tools, Python execution tool, web search tools, and PDF processing tool
    const mcpTools = this.mcpService.getToolDefinitions();
    const pythonTool = this.pythonService.getToolDefinition();
    const webSearchTools = this.webSearchService.getToolDefinitions();
    const pdfTool = this.pdfService.getToolDefinition();
    const tools = [...mcpTools, pythonTool, ...webSearchTools, pdfTool];
    
    // Build messages array with conversation history
    let messages = [{ role: 'system', content: systemPrompt }];
    
    // Add conversation history if conversationId is provided
    if (conversationId && this.conversationHistory.has(conversationId)) {
      const history = this.conversationHistory.get(conversationId);
      // Add previous messages (excluding system messages to avoid duplicates)
      const historyMessages = history.messages.filter(msg => msg.role !== 'system');
      messages.push(...historyMessages);
    }
    
    // Add current user message
    messages.push({ role: 'user', content: message });

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
        conversationId,
        obd2SessionId,
        createdAt: Date.now()
      });

      return { sessionId, stream };
    } catch (error) {
      console.error('Failed to create OpenAI stream with primary model:', error);
      
      // Try fallback model if primary fails
      return this.createFallbackStreamingSession(message, vehicleContext, customerContext, conversationId);
    }
  }

  async createFallbackStreamingSession(message, vehicleContext = {}, customerContext = {}, conversationId = null) {
    const sessionId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(vehicleContext, customerContext);
    
    // Build messages array with conversation history
    let messages = [{ role: 'system', content: systemPrompt }];
    
    // Add conversation history if conversationId is provided
    if (conversationId && this.conversationHistory.has(conversationId)) {
      const history = this.conversationHistory.get(conversationId);
      // Add previous messages (excluding system messages to avoid duplicates)
      const historyMessages = history.messages.filter(msg => msg.role !== 'system');
      messages.push(...historyMessages);
    }
    
    // Add current user message
    messages.push({ role: 'user', content: message });

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
          conversationId,
          obd2SessionId,
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

        // Auto-inject vehicle context for search tools if missing
        if (['search_technical_images', 'web_search'].includes(toolCall.function.name)) {
          if (!parameters.vehicle_context && session.vehicleContext && 
              (session.vehicleContext.make || session.vehicleContext.model || session.vehicleContext.year)) {
            parameters.vehicle_context = {
              make: session.vehicleContext.make,
              model: session.vehicleContext.model,
              year: session.vehicleContext.year
            };
            console.log(`🔧 Auto-injected vehicle context for ${toolCall.function.name}:`, parameters.vehicle_context);
          }
        }

        let result;

        // Handle Python execution tool
        if (toolCall.function.name === 'execute_python_code') {
          console.log('Executing Python code...');
          console.log(`🔍 PLOT DEBUG: Internal sessionId: ${sessionId}`);
          console.log(`🔍 PLOT DEBUG: OBD2 sessionId: ${session.obd2SessionId}`);
          console.log(`🔍 PLOT DEBUG: Using sessionId for plots: ${session.obd2SessionId || sessionId}`);
          console.log(`🔍 PLOT DEBUG: vehicleContext: ${JSON.stringify(session.vehicleContext)}`);
          
          result = await this.pythonService.executeCode(
            parameters.code,
            {
              save_plots: parameters.save_plots !== false,
              plot_filename: parameters.plot_filename,
              sessionId: session.obd2SessionId || sessionId, // Use OBD2 session ID if available
              vehicleContext: session.vehicleContext,
              customerContext: session.customerContext,
              pythonCode: parameters.code
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
              console.log(`🔍 TOOL RESULT: Python execution generated ${result.plots.length} plots`);
              formattedResult.plots_generated = result.plots.length;
              formattedResult.plot_paths = result.plots;
              
              // Process plot results with both API URLs and base64 data
              formattedResult.plots = [];
              for (const plotResult of result.plots) {
                console.log(`🔍 TOOL RESULT: Processing plot result:`, plotResult);
                const plotData = {
                  path: plotResult.path || plotResult, // Handle both new and old format
                  imageId: plotResult.imageId,
                  url: plotResult.imageId ? `/api/plots/${plotResult.imageId}` : null,
                  thumbnailUrl: plotResult.imageId ? `/api/plots/${plotResult.imageId}/thumbnail` : null
                };
                
                console.log(`🔍 TOOL RESULT: Plot data structure: imageId=${plotData.imageId}, path=${plotData.path}, hasUrl=${!!plotData.url}`);
                
                // Try to get base64 data from MongoDB first, then fallback to file system
                let base64Data = null;
                if (plotResult.imageId) {
                  const plotFromDB = await this.pythonService.getPlotFromDB(plotResult.imageId);
                  if (plotFromDB) {
                    base64Data = plotFromDB.base64Data;
                    console.log(`🔍 TOOL RESULT: Retrieved base64 data from MongoDB for imageId=${plotResult.imageId}`);
                  } else {
                    console.log(`🔍 TOOL RESULT: No plot found in MongoDB for imageId=${plotResult.imageId}`);
                  }
                }
                
                // Fallback to file system if MongoDB doesn't have it
                if (!base64Data && plotData.path) {
                  base64Data = await this.pythonService.getPlotAsBase64(plotData.path);
                  console.log(`🔍 TOOL RESULT: Retrieved base64 data from file system: ${!!base64Data}`);
                }
                
                if (base64Data) {
                  plotData.data = base64Data;
                  console.log(`🔍 TOOL RESULT: Added base64 data to plot result (length: ${base64Data.length})`);
                } else {
                  console.warn(`🔍 TOOL RESULT: No base64 data available for plot: ${plotData.path}`);
                }
                
                formattedResult.plots.push(plotData);
              }
              console.log(`🔍 TOOL RESULT: Final formatted plots count: ${formattedResult.plots.length}`);
            } else {
              console.log(`🔍 TOOL RESULT: Python execution completed but no plots were generated`);
            }

            result = formattedResult;
          }
        } else if (['web_search', 'search_technical_images'].includes(toolCall.function.name)) {
          // Handle web search tools
          console.log(`Executing web search tool: ${toolCall.function.name}`);
          result = await this.webSearchService.executeTool(toolCall.function.name, parameters);
        } else if (toolCall.function.name === 'process_pdf_from_url') {
          // Handle PDF processing tool
          console.log(`Executing PDF processing tool: ${toolCall.function.name}`);
          result = await this.pdfService.executeTool(toolCall.function.name, parameters);
        } else {
          // Handle MCP tools
          result = await this.mcpService.callTool(toolCall.function.name, parameters);
        }
        
        const toolResult = {
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result, null, 2)
        };
        
        toolResults.push(toolResult);

        // Log detailed results for Python execution and other important tools
        if (toolCall.function.name === 'execute_python_code' && result.success) {
          console.log(`🔍 TOOL COMPLETE: ${toolCall.function.name} executed successfully`);
          if (result.plots && result.plots.length > 0) {
            console.log(`🔍 TOOL COMPLETE: Returning ${result.plots.length} plots to frontend`);
            result.plots.forEach((plot, idx) => {
              console.log(`🔍 TOOL COMPLETE: Plot ${idx}: imageId=${plot.imageId}, hasData=${!!plot.data}, url=${plot.url}`);
            });
          }
        } else if (toolCall.function.name === 'search_technical_images' && result.success) {
          console.log(`🔍 TOOL COMPLETE: ${toolCall.function.name} executed successfully`);
          if (result.images && result.images.length > 0) {
            console.log(`🔍 TOOL COMPLETE: Returning ${result.images.length} search images to frontend`);
          }
        } else {
          console.log(`Tool ${toolCall.function.name} executed successfully`);
        }
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

    // Truncate messages to prevent context length issues
    const maxMessages = 10; // Keep only the last 10 messages to stay under token limit
    if (session.messages.length > maxMessages) {
      const systemMessage = session.messages.find(msg => msg.role === 'system');
      const recentMessages = session.messages.slice(-maxMessages);
      session.messages = systemMessage ? [systemMessage, ...recentMessages] : recentMessages;
      console.log(`🔧 CONTEXT: Truncated conversation to ${session.messages.length} messages`);
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
    const pdfTool = this.pdfService.getToolDefinition();
    const tools = [...mcpTools, pythonTool, ...webSearchTools, pdfTool];

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
    
    // Save conversation history before closing session
    if (session && session.conversationId) {
      this.saveConversationHistory(session.conversationId, session.messages);
    }
    
    if (session?.stream) {
      try {
        session.stream.destroy?.();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.activeSessions.delete(sessionId);
  }

  // Save conversation history
  saveConversationHistory(conversationId, messages) {
    if (!conversationId || !messages) return;
    
    // Keep only the last 20 messages to prevent unbounded growth
    const maxMessages = 20;
    const messagesToSave = messages.slice(-maxMessages);
    
    this.conversationHistory.set(conversationId, {
      messages: messagesToSave,
      lastUpdated: Date.now()
    });
    
    console.log(`Saved conversation history for ${conversationId} with ${messagesToSave.length} messages`);
  }
  
  // Get conversation history
  getConversationHistory(conversationId) {
    return this.conversationHistory.get(conversationId);
  }
  
  // Clear conversation history
  clearConversationHistory(conversationId) {
    if (conversationId) {
      this.conversationHistory.delete(conversationId);
      console.log(`Cleared conversation history for ${conversationId}`);
    }
  }

  // Cleanup old sessions (call periodically)
  cleanupOldSessions(maxAgeMs = 30 * 60 * 1000) { // 30 minutes
    const now = Date.now();
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now - session.createdAt > maxAgeMs) {
        this.closeSession(sessionId);
      }
    }
    
    // Also cleanup old conversation histories (keep for 2 hours)
    const historyMaxAge = 2 * 60 * 60 * 1000; // 2 hours
    for (const [conversationId, history] of this.conversationHistory.entries()) {
      if (now - history.lastUpdated > historyMaxAge) {
        this.conversationHistory.delete(conversationId);
        console.log(`Cleaned up old conversation history for ${conversationId}`);
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
      },
      pdf: this.pdfService.getStatus()
    };
  }

  /**
   * Extract key technical terms from step information for more targeted searches
   */
  extractKeyTerms(stepTitle, stepDescription, componentLocation, tools) {
    const terms = new Set();
    
    // Extract component names, part numbers, system names
    const text = `${stepTitle || ''} ${stepDescription || ''} ${componentLocation || ''}`.toLowerCase();
    
    // Common automotive components and systems
    const componentPatterns = [
      /\b(sensor|actuator|valve|pump|motor|relay|fuse|connector|harness|module|ecu|pcm|tcm|bcm)\w*/gi,
      /\b(injector|coil|spark|plug|filter|gasket|seal|bearing|bushing|bracket)\w*/gi,
      /\b(engine|transmission|brake|suspension|steering|cooling|fuel|exhaust|electrical)\w*/gi,
      /\b(cylinder|piston|camshaft|crankshaft|timing|belt|chain|pulley)\w*/gi
    ];
    
    componentPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => terms.add(match.toLowerCase()));
      }
    });
    
    // Add tools if they're technical
    if (tools && Array.isArray(tools)) {
      tools.forEach(tool => {
        if (tool && typeof tool === 'string') {
          const toolLower = tool.toLowerCase();
          if (toolLower.includes('meter') || toolLower.includes('scope') || 
              toolLower.includes('scanner') || toolLower.includes('tester')) {
            terms.add(toolLower);
          }
        }
      });
    }
    
    // Extract part numbers (alphanumeric patterns like "P0301", "TD73-1234")
    const partNumberPattern = /\b[A-Z0-9]{2,}[-]?[A-Z0-9]{2,}\b/g;
    const partNumbers = text.match(partNumberPattern);
    if (partNumbers) {
      partNumbers.forEach(pn => terms.add(pn.toUpperCase()));
    }
    
    return Array.from(terms).slice(0, 10); // Limit to top 10 terms
  }

  /**
   * Score image relevance based on step content
   * @param {Object} image - Image object with title and source
   * @param {string} stepTitle - Diagnostic step title
   * @param {string} stepDescription - Diagnostic step description
   * @param {string} componentLocation - Component location information
   * @param {Array<string>} keyTerms - Extracted key technical terms
   * @returns {number} Relevance score (higher is more relevant)
   */
  scoreImageRelevance(image, stepTitle, stepDescription, componentLocation, keyTerms) {
    let score = 0;
    const imageText = `${image.title || ''} ${image.source || ''}`.toLowerCase();
    
    // Check for key term matches (high weight)
    keyTerms.forEach(term => {
      if (imageText.includes(term.toLowerCase())) {
        score += 5;
      }
    });
    
    // Check for component location matches
    if (componentLocation) {
      const locationWords = componentLocation.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      locationWords.forEach(word => {
        if (imageText.includes(word)) {
          score += 3;
        }
      });
    }
    
    // Boost for professional/technical indicators
    const professionalTerms = [
      'schematic', 'diagram', 'technical', 'service manual', 'factory',
      'OEM', 'workshop', 'professional', 'parts breakdown', 'exploded',
      'wiring diagram', 'diagnostic', 'troubleshooting', 'flowchart',
      'blueprint', 'drawing', 'technical drawing', 'repair manual'
    ];
    
    professionalTerms.forEach(term => {
      if (imageText.includes(term)) {
        score += 2;
      }
    });
    
    // Penalize non-technical sources
    const nonTechnicalTerms = ['forum', 'blog', 'social media', 'reddit', 'facebook', 'youtube'];
    nonTechnicalTerms.forEach(term => {
      if (imageText.includes(term)) {
        score -= 3;
      }
    });
    
    // Check for step title keywords in image
    if (stepTitle) {
      const titleWords = stepTitle.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      titleWords.forEach(word => {
        if (imageText.includes(word)) {
          score += 4;
        }
      });
    }
    
    return Math.max(0, score); // Don't allow negative scores
  }

  /**
   * Use the agent's intelligence to search for technical images
   * This method creates a session, asks the agent to search for images,
   * and extracts the results from tool calls with relevance scoring and filtering
   * 
   * @param {Object} options - Search options
   * @param {string} options.query - Search query or step information
   * @param {string} options.stepTitle - Diagnostic step title (optional)
   * @param {string} options.stepDescription - Diagnostic step description (optional)
   * @param {string} options.componentLocation - Component location information (optional)
   * @param {Array<string>} options.tools - Tools used in the step (optional)
   * @param {Object} options.vehicleContext - Vehicle context (year, make, model)
   * @param {string} options.imageType - Type of image to search for (diagram, wiring, parts, flowchart, general)
   * @param {number} options.imageCount - Number of images to return (default: 5, max: 10)
   * @returns {Promise<Object>} Object with success, images array, query used, keyTerms, and filtered flag
   */
  async searchImagesWithAgent(options = {}) {
    const {
      query,
      stepTitle,
      stepDescription,
      componentLocation,
      tools,
      vehicleContext = {},
      imageType = 'general',
      imageCount = 5
    } = options;

    try {
      // Extract key technical terms for more targeted search
      const keyTerms = this.extractKeyTerms(stepTitle, stepDescription, componentLocation, tools);
      
      // Build a highly specific, directive message for the agent
      let message = 'You are searching for technical images to help a professional automotive technician with a specific diagnostic step. ';
      message += 'The images MUST be highly relevant and specific to this exact step. ';
      
      // Construct very specific query from step information
      if (query) {
        message += `Search for images specifically related to: ${query}. `;
      } else {
        message += 'Search for images related to: ';
        const parts = [];
        
        if (stepTitle) {
          parts.push(`"${stepTitle}"`);
        }
        
        if (componentLocation) {
          parts.push(`component located at "${componentLocation}"`);
        }
        
        if (stepDescription) {
          // Extract the most important part of description (first 40 words, focusing on technical terms)
          const descWords = stepDescription.split(/\s+/).slice(0, 40).join(' ');
          parts.push(`diagnostic procedure: ${descWords}`);
        }
        
        if (keyTerms.length > 0) {
          parts.push(`specifically showing: ${keyTerms.slice(0, 5).join(', ')}`);
        }
        
        if (tools && tools.length > 0) {
          parts.push(`using tools: ${tools.slice(0, 3).join(', ')}`);
        }
        
        if (parts.length > 0) {
          message += parts.join('. ') + '. ';
        }
      }

      // Add very specific image type requirements
      if (imageType !== 'general') {
        const typeDescriptions = {
          wiring: 'wiring diagrams, electrical schematics, connector pinouts, circuit diagrams from factory service manuals',
          parts: 'parts breakdown diagrams, exploded views, component assemblies, OEM parts catalogs',
          flowchart: 'diagnostic flowcharts, troubleshooting decision trees, step-by-step diagnostic procedures',
          diagram: 'technical schematics, system diagrams, component layouts, factory service manual illustrations'
        };
        message += `CRITICAL: Only return ${imageType} type images - specifically ${typeDescriptions[imageType] || 'technical diagrams'}. `;
      } else {
        message += 'Focus on professional technical diagrams, schematics, and service manual illustrations. ';
      }

      // Add vehicle context with emphasis on specificity
      if (vehicleContext.year || vehicleContext.make || vehicleContext.model) {
        const vehicleInfo = [
          vehicleContext.year,
          vehicleContext.make,
          vehicleContext.model
        ].filter(Boolean).join(' ');
        message += `IMPORTANT: These images must be specific to a ${vehicleInfo}. `;
        if (vehicleContext.engine) {
          message += `Engine: ${vehicleContext.engine}. `;
        }
      }

      message += `Return exactly ${Math.min(imageCount, 10)} highly relevant, professional technical images that directly relate to this specific diagnostic step. `;
      message += 'Prioritize factory service manual diagrams, OEM technical drawings, and professional workshop illustrations. ';
      message += 'Exclude generic images, forum posts, or non-technical sources.';

      console.log(`🔍 AGENT IMAGE SEARCH: Requesting targeted images with message: "${message}"`);
      console.log(`🔍 AGENT IMAGE SEARCH: Extracted key terms: ${keyTerms.join(', ')}`);

      // Create a streaming session with the agent
      const { sessionId, stream } = await this.createStreamingSession(
        message,
        vehicleContext,
        {},
        null // No conversationId for one-off searches
      );

      let toolCalls = [];
      let images = [];
      let searchQuery = null;
      let rawImagesCount = 0;

      // Process the stream to find tool calls
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            if (toolCallDelta.index !== undefined) {
              if (!toolCalls[toolCallDelta.index]) {
                toolCalls[toolCallDelta.index] = {
                  id: toolCallDelta.id,
                  type: 'function',
                  function: { name: '', arguments: '' }
                };
              }

              if (toolCallDelta.function?.name) {
                toolCalls[toolCallDelta.index].function.name += toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                toolCalls[toolCallDelta.index].function.arguments += toolCallDelta.function.arguments;
              }
            }
          }
        }

        if (chunk.choices[0]?.finish_reason === 'tool_calls') {
          // Add the assistant message with tool_calls to conversation
          const session = this.getSession(sessionId);
          if (session) {
            const assistantMessage = {
              role: 'assistant',
              content: null,
              tool_calls: toolCalls
            };
            session.messages.push(assistantMessage);
          }

          // Process tool calls - this will execute search_technical_images
          const toolResults = await this.processToolCalls(toolCalls, sessionId);

          // Extract images from tool results
          for (let i = 0; i < toolCalls.length; i++) {
            const toolCall = toolCalls[i];
            
            if (toolCall.function.name === 'search_technical_images') {
              try {
                const resultContent = JSON.parse(toolResults[i].content);
                console.log(`🔍 AGENT IMAGE SEARCH: Tool result success: ${resultContent.success}`);
                
                if (resultContent.success) {
                  // Extract the query used
                  searchQuery = resultContent.query || query || message;
                  
                  // Get images from results
                  const rawImages = resultContent.images || resultContent.results || [];
                  rawImagesCount = rawImages.length;
                  
                  if (rawImages.length > 0) {
                    console.log(`🔍 AGENT IMAGE SEARCH: Found ${rawImages.length} raw images from agent`);
                    
                    // Normalize image structure first
                    const normalizedImages = rawImages.map((img) => ({
                      url: img.image_url || img.url || img.link || '',
                      thumbnail_url: img.thumbnail_url || img.image_url || img.url || img.link || '',
                      thumbnail: img.thumbnail_url || img.image_url || img.url || img.link || '',
                      title: img.title || 'Technical Image',
                      source: img.source || 'Search Result',
                      link: img.url || img.link || img.image_url || '',
                      width: img.width,
                      height: img.height
                    }));

                    // Score and filter images for relevance
                    const scoredImages = normalizedImages.map((img) => {
                      const relevanceScore = this.scoreImageRelevance(
                        img,
                        stepTitle,
                        stepDescription,
                        componentLocation,
                        keyTerms
                      );
                      return { ...img, _relevanceScore: relevanceScore };
                    });

                    // Sort by relevance score (highest first)
                    scoredImages.sort((a, b) => b._relevanceScore - a._relevanceScore);

                    // Filter out low-relevance images (score < 3) unless we don't have enough
                    const minRelevanceScore = 3;
                    let filteredImages = scoredImages.filter(img => img._relevanceScore >= minRelevanceScore);
                    
                    // If filtering removed too many, keep top scored ones even if below threshold
                    if (filteredImages.length < Math.min(imageCount, 5)) {
                      console.log(`🔍 AGENT IMAGE SEARCH: Low relevance threshold, keeping top ${Math.min(imageCount, 5)} scored images`);
                      filteredImages = scoredImages.slice(0, Math.min(imageCount, 10));
                    }

                    // Remove score field and limit to requested count
                    images = filteredImages.slice(0, Math.min(imageCount, 10)).map((img) => {
                      // eslint-disable-next-line no-unused-vars
                      const { _relevanceScore, ...rest } = img;
                      return rest;
                    });
                    
                    console.log(`🔍 AGENT IMAGE SEARCH: Filtered to ${images.length} highly relevant images`);
                    if (images.length > 0) {
                      console.log(`🔍 AGENT IMAGE SEARCH: Top image relevance scores: ${scoredImages.slice(0, 3).map(img => img._relevanceScore).join(', ')}`);
                    }
                  }
                }
              } catch (e) {
                console.error('Error parsing image search tool results:', e);
              }
            }
          }

          // If we got images, we can close the session
          if (images.length > 0) {
            this.closeSession(sessionId);
            break;
          }

          // If no images yet, continue the stream to see if agent provides more info
          // But limit to one continuation to avoid infinite loops
          try {
            const continuedStream = await this.continueStreamWithToolResults(sessionId, toolResults);
            
            for await (const continueChunk of continuedStream) {
              // Just consume the stream - we already got images if available
              if (continueChunk.choices[0]?.finish_reason === 'stop') {
                break;
              }
            }
          } catch (continueError) {
            console.error('Error continuing stream:', continueError);
          }

          // Close the session
          this.closeSession(sessionId);
          break;
        }

        if (chunk.choices[0]?.finish_reason === 'stop') {
          // Agent didn't call tools, close session
          this.closeSession(sessionId);
          break;
        }
      }

      // If we got images but they might not be relevant enough, log a warning
      if (images.length > 0 && images.length < imageCount) {
        console.log(`⚠️ AGENT IMAGE SEARCH: Only found ${images.length} relevant images (requested ${imageCount})`);
      }

      // Return results with relevance information
      return {
        success: images.length > 0,
        images: images,
        query: searchQuery || query || message,
        total_results: images.length,
        keyTerms: keyTerms,
        filtered: images.length < rawImagesCount
      };

    } catch (error) {
      console.error('Error in agent image search:', error);
      return {
        success: false,
        error: error.message,
        images: [],
        query: query || 'Image search',
        total_results: 0
      };
    }
  }
}

export default ResponsesAPIService;
