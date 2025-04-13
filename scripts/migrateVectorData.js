import { ChromaClient } from "chromadb";
import { VectorService } from '../services/VectorService.js';
import dotenv from 'dotenv';
import ora from 'ora';

dotenv.config();

/**
 * Utility script to migrate data from old ChromaDB collections to the new unified VectorService.
 * 
 * Usage:
 *   node scripts/migrateVectorData.js [source_collection_name] [target_collection_name]
 * 
 * If source_collection_name is not provided, it will migrate data from all collections.
 * If target_collection_name is not provided, it defaults to "unified_data".
 */

const CHROMADB_URL = process.env.CHROMA_URL || 'http://localhost:8000';

// Function to get all collections
async function getCollections() {
    try {
        const client = new ChromaClient({
            path: CHROMADB_URL
        });
        return await client.listCollections();
    } catch (error) {
        console.error('Error getting collections:', error);
        throw error;
    }
}

// Function to migrate a single collection
async function migrateCollection(sourceCollectionName, targetCollectionName = 'unified_data') {
    console.log(`\nMigrating collection: ${sourceCollectionName} -> ${targetCollectionName}`);
    const spinner = ora('Starting migration...').start();

    try {
        // Connect to ChromaDB
        const client = new ChromaClient({
            path: CHROMADB_URL
        });

        // Initialize the VectorService with the target collection
        await VectorService.initialize({
            collectionName: targetCollectionName
        });

        // Get the source collection
        const sourceCollection = await client.getCollection({
            name: sourceCollectionName
        });

        // Get all documents from the source collection
        const allDocs = await sourceCollection.get();
        
        if (!allDocs || allDocs.ids.length === 0) {
            spinner.warn(`No documents found in ${sourceCollectionName}`);
            return;
        }

        spinner.text = `Found ${allDocs.ids.length} documents. Processing...`;

        // Convert to the format expected by VectorService
        const documents = [];
        for (let i = 0; i < allDocs.ids.length; i++) {
            // Extract the metadata and document content
            const metadata = allDocs.metadatas[i] || {};
            const content = allDocs.documents[i];
            
            // Skip if no content
            if (!content) continue;

            // Create a document object expected by VectorService
            documents.push({
                pageContent: content,
                metadata: {
                    ...metadata,
                    source_collection: sourceCollectionName,
                    migration_date: new Date().toISOString()
                }
            });
        }

        spinner.text = `Migrating ${documents.length} documents to ${targetCollectionName}...`;

        // Add documents to the new VectorService
        await VectorService.addDocuments(documents);

        spinner.succeed(`Successfully migrated ${documents.length} documents from ${sourceCollectionName} to ${targetCollectionName}`);
    } catch (error) {
        spinner.fail(`Error migrating collection ${sourceCollectionName}: ${error.message}`);
        console.error(error);
    }
}

// Main function
async function main() {
    try {
        console.log('Vector Data Migration Utility');
        console.log('=============================\n');

        // Parse command line arguments
        const sourceCollectionName = process.argv[2];
        const targetCollectionName = process.argv[3] || 'unified_data';

        if (sourceCollectionName) {
            // Migrate specific collection
            await migrateCollection(sourceCollectionName, targetCollectionName);
        } else {
            // Migrate all collections
            const collections = await getCollections();
            console.log(`Found ${collections.length} collections to migrate`);
            
            for (const collection of collections) {
                if (collection.name !== targetCollectionName) {
                    await migrateCollection(collection.name, targetCollectionName);
                }
            }
        }

        console.log('\nMigration completed.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

main(); 