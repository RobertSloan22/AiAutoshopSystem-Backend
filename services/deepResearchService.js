import { Agent, Runner, webSearchTool, setDefaultOpenAIClient, hostedMcpTool } from '@openai/agents';
import { OpenAI } from 'openai';
import os from 'os';

// Deep Research Service for Automotive Systems
class DeepResearchService {
    constructor() {
        this.client = null;
        this.agents = {};
        this.isInitialized = false;
        
        // Initialize environment settings for zero data retention
        process.env.OPENAI_AGENTS_DISABLE_TRACING = "1";
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('Deep Research Service already initialized');
            return;
        }

        try {
            // Initialize OpenAI client with extended timeout for deep research
            this.client = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                timeout: 600000 // 10 minutes timeout for deep research operations
            });

            setDefaultOpenAIClient(this.client);
            
            await this.setupAgents();
            this.isInitialized = true;
            
            console.log('✅ Deep Research Service initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Deep Research Service:', error);
            throw error;
        }
    }

    async setupAgents() {
        // Main Deep Research Agent with automotive focus
        this.agents.research = new Agent({
            name: "Automotive Research Agent",
            model: "o4-mini-deep-research-2025-06-26",
            tools: [webSearchTool()],
            instructions: `You are an expert automotive research agent specialized in:
            - Vehicle diagnostics and troubleshooting
            - OBD2 codes and error analysis  
            - Automotive parts research and compatibility
            - Technical service bulletins and recalls
            - Repair procedures and maintenance
            - Industry trends and new technologies
            
            Perform comprehensive empirical research based on user queries, 
            focusing on automotive systems, diagnostics, and repair information.
            Always prioritize accurate, up-to-date technical information.`
        });

        // Instruction Builder Agent for automotive queries
        this.agents.instruction = new Agent({
            name: "Automotive Instruction Agent", 
            model: "gpt-4o-mini",
            instructions: this.getInstructionAgentPrompt(),
            handoffs: [this.agents.research]
        });

        // Clarifying Questions Agent for automotive context
        this.agents.clarifying = new Agent({
            name: "Automotive Clarifying Agent",
            model: "gpt-4o-mini",
            instructions: this.getClarifyingAgentPrompt(),
            output_type: this.getClarificationsSchema(),
            handoffs: [this.agents.instruction]
        });

        // Triage Agent to route automotive queries
        this.agents.triage = new Agent({
            name: "Automotive Triage Agent",
            instructions: `Analyze automotive research queries and determine if clarifications are needed.
            For automotive topics like:
            - Vehicle diagnostics, OBD2 codes, DTC analysis
            - Parts compatibility and sourcing  
            - Repair procedures and maintenance
            - Technical service bulletins
            - Vehicle specifications and systems
            
            • If the query lacks specific vehicle information (year, make, model, engine) → call transfer_to_automotive_clarifying_agent
            • If the query has sufficient detail → call transfer_to_automotive_instruction_agent
            Return exactly ONE function-call.`,
            handoffs: [this.agents.clarifying, this.agents.instruction]
        });

        console.log('✅ All deep research agents configured for automotive systems');
    }

    getClarifyingAgentPrompt() {
        return `You are an automotive expert who asks clarifying questions to improve research quality.

        GUIDELINES:
        1. **Focus on Automotive Context** - Ask for specific vehicle details when needed:
           - Year, Make, Model, Engine size/type
           - VIN information if relevant
           - Specific symptoms or error codes
           - Driving conditions or usage patterns

        2. **Be Concise and Targeted** - Ask 2-3 focused questions maximum
           - Don't ask for information already provided
           - Focus on details that will significantly improve research quality

        3. **Maintain Professional Tone** - Use automotive industry language appropriately
           - Example: "Could you provide the specific DTC codes displayed?"
           - Example: "What engine variant does this vehicle have?"

        4. **Safety Focus** - Always prioritize safety-related information
           - Ask about safety symptoms or concerns first
           - Clarify if issue affects vehicle operation`;
    }

    getInstructionAgentPrompt() {
        return `Transform automotive queries into detailed research instructions for deep research.

        GUIDELINES:
        1. **Maximize Automotive Specificity**
           - Include all vehicle details (year, make, model, engine)
           - List specific systems involved (engine, transmission, brakes, etc.)
           - Include any diagnostic codes or symptoms mentioned

        2. **Structure for Automotive Research**
           - Request technical service bulletins and recalls
           - Ask for OEM repair procedures when relevant  
           - Include parts compatibility information
           - Request labor time estimates when applicable

        3. **Safety and Compliance Focus**
           - Always request safety-related information first
           - Include regulatory compliance requirements
           - Ask for proper disposal/handling procedures for hazardous materials

        4. **Output Format Requirements**
           - Request structured reports with technical specifications
           - Ask for parts lists with OEM part numbers
           - Request diagnostic flowcharts when applicable
           - Include cost estimates and labor requirements

        5. **Prioritize Authoritative Sources**
           - OEM technical documentation
           - NHTSA databases for recalls/TSBs
           - ASE-certified repair information
           - Industry-standard diagnostic procedures

        OUTPUT ONLY THE RESEARCH INSTRUCTIONS, NOTHING ELSE.`;
    }

    getClarificationsSchema() {
        // Define the structure for clarification questions
        return {
            questions: {
                type: "array",
                items: { type: "string" },
                description: "List of clarifying questions to ask"
            }
        };
    }

    // Main research method with automotive context
    async conductResearch(query, mockAnswers = {}, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Deep Research Service not initialized. Call initialize() first.');
        }

        try {
            console.log(`🔍 Starting automotive deep research: "${query}"`);
            
            const stream = Runner.run_streamed(
                this.agents.triage,
                query
            );

            // Handle clarification questions automatically
            for await (const event of stream.stream_events()) {
                if (this.isClarificationEvent(event)) {
                    const reply = this.handleClarifications(event.item.questions, mockAnswers);
                    stream.send_user_message(reply);
                    continue;
                }

                // Log research progress for automotive context
                if (options.verbose) {
                    this.logResearchProgress(event);
                }
            }

            const result = stream.final_output;
            console.log('✅ Automotive deep research completed');
            
            return {
                success: true,
                research: result,
                citations: this.extractCitations(stream),
                metadata: {
                    query: query,
                    timestamp: new Date().toISOString(),
                    type: 'automotive_deep_research'
                }
            };

        } catch (error) {
            console.error('❌ Deep research error:', error);
            return {
                success: false,
                error: error.message,
                query: query,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Quick research method for simple automotive queries
    async quickResearch(query, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Deep Research Service not initialized. Call initialize() first.');
        }

        try {
            console.log(`⚡ Quick automotive research: "${query}"`);

            const result = await Runner.run(
                this.agents.research,
                `Provide a focused automotive research response for: ${query}`
            );

            return {
                success: true,
                research: result,
                metadata: {
                    query: query,
                    timestamp: new Date().toISOString(),
                    type: 'automotive_quick_research'
                }
            };

        } catch (error) {
            console.error('❌ Quick research error:', error);
            return {
                success: false,
                error: error.message,
                query: query,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Research specific automotive diagnostic codes
    async researchDTCCodes(dtcCodes, vehicleInfo = {}) {
        const query = `Research diagnostic trouble codes: ${dtcCodes.join(', ')} for vehicle: ${vehicleInfo.year || 'Unknown'} ${vehicleInfo.make || 'Unknown'} ${vehicleInfo.model || 'Unknown'}. Provide detailed explanations, possible causes, diagnostic procedures, and repair recommendations.`;
        
        return await this.conductResearch(query, {
            "What specific vehicle information do you need?": `${vehicleInfo.year || 'Not specified'} ${vehicleInfo.make || 'Not specified'} ${vehicleInfo.model || 'Not specified'} ${vehicleInfo.engine || 'Engine type not specified'}`,
            "Are there any specific symptoms?": vehicleInfo.symptoms || "No additional symptoms reported",
            "What diagnostic tools are available?": "Standard OBD2 scanner and basic automotive tools"
        });
    }

    // Research automotive parts compatibility  
    async researchPartsCompatibility(partQuery, vehicleInfo = {}) {
        const query = `Research parts compatibility for: ${partQuery} compatible with ${vehicleInfo.year || 'Unknown'} ${vehicleInfo.make || 'Unknown'} ${vehicleInfo.model || 'Unknown'}. Include OEM part numbers, aftermarket alternatives, pricing, and installation requirements.`;
        
        return await this.conductResearch(query, {
            "What specific vehicle details do you need?": `${vehicleInfo.year || 'Not specified'} ${vehicleInfo.make || 'Not specified'} ${vehicleInfo.model || 'Not specified'} VIN: ${vehicleInfo.vin || 'Not provided'}`,
            "What type of parts are you looking for?": partQuery,
            "Do you prefer OEM or aftermarket parts?": "Both OEM and quality aftermarket options"
        });
    }

    // Helper methods
    isClarificationEvent(event) {
        return event && event.item && Array.isArray(event.item.questions);
    }

    handleClarifications(questions, mockAnswers) {
        const replies = questions.map(question => {
            const answer = mockAnswers[question] || "No specific preference - please provide general automotive industry standard information.";
            return `**${question}**\n${answer}`;
        });
        return replies.join('\n\n');
    }

    logResearchProgress(event) {
        if (event.type === "agent_updated_stream_event") {
            console.log(`📋 Switched to agent: ${event.new_agent.name}`);
        } else if (event.type === "raw_response_event" && 
                   event.data?.item?.action?.type === "search") {
            console.log(`🔍 Web search: "${event.data.item.action.query}"`);
        }
    }

    extractCitations(stream) {
        const citations = [];
        try {
            // Extract citations from the final research output
            for (const item of stream.new_items.reverse()) {
                if (item.type === "message_output_item") {
                    for (const content of item.raw_item.content || []) {
                        if (content.annotations) {
                            for (const annotation of content.annotations) {
                                if (annotation.type === 'url_citation') {
                                    citations.push({
                                        title: annotation.title || 'Unknown Title',
                                        url: annotation.url || '',
                                        start_index: annotation.start_index,
                                        end_index: annotation.end_index,
                                        excerpt: content.text?.slice(annotation.start_index, annotation.end_index) || ''
                                    });
                                }
                            }
                        }
                    }
                    break;
                }
            }
        } catch (error) {
            console.error('Error extracting citations:', error);
        }
        return citations;
    }

    // Health check method
    async healthCheck() {
        try {
            if (!this.isInitialized) {
                return { status: 'not_initialized', healthy: false };
            }

            // Simple test query to verify service functionality
            const testResult = await this.quickResearch("What is OBD2?", { timeout: 30000 });
            
            return {
                status: 'healthy',
                healthy: true,
                agents_configured: Object.keys(this.agents).length,
                last_check: new Date().toISOString(),
                test_result: testResult.success
            };
        } catch (error) {
            return {
                status: 'error',
                healthy: false,
                error: error.message,
                last_check: new Date().toISOString()
            };
        }
    }
}

// Create singleton instance
const deepResearchService = new DeepResearchService();

export default deepResearchService;