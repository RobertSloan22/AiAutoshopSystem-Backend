import axios from 'axios';
import * as cheerio from 'cheerio';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Chroma } from "langchain/vectorstores/chroma";
import { Ollama } from "@langchain/community/llms/ollama";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";

// Local Embeddings Class using Ollama
class LocalEmbeddings {
    constructor(baseUrl = 'http://localhost:8080') {
        this.baseUrl = baseUrl;
    }

    async embedDocuments(texts) {
        try {
            console.log(`Generating embeddings for ${texts.length} texts`);
            const response = await axios.post(`${this.baseUrl}/v1/embeddings`, {
                model: "text-embedding-ada-002",
                input: texts
            });
            return response.data.data.map(item => item.embedding);
        } catch (error) {
            console.error('Error generating embeddings:', error);
            throw error;
        }
    }

    async embedQuery(text) {
        return (await this.embedDocuments([text]))[0];
    }
}

export class ForumCrawlerService {
    static vectorStore = null;
    static localLLMUrl = 'http://localhost:8080';
    static processedUrls = new Set();
    static maxDepth = 4;
    static maxPages = 40;

    static forumConfig = {
        baseUrl: 'https://www.exampleforum.com',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        selectors: {
            content: ['.post-content', '.message-content'],
            pagination: '.pagination a',
            threadList: '.thread-list .thread',
            postList: '.post-list .post'
        }
    };

    static async crawlPage(url, depth = 0) {
        if (depth >= this.maxDepth || this.processedUrls.has(url)) return [];
        console.log(`Crawling: ${url} (depth: ${depth})`);
        this.processedUrls.add(url);

        try {
            const response = await axios.get(url, { headers: this.forumConfig.headers, timeout: 15000 });
            const $ = cheerio.load(response.data);
            let content = '';
            for (const selector of this.forumConfig.selectors.content) {
                $(selector).each((_, el) => content += $(el).text().trim() + '\n\n');
            }

            const links = new Set();
            $(this.forumConfig.selectors.pagination).each((_, el) => {
                try {
                    const href = new URL($(el).attr('href'), url).href;
                    if (!this.processedUrls.has(href)) links.add(href);
                } catch {}
            });

            const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1500, chunkOverlap: 300 });
            const docs = await textSplitter.createDocuments([content], [{ source: url, timestamp: new Date().toISOString(), depth }]);

            for (const link of links) {
                if (this.processedUrls.size < this.maxPages) docs.push(...await this.crawlPage(link, depth + 1));
            }

            return docs;
        } catch (error) {
            console.error(`Error crawling ${url}:`, error);
            return [];
        }
    }

    static async crawlForumContent(url) {
        console.log('Starting forum crawl...');
        this.processedUrls.clear();
        const docs = await this.crawlPage(url);

        if (!this.vectorStore) {
            console.log('Initializing ChromaDB vector store...');
            const embeddings = new LocalEmbeddings(this.localLLMUrl);
            this.vectorStore = await Chroma.fromDocuments(docs, embeddings, { collectionName: "forum_data" });
        } else {
            await this.vectorStore.addDocuments(docs);
        }

        return { success: true, pagesProcessed: this.processedUrls.size, totalChunks: docs.length };
    }
}

// Define agent LLM using Ollama
const agentLLM = new Ollama({ model: "gpt-4o", baseUrl: "http://localhost:8080" });

// Memory to persist conversation state
const agentCheckpointer = new MemorySaver();
const agent = createReactAgent({
    llm: agentLLM,
    tools: [],
    checkpointSaver: agentCheckpointer,
});

// Run Agent Example
(async () => {
    const query = "what is the price of a 2013 Hyundai Santa Fe evap emission canister?";
    const agentResponse = await agent.invoke(
        { messages: [new HumanMessage(query)] },
        { configurable: { thread_id: "42" } }
    );
    console.log(agentResponse.messages[agentResponse.messages.length - 1].content);
})();
