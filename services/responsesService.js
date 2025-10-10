import OpenAI from 'openai';
import MCPService from './mcpService.js';
import PythonExecutionService from './pythonExecutionService.js';
import WebSearchService from './webSearchService.js';
import PDFProcessingService from './pdfProcessingService.js';
import OBD2AnalysisService from './obd2AnalysisService.js';
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
    this.obd2AnalysisService = new OBD2AnalysisService();
    this.activeSessions = new Map();
    this.conversationHistory = new Map(); // Add conversation history storage
    this.fallbackModels = ['gpt-4o-mini', 'gpt-3.5-turbo'];
    this.primaryModel = 'gpt-4o-mini'; // Cost-effective yet capable model

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

    // Get MCP tools, Python execution tool, web search tools, PDF processing tool, and OBD2 analysis tools
    const mcpTools = this.mcpService.getToolDefinitions();
    const pythonTool = this.pythonService.getToolDefinition();
    const webSearchTools = this.webSearchService.getToolDefinitions();
    const pdfTool = this.pdfService.getToolDefinition();
    const obd2AnalysisTools = this.obd2AnalysisService.getToolDefinitions();
    const tools = [...mcpTools, pythonTool, ...webSearchTools, pdfTool, ...obd2AnalysisTools];

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

OBD2 DATA ANALYSIS TOOLS:
- analyze_obd2_session: Perform comprehensive analysis of OBD2 session data
  * Get summary statistics, detailed analysis, anomaly detection
  * Analyze performance metrics, fuel economy, and emissions data
  * Generate insights and recommendations based on sensor readings

- compare_obd2_sessions: Compare multiple diagnostic sessions to identify trends
  * Track vehicle performance changes over time
  * Identify degrading or improving systems
  * Compare fuel economy, performance, and emission metrics

- get_obd2_diagnostic_recommendations: Get AI-powered diagnostic recommendations
  * Analyze OBD2 data patterns with DTC codes and symptoms
  * Provide specific repair suggestions and maintenance recommendations
  * Correlate sensor data with common automotive issues

- calculate_fuel_economy_metrics: Calculate detailed fuel economy analysis
  * Compute instantaneous and average fuel economy
  * Analyze driving patterns and efficiency recommendations
  * Support multiple units (MPG, L/100km, km/L)

- detect_obd2_anomalies: Detect anomalies and potential issues in sensor data
  * Identify out-of-range values and sudden changes
  * Find patterns indicating potential component failures
  * Adjustable sensitivity for different diagnostic needs

- generate_obd2_health_report: Generate comprehensive vehicle health reports
  * Overall health scoring and system assessments
  * Historical trend analysis and comparisons
  * Professional reports for technicians and customers

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
14. Use OBD2 analysis tools when working with diagnostic session data for comprehensive insights
15. When asked to analyze vehicle performance, use the OBD2 analysis tools to get detailed metrics
16. Generate health reports and recommendations using the specialized OBD2 analysis capabilities
17. Use anomaly detection tools to identify potential issues in sensor readings
18. Compare multiple sessions to track vehicle health trends over time

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
              }
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
        } else if (['analyze_obd2_session', 'compare_obd2_sessions', 'get_obd2_diagnostic_recommendations',
                   'calculate_fuel_economy_metrics', 'detect_obd2_anomalies', 'generate_obd2_health_report'].includes(toolCall.function.name)) {
          // Handle OBD2 analysis tools
          console.log(`Executing OBD2 analysis tool: ${toolCall.function.name}`);
          result = await this.obd2AnalysisService.executeTool(toolCall.function.name, parameters);
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
}

export default ResponsesAPIService;
