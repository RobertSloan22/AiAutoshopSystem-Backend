import OpenAI from "openai";
const client = new OpenAI();
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const vector_store = await client.vectorStores.create({   // Create vector store
    name: "Support FAQ",
});

await client.vector_stores.files.upload_and_poll({         // Upload file
    vector_store_id: vector_store.id,
    file: fs.createReadStream("customer_policies.txt"),
});

await client.vector_stores.create({
    name: "HDauto",
    metadata: {
        description: "HDauto vector store"
    }
})

export class OpenAIVectorStore {
    static client = null;
    static supabase = null;
    static tableName = 'vector_store';

    static async initialize() {
        if (!this.client) {
            this.client = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
        }

        if (!this.supabase) {
            this.supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_KEY
            );

            // Ensure the vector store table exists
            await this.initializeTable();
        }
    }

    static async initializeTable() {
        const { error } = await this.supabase.rpc('create_vector_store_table');
        if (error && !error.message.includes('already exists')) {
            console.error('Error creating vector store table:', error);
            throw error;
        }
    }

    static async addDocuments(documents) {
        await this.initialize();

        try {
            // Process documents in batches to avoid rate limits
            const batchSize = 20;
            
            for (let i = 0; i < documents.length; i += batchSize) {
                const batch = documents.slice(i, i + batchSize);
                console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(documents.length / batchSize)}`);
                
                // Create embeddings for the batch
                const embeddingResponse = await this.client.embeddings.create({
                    model: "text-embedding-3-small",
                    input: batch.map(doc => doc.pageContent),
                    encoding_format: "float"
                });

                // Store documents with their embeddings in Supabase
                const vectorDocs = batch.map((doc, index) => ({
                    content: doc.pageContent,
                    embedding: embeddingResponse.data[index].embedding,
                    metadata: doc.metadata
                }));

                const { error } = await this.supabase
                    .from(this.tableName)
                    .insert(vectorDocs);

                if (error) {
                    console.error('Error storing vectors:', error);
                    throw error;
                }

                console.log(`Added batch ${i / batchSize + 1} successfully`);
            }

            console.log(`Successfully processed ${documents.length} documents`);
            return true;
        } catch (error) {
            console.error('Error adding documents:', error);
            throw error;
        }
    }

    static async similaritySearch(query, k = 5) {
        await this.initialize();

        try {
            // Create embedding for the query
            const queryEmbedding = await this.client.embeddings.create({
                model: "text-embedding-3-small",
                input: query,
                encoding_format: "float"
            });

            // Search for similar vectors in Supabase
            const { data: matches, error } = await this.supabase.rpc(
                'match_documents',
                {
                    query_embedding: queryEmbedding.data[0].embedding,
                    match_threshold: 0.7,
                    match_count: k
                }
            );

            if (error) {
                console.error('Error performing similarity search:', error);
                throw error;
            }

            // Format the results
            return matches.map(match => ({
                pageContent: match.content,
                metadata: match.metadata,
                score: match.similarity
            }));

        } catch (error) {
            console.error('Error performing similarity search:', error);
            throw error;
        }
    }

    static async deleteDocuments(filter = {}) {
        await this.initialize();

        try {
            const { error } = await this.supabase
                .from(this.tableName)
                .delete()
                .match(filter);

            if (error) {
                console.error('Error deleting documents:', error);
                throw error;
            }

            console.log('Documents deleted successfully');
        } catch (error) {
            console.error('Error deleting documents:', error);
            throw error;
        }
    }

    static async getStats() {
        await this.initialize();

        try {
            const { count, error } = await this.supabase
                .from(this.tableName)
                .select('*', { count: 'exact' });

            if (error) {
                console.error('Error getting vector store statistics:', error);
                throw error;
            }

            return {
                totalDocuments: count,
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting vector store statistics:', error);
            throw error;
        }
    }
} 