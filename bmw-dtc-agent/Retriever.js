import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Embeddings } from "@langchain/core/embeddings";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChromaClient } from "chromadb";
import path from "path";

// Define the chat prompt template
const chatPrompt = ChatPromptTemplate.fromMessages([
    ["system", `You are an expert automotive diagnostic technician with deep knowledge of vehicle systems and diagnostic trouble codes (DTCs). Your responses must be in valid JSON format following this exact structure:

{{
    "Vehicle-Specific Information": {{
        "Make/Model/Year": string,
        "DTC Code Confirmation": string,
        "TSBs or Recalls": string,
        "Known Issues": string
    }},
    "DTC Code Definition": {{
        "DTC Name": string,
        "DTC Meaning": string,
        "System Related": string,
        "Variations": string
    }},
    "Common Causes": [
        {{
            "Problem": string,
            "Reason": string,
            "Make/Model Specific": boolean
        }}
    ],
    "Symptoms": [
        {{
            "Observable Symptoms": string,
            "Dashboard Indicators": string,
            "Performance Issues": string,
            "Make/Model Specific": boolean
        }}
    ],
    "Diagnostic Steps": [
        {{
            "Step": string,
            "Tools/Equipment": string,
            "Voltage Readings": string,
            "Make/Model Specific": boolean
        }}
    ],
    "Repair Solutions": [
        {{
            "Problem": string,
            "Reason": string,
            "Common Parts Needed": string,
            "Approximate Costs": string,
            "Make/Model Specific": boolean
        }}
    ],
    "Additional Notes": [
        {{
            "Vehicle-Specific Information": string,
            "Common Misdiagnoses": string,
            "TSBs": string,
            "Manufacturer-Specific Issues": string
        }}
    ]
}}

Important rules:
1. ALWAYS provide responses in this exact JSON structure
2. NEVER include explanatory text outside the JSON structure
3. Ensure all boolean values are true/false, not strings
4. Keep responses factual and technical
5. When specific information isn't available, use empty strings rather than null
6. Include manufacturer-specific information when available
7. Provide specific voltage readings and specifications when applicable
8. Include approximate cost ranges for repairs when possible
9. Always consider the specific make, model, and year of the vehicle
10. Base responses on common automotive diagnostic practices and repair procedures`],
    ["human", `Query: {query}

Vehicle Information:
Make/Model/Year: {vehicle_type}
VIN: {vin}
Engine: {engine}
Transmission: {transmission}
Mileage: {mileage}
Additional Notes: {description}

Relevant Forum Information:
{context}

Analyze this information and provide a comprehensive diagnostic response in the specified JSON format.`]
]);

class LocalChatModel extends BaseChatModel {
    constructor(baseUrl = process.env.LOCAL_LLM_URL || "http://localhost:1234") {
        super({});
        this.baseUrl = baseUrl;
    }

    async _generate(messages) {
        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: messages.map(m => ({
                        role: m._getType() === 'human' ? 'user' : 'assistant',
                        content: m.content
                    })),
                    model: "hermes-3-llama-3.1-8b",
                    temperature: 0
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                generations: [{
                    text: result.choices[0].message.content,
                    message: new HumanMessage(result.choices[0].message.content)
                }]
            };
        } catch (error) {
            console.error("Error in chat completion:", error);
            throw error;
        }
    }

    _llmType() {
        return "local-chat";
    }
}

class LocalEmbeddings extends Embeddings {
    constructor(baseUrl = "http://localhost:1234") {
        super();
        this.baseUrl = baseUrl;
    }

    async embedDocuments(documents) {
        try {
            const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input: documents }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.data.map(item => item.embedding);
        } catch (error) {
            console.error("Error in embedDocuments:", error);
            throw error;
        }
    }

    async embedQuery(text) {
        try {
            const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input: [text] }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result.data[0].embedding;
        } catch (error) {
            console.error("Error in embedQuery:", error);
            throw error;
        }
    }
}

export class Retriever {
    static async initialize(url, siteConfig = null) {
        try {
            console.log('Initializing Retriever with URL:', url);
            
            // Configure site-specific settings
            const defaultConfig = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'accept': '*/*',
                    'accept-language': 'en-US,en;q=0.9'
                },
                selectors: {
                    postContainer: "div.post, div.thread-content",
                    postContent: '.post-content',
                    threadTitle: '.thread-title',
                    dtcCode: '.dtc-code',
                    postDate: '.post-date'
                },
                rateLimit: {
                    requestDelay: 1000,
                    maxConcurrent: 5
                }
            };

            const config = siteConfig ? { ...defaultConfig, ...siteConfig } : defaultConfig;

            // Create ChromaDB client and ensure the collection exists
            const client = new ChromaClient({
                path: process.env.CHROMA_URL || "http://localhost:8000"
            });
            const collectionName = "bmw_dtc_data";
            
            // Get or create collection
            let collection;
            try {
                collection = await client.getCollection({ name: collectionName });
                console.log('Using existing ChromaDB collection');
            } catch {
                collection = await client.createCollection({ 
                    name: collectionName,
                    metadata: {
                        "description": "BMW DTC (Diagnostic Trouble Code) data collection",
                        "created_at": new Date().toISOString()
                    }
                });
                console.log('Created new ChromaDB collection');
            }

            // Check if we already have documents for this URL
            const existingDocs = await collection.get({
                where: { source: url }
            });

            let vectorStore;
            
            if (existingDocs && existingDocs.length > 0) {
                console.log('Found existing documents in ChromaDB, reusing them');
                vectorStore = await Chroma.fromExistingCollection(
                    new LocalEmbeddings(),
                    { collectionName }
                );
            } else {
                console.log('No existing documents found, loading from URL');
                // Initialize loader with site-specific configuration
                const loader = new CheerioWebBaseLoader(url, {
                    selector: config.selectors.postContainer,
                    headers: config.headers,
                    transformElement: (element) => {
                        // Extract information using site-specific selectors
                        const postContent = element.find(config.selectors.postContent).text();
                        const threadTitle = element.find(config.selectors.threadTitle).text();
                        const dtcCode = element.find(config.selectors.dtcCode).text();
                        const postDate = element.find(config.selectors.postDate).text();
                        
                        // Extract structured information
                        const vehicleInfo = extractVehicleInfo(threadTitle + ' ' + postContent);
                        const dtcInfo = extractDTCInfo(postContent, dtcCode);
                        const repairInfo = extractRepairInfo(postContent);
                        const symptomInfo = extractSymptomInfo(postContent);

                        return {
                            title: threadTitle,
                            content: postContent,
                            dtcCode: dtcCode,
                            date: postDate,
                            vehicleInfo: vehicleInfo,
                            dtcInfo: dtcInfo,
                            repairInfo: repairInfo,
                            symptomInfo: symptomInfo
                        };
                    }
                });

                // Load and process documents
                const docs = await loader.load();
                
                // Split documents with more context preservation
                const textSplitter = new RecursiveCharacterTextSplitter({
                    chunkSize: 500,
                    chunkOverlap: 50,
                });
                const docSplits = await textSplitter.splitDocuments(docs);

                // Create vector store with ChromaDB persistence
                vectorStore = await Chroma.fromDocuments(
                    docSplits,
                    new LocalEmbeddings(),
                    {
                        collectionName,
                        collectionMetadata: {
                            source: url,
                            timestamp: new Date().toISOString()
                        }
                    }
                );
                
                console.log('Successfully stored documents in ChromaDB');
            }

            // Create retriever instance
            const instance = new Retriever();
            instance.vectorStore = vectorStore;
            instance.model = new LocalChatModel();
            
            console.log('Retriever initialized successfully');
            return instance;
        } catch (error) {
            console.error("Error initializing Retriever:", error);
            throw error;
        }
    }

    async query(question, vehicleData) {
        try {
            // Format vehicle data to handle both structures
            const formattedVehicleData = {
                make: vehicleData?.make || vehicleData?.type?.split(' ')[1] || '',
                model: vehicleData?.model || vehicleData?.type?.split(' ')[2] || '',
                year: vehicleData?.year || vehicleData?.type?.split(' ')[0] || '',
                vin: vehicleData?.vin || '',
                engine: vehicleData?.engine || '',
                transmission: vehicleData?.transmission || '',
                mileage: vehicleData?.mileage || ''
            };

            // Create specific queries for each information category
            const queries = {
                vehicleSpecific: `${formattedVehicleData.make} ${formattedVehicleData.model} ${question} specific issues or recalls`,
                dtcDefinition: `${question} code meaning and definition`,
                commonCauses: `common causes of ${question}`,
                symptoms: `symptoms of ${question}`,
                diagnostics: `diagnostic steps for ${question}`,
                repairs: `repair solutions and costs for ${question}`
            };

            // Perform targeted searches
            const results = await Promise.all(
                Object.entries(queries).map(async ([category, query]) => {
                    const docs = await this.vectorStore.asRetriever({
                        searchType: "similarity",
                        searchKwargs: { k: 3 },
                        filter: (doc) => doc.metadata[category] !== null
                    }).getRelevantDocuments(query);
                    return { category, docs };
                })
            );

            // Combine results into structured context
            const context = results.reduce((acc, { category, docs }) => {
                return acc + `\n\n${category.charAt(0).toUpperCase() + category.slice(1)} Information:\n${docs.map(doc => doc.pageContent).join('\n')}`;
            }, '');

            // Format the prompt with the chat template
            const formattedPrompt = await chatPrompt.formatMessages({
                query: question,
                vehicle_type: `${formattedVehicleData.year} ${formattedVehicleData.make} ${formattedVehicleData.model}`,
                vin: formattedVehicleData.vin,
                engine: formattedVehicleData.engine,
                transmission: formattedVehicleData.transmission,
                mileage: formattedVehicleData.mileage,
                description: vehicleData.description || '',
                context: context
            });

            const response = await this.model.invoke(formattedPrompt);
            return response.content;
        } catch (error) {
            console.error("Error in query:", error);
            throw error;
        }
    }
}

// Helper functions for information extraction
function extractVehicleInfo(text) {
    // Extract vehicle make, model, year, and specific issues
    const vehicleInfo = {
        make: '',
        model: '',
        year: '',
        issues: []
    };

    // Basic pattern matching for vehicle information
    const makeModelPattern = /(?:bmw|mercedes|audi|volkswagen)\s+([a-z0-9-]+)/i;
    const yearPattern = /(?:19|20)\d{2}/;
    
    const makeModelMatch = text.match(makeModelPattern);
    const yearMatch = text.match(yearPattern);

    if (makeModelMatch) {
        vehicleInfo.model = makeModelMatch[1];
        vehicleInfo.make = makeModelMatch[0].split(' ')[0];
    }
    if (yearMatch) {
        vehicleInfo.year = yearMatch[0];
    }

    // Look for common issue patterns
    const issuePatterns = [
        /common(?:\sissue|\sproblem).*?[.!?]/gi,
        /known(?:\sissue|\sproblem).*?[.!?]/gi,
        /frequently.*?(?:issue|problem|fail).*?[.!?]/gi
    ];

    issuePatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            vehicleInfo.issues.push(...matches);
        }
    });

    return vehicleInfo;
}

function extractDTCInfo(text, dtcCode) {
    // Extract DTC code information and related system details
    const dtcInfo = {
        code: dtcCode,
        meaning: '',
        system: '',
        description: ''
    };

    // Look for DTC description patterns
    const meaningPattern = new RegExp(`${dtcCode}.*?(means|indicates|is|refers to).*?[.!?]`, 'i');
    const systemPattern = /(system|circuit|sensor|module|component).*?[.!?]/i;
    
    const meaningMatch = text.match(meaningPattern);
    const systemMatch = text.match(systemPattern);

    if (meaningMatch) dtcInfo.meaning = meaningMatch[0];
    if (systemMatch) dtcInfo.system = systemMatch[0];

    // Extract any detailed description
    const descriptionPattern = new RegExp(`${dtcCode}.*?(?:description|details|explanation).*?[.!?]`, 'i');
    const descMatch = text.match(descriptionPattern);
    if (descMatch) dtcInfo.description = descMatch[0];

    return dtcInfo;
}

function extractRepairInfo(text) {
    // Extract repair procedures, costs, and parts information
    const repairInfo = {
        procedures: [],
        parts: [],
        costs: [],
        tools: []
    };

    // Look for repair-related information
    const procedurePattern = /(?:step|procedure|fix|repair).*?[.!?]/gi;
    const partsPattern = /(?:part|replace|install).*?[.!?]/gi;
    const costPattern = /(?:cost|price|estimate).*?\$.*?[.!?]/gi;
    const toolPattern = /(?:tool|equipment|scanner).*?[.!?]/gi;

    const procedures = text.match(procedurePattern);
    const parts = text.match(partsPattern);
    const costs = text.match(costPattern);
    const tools = text.match(toolPattern);

    if (procedures) repairInfo.procedures = procedures;
    if (parts) repairInfo.parts = parts;
    if (costs) repairInfo.costs = costs;
    if (tools) repairInfo.tools = tools;

    return repairInfo;
}

function extractSymptomInfo(text) {
    // Extract symptoms and indicators
    const symptomInfo = {
        observable: [],
        dashboard: [],
        performance: []
    };

    // Look for symptom-related information
    const observablePattern = /(?:symptom|notice|observe|see|hear|feel).*?[.!?]/gi;
    const dashboardPattern = /(?:light|indicator|warning|dash|cel|mil).*?[.!?]/gi;
    const performancePattern = /(?:performance|running|idle|acceleration|power|fuel).*?[.!?]/gi;

    const observable = text.match(observablePattern);
    const dashboard = text.match(dashboardPattern);
    const performance = text.match(performancePattern);

    if (observable) symptomInfo.observable = observable;
    if (dashboard) symptomInfo.dashboard = dashboard;
    if (performance) symptomInfo.performance = performance;

    return symptomInfo;
} 