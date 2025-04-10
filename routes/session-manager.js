import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

export class DiagnosticSessionManager {
    constructor() {
        this.vectorStore = null;
        this.sessions = new Map();
        this.initialize();
    }

    async initialize() {
        const embeddings = new OpenAIEmbeddings({
            openAIApiKey: process.env.OPENAI_API_KEY,
            modelName: 'text-embedding-3-small'
        });

        this.vectorStore = await MemoryVectorStore.fromTexts(
            [], // Initial empty texts
            [], // Initial empty metadata
            embeddings
        );
    }

    async storeSession(session) {
        const sessionText = JSON.stringify({
            vehicleInfo: session.vehicleInfo,
            initialSymptoms: session.initialSymptoms,
            currentStep: session.currentStep,
            currentDiagnosis: session.currentDiagnosis
        });

        await this.vectorStore.addDocuments([{
            pageContent: sessionText,
            metadata: {
                sessionId: session.sessionId,
                timestamp: new Date().toISOString()
            }
        }]);

        this.sessions.set(session.sessionId, session);
        console.log('Session stored:', session.sessionId);
    }

    async getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.log('Session not found:', sessionId);
            return null;
        }
        return session;
    }

    async updateSession(session) {
        // Update in-memory session
        this.sessions.set(session.sessionId, session);

        // Update vector store
        const sessionText = JSON.stringify({
            vehicleInfo: session.vehicleInfo,
            initialSymptoms: session.initialSymptoms,
            currentStep: session.currentStep,
            currentDiagnosis: session.currentDiagnosis
        });

        // Remove old vectors for this session
        await this.vectorStore.delete({ filter: { sessionId: session.sessionId } });

        // Add updated vectors
        await this.vectorStore.addDocuments([{
            pageContent: sessionText,
            metadata: {
                sessionId: session.sessionId,
                timestamp: new Date().toISOString()
            }
        }]);

        console.log('Session updated:', session.sessionId);
    }

    async findSimilarSessions(query, numResults = 5) {
        const results = await this.vectorStore.similaritySearch(query, numResults);
        return results.map(doc => ({
            sessionId: doc.metadata.sessionId,
            session: this.sessions.get(doc.metadata.sessionId),
            score: doc.score
        }));
    }
} 