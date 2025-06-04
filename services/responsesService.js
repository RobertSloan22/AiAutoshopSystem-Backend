import OpenAI from 'openai';
import MCPService from './mcpService.js';
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
    this.activeSessions = new Map();
    this.fallbackModels = ['gpt-3.5-turbo', 'claude-3-haiku-20240307'];
    this.primaryModel = 'gpt-4o-mini';
  }

  async createStreamingSession(message, vehicleContext = {}, customerContext = {}) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(vehicleContext, customerContext);
    
    // Get MCP tools
    const tools = this.mcpService.getToolDefinitions();
    
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
    let prompt = `You are an AI automotive diagnostic assistant with access to real-time OBD2 vehicle data through specialized tools.

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
You have access to the following OBD2 diagnostic tools:
- scan_obd2_adapters: Scan for available Bluetooth OBD2 adapters
- connect_obd2_adapter: Connect to a specific OBD2 adapter  
- get_obd2_live_data: Get real-time engine data (RPM, speed, temperature, etc.)
- read_dtc_codes: Read diagnostic trouble codes from the vehicle
- get_connection_status: Check current OBD2 connection status

INSTRUCTIONS:
1. Use the appropriate tools to gather vehicle data when requested
2. Provide clear, professional diagnostic guidance
3. Always explain what you're doing when using tools
4. Include relevant vehicle context in your responses
5. Suggest specific diagnostic steps based on the data you collect
6. If asked about DTC codes, use the tools to read current codes and provide detailed explanations

Be thorough, accurate, and helpful in your automotive diagnostic assistance.`;

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
        console.log(`Executing MCP tool: ${toolCall.function.name}`);
        
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

        const result = await this.mcpService.callTool(toolCall.function.name, parameters);
        
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

    // Add tool results to conversation
    session.messages.push(...toolResults);

    // Get tools again in case they've changed
    const tools = this.mcpService.getToolDefinitions();

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
}

export default ResponsesAPIService;
