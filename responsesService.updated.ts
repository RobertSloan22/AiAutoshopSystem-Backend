import axios from 'axios';
import OBD2AITools from './obd2AITools';

export interface Tool {
  type: string;
  name?: string; // For function tools only
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, any>;
  };
  vector_store_ids?: string[];
  mcp?: {
    server_label: string;
    server_url: string;
    allowed_tools?: string[];
    require_approval?: 'always' | 'never' | 'if_destructive';
  };
}

export interface MCPTool {
  type: "mcp";
  server_label: string;
  server_url: string;
  allowed_tools?: string[];
  require_approval?: 'always' | 'never' | 'if_destructive';
}

interface ResponsesRequestOptions {
  model?: string;
  message: string;
  tools?: Tool[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  vehicleContext?: any;
  customerContext?: any;
}

// Add research data types
import { ResearchResponse } from '../context/ResearchContext';

// Extended context that includes research and OBD2 data
interface ExtendedContext {
  vehicleContext?: {
    make?: string;
    model?: string;
    year?: string;
    vin?: string;
    engine?: string;
    transmission?: string;
    [key: string]: any;
  };
  customerContext?: {
    name?: string;
    [key: string]: any;
  };
  obd2Data?: {
    connectionStatus?: 'connected' | 'disconnected' | 'connecting';
    metrics?: Record<string, any>;
    [key: string]: any;
  };
  researchData?: ResearchResponse;
  includeResearchData?: boolean;
  includeLiveOBDData?: boolean;
}

// Python execution result interface
interface PythonExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  plots?: Array<{
    path: string;
    imageId: string;
    url?: string;
    thumbnailUrl?: string;
    data?: string; // Base64 encoded image data
  }>;
  execution_id: string;
}

// Analysis response interface
interface AnalysisResponse {
  message: string;
  analysis: {
    question: string;
    timestamp: string;
  };
  visualizations?: Array<{
    imageId: string;
    url: string;
    thumbnailUrl: string;
    data: string;
    path: string;
  }>;
  codeExecution?: {
    code: string;
    output: string;
    success: boolean;
  };
  context?: {
    vehicle: any;
    customer: any;
  };
}

export class ResponsesService {
  private baseUrl: string;
  private static instance: ResponsesService;

  private constructor() {
    // Use different URLs based on environment
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
    this.baseUrl = isProduction ? 'https://eliza.ngrok.app' : 'http://localhost:5000';
    console.log('ResponsesService singleton initialized with baseUrl:', this.baseUrl);
  }

  public static getInstance(): ResponsesService {
    if (!ResponsesService.instance) {
      ResponsesService.instance = new ResponsesService();
    }
    return ResponsesService.instance;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  }

  // Function to create a response from the backend API
  async createResponse(options: ResponsesRequestOptions) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/responses/chat`,
        options,
        { headers: this.getHeaders() }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error creating response:', error);
      throw error;
    }
  }

  // Function to create a streaming response using Server-Sent Events
  async createStreamingResponse(options: ResponsesRequestOptions, 
    onChunk: (chunk: any) => void, 
    onComplete: (fullResponse: any) => void) {
    
    try {
      // Prepare the request payload to match backend expectations
      const requestPayload = {
        message: options.message,
        vehicleContext: options.vehicleContext || {},
        customerContext: options.customerContext || {},
        tools: options.tools || []
      };

      console.log('Starting streaming request with payload:', requestPayload);

      const response = await fetch(`${this.baseUrl}/api/responses/chat/stream`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Decode chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete SSE messages (ending with \n\n)
            const lines = buffer.split('\n\n');
            
            // Keep the last incomplete line in buffer
            buffer = lines.pop() || '';
            
            // Process complete messages
            for (const message of lines) {
              if (message.trim()) {
                // Parse SSE format: "data: {...}"
                const dataMatch = message.match(/^data:\s*(.+)$/m);
                if (dataMatch) {
                  try {
                    const jsonData = JSON.parse(dataMatch[1]);
                    console.log('Received SSE data:', jsonData);
                    
                    // Handle different message types
                    if (jsonData.type === 'content' && jsonData.content) {
                      fullContent += jsonData.content;
                      onChunk({
                        type: 'content',
                        content: jsonData.content,
                        sessionId: jsonData.sessionId
                      });
                    } else if (jsonData.type === 'session_started') {
                      onChunk({
                        type: 'session_started',
                        sessionId: jsonData.sessionId
                      });
                    } else if (jsonData.type === 'tool_call') {
                      onChunk({
                        type: 'tool_call',
                        toolCall: jsonData.toolCall,
                        sessionId: jsonData.sessionId
                      });
                    } else if (jsonData.type === 'tool_call_progress') {
                      onChunk({
                        type: 'tool_call_progress',
                        toolCall: jsonData.toolCall,
                        sessionId: jsonData.sessionId
                      });
                    } else if (jsonData.type === 'tool_calls_started') {
                      onChunk({
                        type: 'tool_calls_started',
                        toolCalls: jsonData.toolCalls,
                        sessionId: jsonData.sessionId
                      });
                    } else if (jsonData.type === 'tool_calls_completed') {
                      onChunk({
                        type: 'tool_calls_completed',
                        results: jsonData.results,
                        sessionId: jsonData.sessionId
                      });
                    } else if (jsonData.type === 'stream_complete') {
                      onChunk({
                        type: 'stream_complete',
                        sessionId: jsonData.sessionId
                      });
                    } else if (jsonData.type === 'error') {
                      onChunk({
                        type: 'error',
                        error: jsonData.error,
                        sessionId: jsonData.sessionId
                      });
                    }
                  } catch (e) {
                    console.log('Failed to parse SSE data:', dataMatch[1], e);
                  }
                }
              }
            }
          }
          
          // Complete the stream
          onComplete({
            fullContent,
            type: 'stream_complete'
          });
          
        } catch (streamError) {
          console.error('Error processing stream:', streamError);
          throw streamError;
        }
      };

      await processStream();
    } catch (error) {
      console.error('Error in streaming response:', error);
      throw error;
    }
  }

  // Execute Python code with visualization support
  async executePython(code: string, options: { save_plots?: boolean; plot_filename?: string } = {}) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/responses/execute/python`,
        {
          code,
          save_plots: options.save_plots ?? true,
          plot_filename: options.plot_filename
        },
        { headers: this.getHeaders() }
      );
      
      return response.data as PythonExecutionResult;
    } catch (error) {
      console.error('Error executing Python code:', error);
      throw error;
    }
  }

  // Create an analysis with potential visualizations
  async createAnalysis(question: string, context: ExtendedContext = {}, includeVisualization: boolean = true) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/responses/chat/analyze`,
        {
          question,
          vehicleContext: context.vehicleContext,
          customerContext: context.customerContext,
          includeVisualization
        },
        { headers: this.getHeaders() }
      );
      
      return response.data as AnalysisResponse;
    } catch (error) {
      console.error('Error creating analysis:', error);
      throw error;
    }
  }

  // Create a streaming analysis with visualizations
  async createStreamingAnalysis(
    question: string, 
    onChunk: (chunk: any) => void,
    onComplete: (fullResponse: any) => void,
    context: ExtendedContext = {}, 
    includeVisualization: boolean = true
  ) {
    try {
      const response = await fetch(`${this.baseUrl}/api/responses/chat/analyze/stream`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          question,
          vehicleContext: context.vehicleContext,
          customerContext: context.customerContext,
          includeVisualization
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      let visualizations: any[] = [];

      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';
            
            for (const message of lines) {
              if (message.trim()) {
                const dataMatch = message.match(/^data:\s*(.+)$/m);
                if (dataMatch) {
                  try {
                    const jsonData = JSON.parse(dataMatch[1]);
                    
                    // Pass through all events
                    onChunk(jsonData);
                    
                    // Track content and visualizations
                    if (jsonData.type === 'content') {
                      fullContent += jsonData.content;
                    } else if (jsonData.type === 'visualization_ready') {
                      visualizations = jsonData.visualizations;
                    }
                  } catch (e) {
                    console.log('Failed to parse SSE data:', dataMatch[1], e);
                  }
                }
              }
            }
          }
          
          onComplete({
            fullContent,
            visualizations,
            type: 'analysis_complete'
          });
          
        } catch (streamError) {
          console.error('Error processing analysis stream:', streamError);
          throw streamError;
        }
      };

      await processStream();
    } catch (error) {
      console.error('Error in streaming analysis:', error);
      throw error;
    }
  }

  // Get service status endpoints
  async getMCPStatus() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/responses/mcp/status`);
      return response.data;
    } catch (error) {
      console.error('Error getting MCP status:', error);
      throw error;
    }
  }

  async getWebSearchStatus() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/responses/websearch/status`);
      return response.data;
    } catch (error) {
      console.error('Error getting web search status:', error);
      throw error;
    }
  }

  async getAllServicesStatus() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/responses/services/status`);
      return response.data;
    } catch (error) {
      console.error('Error getting services status:', error);
      throw error;
    }
  }

  // Health check
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/responses/health`);
      return response.data;
    } catch (error) {
      console.error('Error checking health:', error);
      throw error;
    }
  }

  // FINAL FIX: Predefined tools for common scenarios
  getWebSearchTool(): Tool {
    return {
      type: "web_search"
      // No name property for web_search tools
    };
  }

  getFileSearchTool(vectorStoreIds: string[] = []): Tool {
    return {
      type: "file_search",
      ...(vectorStoreIds.length > 0 && { vector_store_ids: vectorStoreIds })
      // No name property for file_search tools
    };
  }

  getFunctionTool(name: string, description: string, parameters: Record<string, any>): Tool {
    return {
      type: "function",
      name: name, // ✅ REQUIRED: Top-level name
      function: {
        name: name, // ✅ REQUIRED: Must match top-level name
        description,
        parameters
      }
    };
  }

  getReasoningTool(): Tool {
    return {
      type: "reasoning"
      // No name property for reasoning tools
    };
  }

  // Python execution tool
  getPythonExecutionTool(): Tool {
    return {
      type: "function",
      name: "execute_python_code",
      function: {
        name: "execute_python_code",
        description: "Execute Python code in a secure environment with access to data analysis libraries (pandas, numpy, matplotlib, seaborn). Can perform calculations, data analysis, and generate plots.",
        parameters: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The Python code to execute. Can include imports, calculations, data analysis, and plot generation."
            },
            save_plots: {
              type: "boolean",
              description: "Whether to save any generated plots as PNG files",
              default: true
            },
            plot_filename: {
              type: "string",
              description: "Optional filename for saved plots (without extension). If not provided, a unique name will be generated."
            }
          },
          required: ["code"]
        }
      }
    };
  }

  // FINAL FIX: Direct OBD2 Function Tools (replaces MCP tools)
  getOBD2FunctionTool(name: string, description: string, parameters: Record<string, any> = {}): Tool {
    return {
      type: "function",
      name: name, // ✅ REQUIRED: Top-level name
      function: {
        name: name, // ✅ REQUIRED: Must match top-level name
        description,
        parameters: {
          type: "object",
          properties: parameters,
          required: Object.keys(parameters)
        }
      }
    };
  }

  // FINAL FIX: Get all OBD2 function tools
  getOBD2Tools(): Tool[] {
    const toolDescriptions = OBD2AITools.getToolDescriptions();
    
    return [
      this.getOBD2FunctionTool(
        "scanForAdapters", 
        toolDescriptions.scanForAdapters
      ),
      this.getOBD2FunctionTool(
        "connectOBD2Adapter", 
        toolDescriptions.connectOBD2Adapter,
        {
          deviceId: {
            type: "string",
            description: "Optional device ID to connect to. If not provided, will auto-select best adapter."
          }
        }
      ),
      this.getOBD2FunctionTool(
        "getLiveData", 
        toolDescriptions.getLiveData
      ),
      this.getOBD2FunctionTool(
        "readDiagnosticCodes", 
        toolDescriptions.readDiagnosticCodes
      ),
      this.getOBD2FunctionTool(
        "getConnectionStatus", 
        toolDescriptions.getConnectionStatus
      ),
      this.getOBD2FunctionTool(
        "getVehicleContext", 
        toolDescriptions.getVehicleContext
      )
    ];
  }

  // Get all available tools including Python execution
  getAllTools(): Tool[] {
    return [
      ...this.getOBD2Tools(),
      this.getPythonExecutionTool(),
      this.getWebSearchTool(),
      this.getReasoningTool()
    ];
  }

  // Handle local OBD2 tool calls before sending to backend
  async handleLocalToolCall(toolName: string, args: any = {}): Promise<any> {
    console.log(`🔧 Handling local tool call: ${toolName}`, args);
    
    try {
      switch (toolName) {
        case 'scanForAdapters':
          return await OBD2AITools.scanForAdapters();
        
        case 'connectOBD2Adapter':
          return await OBD2AITools.connectOBD2Adapter(args.deviceId);
        
        case 'getLiveData':
          return await OBD2AITools.getLiveData();
        
        case 'readDiagnosticCodes':
          return await OBD2AITools.readDiagnosticCodes();
        
        case 'getConnectionStatus':
          return await OBD2AITools.getConnectionStatus();
        
        case 'getVehicleContext':
          return OBD2AITools.getVehicleContext();
        
        default:
          throw new Error(`Unknown OBD2 tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`Error in tool ${toolName}:`, error);
      return {
        error: error instanceof Error ? error.message : 'Tool execution failed',
        success: false,
        timestamp: Date.now()
      };
    }
  }

  // Create a chat completion with OBD2 diagnostic capabilities
  async createOBD2DiagnosticResponse(
    prompt: string, 
    vehicleContext?: { make?: string; model?: string; year?: string; vin?: string },
    options: Partial<ResponsesRequestOptions> = {}
  ) {
    // Set vehicle context for AI tools
    if (vehicleContext) {
      OBD2AITools.setVehicleContext(vehicleContext);
    }

    const enhancedPrompt = vehicleContext 
      ? `Vehicle Context: ${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model} ${vehicleContext.vin ? `(VIN: ${vehicleContext.vin})` : ''}\n\nDiagnostic Request: ${prompt}`
      : prompt;

    const requestOptions: ResponsesRequestOptions = {
      model: options.model || 'gpt-4',
      message: enhancedPrompt,
      tools: this.getAllTools(),
      max_tokens: options.max_tokens || 2000,
      temperature: options.temperature || 0.3,
      ...options
    };

    return this.createResponse(requestOptions);
  }

  // Create a diagnostic analysis with visualizations
  async createDiagnosticAnalysis(
    question: string,
    vehicleContext?: { make?: string; model?: string; year?: string; vin?: string },
    includeVisualization: boolean = true
  ) {
    // Set vehicle context for AI tools
    if (vehicleContext) {
      OBD2AITools.setVehicleContext(vehicleContext);
    }

    return this.createAnalysis(question, { vehicleContext }, includeVisualization);
  }

  // Helper function to format customer and vehicle context nicely
  private formatCustomerAndVehicleContext(
    customerName?: string, 
    vehicleContext?: { make?: string; model?: string; year?: string; vin?: string },
    obd2Status?: {
      isConnected: boolean;
      dataAge?: number | null;
      currentData?: Record<string, any> | null;
    }
  ) {
    // Build system context even if no customer/vehicle info to include OBD2 status
    let formattedContext = '\n\n[SYSTEM CONTEXT - NOT VISIBLE TO USER]\n';
    
    // Add customer info if available
    if (customerName) {
      formattedContext += `Customer: ${customerName}\n`;
    }
    
    // Add vehicle info if available
    if (vehicleContext) {
      if (vehicleContext.year || vehicleContext.make || vehicleContext.model) {
        formattedContext += `Vehicle: ${vehicleContext.year || ''} ${vehicleContext.make || ''} ${vehicleContext.model || ''}\n`;
      }
      
      if (vehicleContext.vin) {
        formattedContext += `VIN: ${vehicleContext.vin}\n`;
      }
    }
    
    // Add OBD2 status if available
    if (obd2Status) {
      formattedContext += `\nOBD2 Status: ${obd2Status.isConnected ? 'CONNECTED' : 'DISCONNECTED'}\n`;
      
      if (obd2Status.isConnected) {
        formattedContext += `Data Age: ${obd2Status.dataAge !== null ? `${obd2Status.dataAge}s ago` : 'Unknown'}\n`;
        
        if (obd2Status.currentData) {
          formattedContext += 'Current Data:\n';
          Object.entries(obd2Status.currentData).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              formattedContext += `- ${key}: ${value}\n`;
            }
          });
        }
      }
    }
    
    formattedContext += '[END SYSTEM CONTEXT]\n\n';
    return formattedContext;
  }

  // Create a streaming diagnostic session with direct OBD2 tools
  async createOBD2StreamingSession(
    prompt: string,
    onChunk: (chunk: any) => void,
    onComplete: (fullResponse: any) => void,
    vehicleContext?: { make?: string; model?: string; year?: string; vin?: string },
    options: Partial<ResponsesRequestOptions> = {},
    customerName?: string,
    obd2Status?: {
      isConnected: boolean;
      dataAge?: number | null;
      currentData?: Record<string, any> | null;
    }
  ) {
    // Set vehicle context for AI tools
    if (vehicleContext) {
      OBD2AITools.setVehicleContext(vehicleContext);
    }

    // Create context header that won't be visible to user but will be sent to model
    const contextHeader = this.formatCustomerAndVehicleContext(customerName, vehicleContext, obd2Status);
    
    // Avoid adding "Vehicle Context" prefix in the prompt since we now include it in the hidden context
    const enhancedPrompt = contextHeader + prompt;

    const requestOptions: ResponsesRequestOptions = {
      model: options.model || 'gpt-4',
      message: enhancedPrompt,
      tools: this.getAllTools(),
      max_tokens: options.max_tokens || 2000,
      temperature: options.temperature || 0.3,
      stream: true,
      ...options
    };

    // Create enhanced onChunk handler that processes tool calls locally
    const enhancedOnChunk = async (chunk: any) => {
      // Check if this chunk contains a tool call for OBD2 tools
      if (chunk.type === 'tool_call' && chunk.function) {
        const toolName = chunk.function.name;
        const toolArgs = chunk.function.arguments;

        // Handle OBD2 tools locally if they're in our direct tools
        const obd2ToolNames = ['scanForAdapters', 'connectOBD2Adapter', 'getLiveData', 'readDiagnosticCodes', 'getConnectionStatus', 'getVehicleContext'];
        
        if (obd2ToolNames.includes(toolName)) {
          try {
            console.log(`🔧 Processing local OBD2 tool call: ${toolName}`);
            const toolResult = await this.handleLocalToolCall(toolName, toolArgs);
            
            // Send tool result as a chunk
            onChunk({
              type: 'tool_result',
              tool_call_id: chunk.id,
              content: JSON.stringify(toolResult, null, 2)
            });
            
            return; // Don't pass OBD2 tool calls to backend
          } catch (error) {
            console.error(`Error handling local tool call ${toolName}:`, error);
            onChunk({
              type: 'tool_result',
              tool_call_id: chunk.id,
              content: JSON.stringify({
                error: error instanceof Error ? error.message : 'Tool execution failed',
                success: false
              })
            });
            return;
          }
        }
      }
      
      // Pass all other chunks through normally
      onChunk(chunk);
    };

    return this.createStreamingResponse(requestOptions, enhancedOnChunk, onComplete);
  }

  // Create a streaming diagnostic analysis session with visualizations
  async createOBD2StreamingAnalysis(
    question: string,
    onChunk: (chunk: any) => void,
    onComplete: (fullResponse: any) => void,
    vehicleContext?: { make?: string; model?: string; year?: string; vin?: string },
    customerName?: string,
    obd2Status?: {
      isConnected: boolean;
      dataAge?: number | null;
      currentData?: Record<string, any> | null;
    },
    includeVisualization: boolean = true
  ) {
    // Set vehicle context for AI tools
    if (vehicleContext) {
      OBD2AITools.setVehicleContext(vehicleContext);
    }

    const context: ExtendedContext = {
      vehicleContext,
      customerContext: customerName ? { name: customerName } : undefined,
      obd2Data: obd2Status ? {
        connectionStatus: obd2Status.isConnected ? 'connected' : 'disconnected',
        metrics: obd2Status.currentData
      } : undefined
    };

    // Create enhanced onChunk handler that processes tool calls locally
    const enhancedOnChunk = async (chunk: any) => {
      // Check if this chunk contains a tool call for OBD2 tools
      if (chunk.type === 'tool_call_progress' && chunk.toolCall?.function) {
        const toolName = chunk.toolCall.function.name;
        const toolArgs = chunk.toolCall.function.arguments;

        // Handle OBD2 tools locally if they're in our direct tools
        const obd2ToolNames = ['scanForAdapters', 'connectOBD2Adapter', 'getLiveData', 'readDiagnosticCodes', 'getConnectionStatus', 'getVehicleContext'];
        
        if (obd2ToolNames.includes(toolName)) {
          try {
            console.log(`🔧 Processing local OBD2 tool call: ${toolName}`);
            const toolResult = await this.handleLocalToolCall(toolName, toolArgs);
            
            // Send tool result as a chunk
            onChunk({
              type: 'tool_result',
              tool_call_id: chunk.toolCall.id,
              content: JSON.stringify(toolResult, null, 2)
            });
            
            return; // Don't pass OBD2 tool calls to backend
          } catch (error) {
            console.error(`Error handling local tool call ${toolName}:`, error);
            onChunk({
              type: 'tool_result',
              tool_call_id: chunk.toolCall.id,
              content: JSON.stringify({
                error: error instanceof Error ? error.message : 'Tool execution failed',
                success: false
              })
            });
            return;
          }
        }
      }
      
      // Pass all other chunks through normally
      onChunk(chunk);
    };

    return this.createStreamingAnalysis(question, enhancedOnChunk, onComplete, context, includeVisualization);
  }

  // Add a sendMessage method for easier usage
  async sendMessage(message: string, context: ExtendedContext = {}) {
    console.log('responsesService.sendMessage called with:', message, context);
    
    try {
      // Extract vehicle context if it exists
      const vehicleContext = context.vehicleContext || {};
      
      // Extract customer context if it exists
      const customerName = context.customerContext?.name;
      
      // Extract OBD2 data if it exists
      const obd2Status = context.obd2Data ? {
        isConnected: context.obd2Data.connectionStatus === 'connected',
        currentData: context.obd2Data.metrics || {}
      } : undefined;
      
      // Use the diagnostic response creator
      const response = await this.createOBD2DiagnosticResponse(
        message,
        vehicleContext,
        {
          // Additional options can be set here
          temperature: 0.5
        }
      );
      
      console.log('responsesService.sendMessage received response:', response);
      
      // Create response object with enhanced data for bubbles if requested
      const result = {
        response: response.content || response.message || response.response || 'No response from AI',
        bubbleData: null as any
      };
      
      // Include live OBD data and research data if requested
      if (context.includeLiveOBDData || context.includeResearchData) {
        const bubbleData = {
          type: 'LiveOBDMCP',
          data: {
            obd2Data: context.obd2Data?.metrics,
            connectionStatus: context.obd2Data?.connectionStatus || 'disconnected',
            researchData: context.includeResearchData ? context.researchData : undefined,
            timestamp: new Date().toISOString(),
            // Add additional data needed for the enhanced UnifiedLiveOBDMCPBubble
            vehicleContext: context.vehicleContext || {
              make: "Not specified",
              model: "Not specified",
              year: "Not specified"
            },
            customerName: customerName || "Customer"
          }
        };
        
        result.bubbleData = bubbleData;
        
        // Dispatch ai-response event for BubbleManager integration
        try {
          if (typeof document !== 'undefined') {
            console.log('Dispatching ai-response event for AI response with LiveOBDMCP data');
            const event = new CustomEvent('ai-response', { 
              detail: { 
                text: response.content || response.message || response.response || 'No response from AI',
                source: 'assistant',
                bubbleType: 'obd-live',
                additionalData: {
                  obd2Data: context.obd2Data?.metrics,
                  connectionStatus: context.obd2Data?.connectionStatus || 'disconnected',
                  researchData: context.includeResearchData ? context.researchData : undefined,
                  timestamp: new Date().toISOString(),
                  // Include the same additional data in the event
                  vehicleContext: context.vehicleContext || {
                    make: "Not specified",
                    model: "Not specified",
                    year: "Not specified"
                  },
                  customerName: customerName || "Customer"
                }
              } 
            });
            document.dispatchEvent(event);
          }
        } catch (dispatchError) {
          console.error('Error dispatching ai-response event for AI response:', dispatchError);
        }
      } else {
        // For regular responses without OBD data, still dispatch an event for the BubbleManager
        try {
          if (typeof document !== 'undefined') {
            console.log('Dispatching ai-response event for standard AI response');
            const event = new CustomEvent('ai-response', { 
              detail: { 
                text: response.content || response.message || response.response || 'No response from AI',
                source: 'assistant',
                bubbleType: 'realtime',
                additionalData: {
                  timestamp: new Date().toISOString()
                }
              } 
            });
            document.dispatchEvent(event);
          }
        } catch (dispatchError) {
          console.error('Error dispatching ai-response event for standard AI response:', dispatchError);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error in responsesService.sendMessage:', error);
      throw error;
    }
  }

  // Add a new method specifically for creating LiveOBDMCP bubbles
  async createLiveOBDMCPResponse(dtcCode: string, context: ExtendedContext = {}) {
    try {
      // Get current OBD2 data
      let obd2Data;
      try {
        obd2Data = await this.handleLocalToolCall('getLiveData');
      } catch (err) {
        console.error('Error fetching live OBD2 data:', err);
        obd2Data = null;
      }
      
      // Extract vehicle context if it exists
      const vehicleContext = context.vehicleContext || {};
      
      // Extract customer name if it exists
      const customerName = context.customerContext?.name;
      
      // Create bubble data
      const bubbleData = {
        type: 'LiveOBDMCP',
        data: {
          obd2Data: obd2Data || context.obd2Data?.metrics,
          connectionStatus: (obd2Data && !obd2Data.error) ? 'connected' : 
                            context.obd2Data?.connectionStatus || 'disconnected',
          researchData: context.researchData,
          dtcCode: dtcCode,
          title: dtcCode ? `Diagnostic Analysis for ${dtcCode}` : 'Live OBD2 Diagnostic Data',
          timestamp: new Date().toISOString(),
          // Add additional data needed for the enhanced UnifiedLiveOBDMCPBubble
          vehicleContext: {
            make: vehicleContext.make || "Not specified",
            model: vehicleContext.model || "Not specified",
            year: vehicleContext.year || "Not specified",
            vin: vehicleContext.vin
          },
          customerName: customerName || "Customer"
        }
      };
      
      // Dispatch ai-response event for BubbleManager integration
      try {
        if (typeof document !== 'undefined') {
          console.log('Dispatching ai-response event for LiveOBDMCP data');
          const event = new CustomEvent('ai-response', { 
            detail: { 
              text: dtcCode ? `Diagnostic Analysis for ${dtcCode}` : 'Live OBD2 Diagnostic Data',
              source: 'obd2',
              bubbleType: 'obd-live',
              additionalData: {
                obd2Data: obd2Data || context.obd2Data?.metrics,
                connectionStatus: (obd2Data && !obd2Data.error) ? 'connected' : 
                                context.obd2Data?.connectionStatus || 'disconnected',
                researchData: context.researchData,
                dtcCode: dtcCode,
                timestamp: new Date().toISOString(),
                // Include the same additional data in the event
                vehicleContext: {
                  make: vehicleContext.make || "Not specified",
                  model: vehicleContext.model || "Not specified",
                  year: vehicleContext.year || "Not specified",
                  vin: vehicleContext.vin
                },
                customerName: customerName || "Customer"
              }
            } 
          });
          document.dispatchEvent(event);
        }
      } catch (dispatchError) {
        console.error('Error dispatching ai-response event for LiveOBDMCP:', dispatchError);
      }
      
      return {
        bubbleData,
        success: true
      };
    } catch (error) {
      console.error('Error creating LiveOBDMCP response:', error);
      return {
        bubbleData: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export a single instance of the service to be used throughout the application
export const responsesService = ResponsesService.getInstance();

// Export a hook for React components
export const useResponsesService = () => {
  return responsesService;
};