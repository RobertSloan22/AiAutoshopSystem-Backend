import axios from 'axios';
import * as cheerio from 'cheerio';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// Custom embeddings class for local model
class LocalEmbeddings {
    constructor(baseUrl = process.env.BASE_URL || 'http://localhost:1234') {
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
        const embeddings = await this.embedDocuments([text]);
        return embeddings[0];
    }
}

export class ForumCrawlerService {
    static vectorStore = null;
    static localLLMUrl = process.env.BASE_URL || 'http://localhost:1234';  // Use BASE_URL from .env
    static processedUrls = new Set();
    static maxDepth = 4; // Reduced depth for targeted crawling
    static maxPages = 40; // Reduced pages for targeted crawling

    // Add BMW Forums specific configuration
    static bmwForumsConfig = {
        baseUrl: 'http://ep1.adtrafficquality.google', // Update with actual BMW forums base URL
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cookie': '' // Will be populated with required cookies
        },
        selectors: {
            content: [
                '.post-content',
                '.message-content',
                '.thread-content',
                '.forum-post',
                '.forum-content',
                // Add BMW Forums specific selectors
            ],
            pagination: '.pagination a',
            threadList: '.thread-list .thread',
            postList: '.post-list .post'
        }
    };

    static bimmerfestConfig = {
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'accept': '*/*',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'en-US,en;q=0.9',
            'origin': 'https://www.bimmerfest.com',
            'referer': 'https://www.bimmerfest.com/'
        },
        selectors: {
            postContainer: "div.message-content",
            postContent: '.message-body',
            threadTitle: '.p-title-value',
            dtcCode: '.dtc-code',
            postDate: '.u-dt'
        },
        rateLimit: {
            requestDelay: 300, // Based on cache-control headers
            maxConcurrent: 3
        }
    };

    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static isSameDomain(baseUrl, url) {
        try {
            const base = new URL(baseUrl);
            const current = new URL(url);
            return base.hostname === current.hostname;
        } catch {
            return false;
        }
    }

    static async extractLinks($, baseUrl) {
        const links = new Set();
        $('a').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
                try {
                    const absoluteUrl = new URL(href, baseUrl).href;
                    if (this.isSameDomain(baseUrl, absoluteUrl) && 
                        !absoluteUrl.includes('#') && // Exclude anchor links
                        !absoluteUrl.includes('?') && // Exclude query parameters
                        !this.processedUrls.has(absoluteUrl)) {
                        links.add(absoluteUrl);
                    }
                } catch (error) {
                    console.warn(`Invalid URL: ${href}`);
                }
            }
        });
        return Array.from(links);
    }

    static async initializeBMWForums() {
        // Set up required cookies and authentication
        const cookies = [
            'apikey_header_cookie',
            'apikey_cookie_receive-cookie-deprecation',
            'apikey_cookie_uidod',
            // ... other required cookies from the spec
        ];

        // Initialize cookies string
        this.bmwForumsConfig.headers.Cookie = cookies.map(cookie => 
            `${cookie}=${process.env[cookie.toUpperCase()] || ''}`
        ).join('; ');
    }

    static async crawlBMWForums(startUrl, options = {}) {
        await this.initializeBMWForums();
        
        // Customize crawling parameters for BMW Forums
        this.maxDepth = options.maxDepth || 10;
        this.maxPages = options.maxPages || 50;
        
        return this.crawlForumContent(startUrl, options.question);
    }

    static async crawlPage(url, depth = 0) {
        if (depth >= this.maxDepth || 
            this.processedUrls.size >= this.maxPages || 
            this.processedUrls.has(url)) {
            return [];
        }

        console.log(`Crawling page: ${url} (depth: ${depth})`);
        this.processedUrls.add(url);

        try {
            const response = await axios.get(url, {
                headers: this.bmwForumsConfig.headers,
                timeout: 15000
            });

            const $ = cheerio.load(response.data);
            
            // Use BMW Forums specific selectors
            const selectors = this.bmwForumsConfig.selectors;
            let content = '';

            // Extract content using forum-specific selectors
            for (const selector of selectors.content) {
                const elements = $(selector);
                if (elements.length > 0) {
                    elements.each((_, el) => {
                        content += $(el).text().trim() + '\n\n';
                    });
                }
            }

            // Handle pagination for BMW Forums
            const nextPageLinks = $(selectors.pagination);
            const threadLinks = $(selectors.threadList);
            const postLinks = $(selectors.postList);

            // Remove unnecessary elements
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('header').remove();
            $('footer').remove();
            $('.advertisement').remove();
            
            if (!content.trim()) {
                $('p, div').each((_, el) => {
                    const text = $(el).text().trim();
                    if (text.length > 100) {
                        content += text + '\n\n';
                    }
                });
            }

            // Get links for recursive crawling
            const links = await this.extractLinks($, url);
            console.log(`Found ${links.length} links on ${url}`);

            // Create document for current page
            const docs = [];
            if (content.trim()) {
                content = content
                    .replace(/\s+/g, ' ')
                    .replace(/\n\s*\n/g, '\n\n')
                    .trim();

                const textSplitter = new RecursiveCharacterTextSplitter({
                    chunkSize: 1500,
                    chunkOverlap: 300,
                });

                const pageDocs = await textSplitter.createDocuments([content], [{
                    source: url,
                    timestamp: new Date().toISOString(),
                    depth: depth
                }]);
                docs.push(...pageDocs);
                console.log(`Created ${pageDocs.length} chunks for ${url}`);
            }

            // Recursively crawl linked pages
            for (const link of links) {
                if (this.processedUrls.size < this.maxPages) {
                    const linkedDocs = await this.crawlPage(link, depth + 1);
                    docs.push(...linkedDocs);
                }
            }

            return docs;
        } catch (error) {
            console.error(`Error crawling ${url}:`, error);
            return [];
        }
    }

    static extractSearchTerms(question) {
        // Remove common words and extract key terms
        const stopWords = new Set(['how', 'what', 'where', 'when', 'why', 'is', 'are', 'the', 'to', 'and', 'or', 'in', 'on', 'at', 'for']);
        const terms = question.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => !stopWords.has(word) && word.length > 2);
        return [...new Set(terms)]; // Remove duplicates
    }

    static async searchForumPages(baseUrl, searchTerms) {
        // Update search patterns for BMW Forums
        const searchPatterns = [
            `/search?q=${searchTerms.join('+')}`,
            `/search/results?keywords=${searchTerms.join('+')}`,
            // Add BMW Forums specific search patterns
        ];

        try {
            // Construct search URL based on forum platform
            const searchUrls = [];
            const domain = new URL(baseUrl).hostname;

            for (const pattern of searchPatterns) {
                searchUrls.push(`https://${domain}${pattern}`);
            }

            const foundUrls = new Set();
            
            // Try each search pattern
            for (const searchUrl of searchUrls) {
                try {
                    const response = await axios.get(searchUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5'
                        },
                        timeout: 10000
                    });

                    const $ = cheerio.load(response.data);
                    
                    // Common search result selectors
                    const resultSelectors = [
                        '.search-result a',
                        '.topic-title a',
                        '.thread-title a',
                        '.post-title a',
                        'a[href*="thread"]',
                        'a[href*="topic"]',
                        'a[href*="post"]',
                        '.result a'
                    ];

                    for (const selector of resultSelectors) {
                        $(selector).each((_, el) => {
                            const href = $(el).attr('href');
                            if (href) {
                                try {
                                    const url = new URL(href, searchUrl).href;
                                    if (this.isSameDomain(baseUrl, url)) {
                                        foundUrls.add(url);
                                    }
                                } catch (error) {
                                    console.warn(`Invalid URL: ${href}`);
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.warn(`Search pattern failed: ${searchUrl}`, error.message);
                    continue;
                }
            }

            return Array.from(foundUrls);
        } catch (error) {
            console.error('Error searching forum:', error);
            return [];
        }
    }

    static async crawlForumContent(url, question = null) {
        try {
            if (!this.isValidUrl(url)) {
                throw new Error('Invalid URL provided');
            }

            console.log('Starting forum crawl...');
            this.processedUrls.clear();

            let allDocs = [];

            if (question) {
                // Targeted crawl with search terms
                console.log('Starting targeted crawl with question:', question);
                const searchTerms = this.extractSearchTerms(question);
                console.log('Search terms:', searchTerms);

                // Search for relevant pages
                const relevantUrls = await this.searchForumPages(url, searchTerms);
                console.log(`Found ${relevantUrls.length} potentially relevant pages`);

                // Crawl the found pages and their immediate links
                for (const pageUrl of relevantUrls) {
                    if (this.processedUrls.size < this.maxPages) {
                        const docs = await this.crawlPage(pageUrl);
                        allDocs.push(...docs);
                    }
                }

                // If we found very little content, fall back to regular crawling
                if (allDocs.length < 5 && !this.processedUrls.has(url)) {
                    console.log('Insufficient results from search, falling back to regular crawl...');
                    const regularDocs = await this.crawlPage(url);
                    allDocs.push(...regularDocs);
                }
            } else {
                // Regular crawl without search terms
                console.log('Starting regular crawl...');
                const docs = await this.crawlPage(url);
                allDocs.push(...docs);
            }

            console.log(`Total pages processed: ${this.processedUrls.size}`);
            console.log(`Total chunks created: ${allDocs.length}`);

            if (allDocs.length === 0) {
                throw new Error('No content could be extracted from any pages');
            }

            // Initialize vector store if not exists
            if (!this.vectorStore) {
                console.log('Initializing vector store...');
                const embeddings = new LocalEmbeddings(this.localLLMUrl);
                this.vectorStore = await MemoryVectorStore.fromDocuments(allDocs, embeddings);
            } else {
                console.log('Adding documents to existing vector store...');
                await this.vectorStore.addDocuments(allDocs);
            }

            return { 
                success: true, 
                message: 'Forum content processed successfully',
                pagesProcessed: this.processedUrls.size,
                totalChunks: allDocs.length,
                processedUrls: Array.from(this.processedUrls)
            };

        } catch (error) {
            console.error('Error crawling forum:', error);
            throw new Error(`Failed to process forum content: ${error.message}`);
        }
    }

    static async queryContent(question) {
        if (!this.vectorStore) {
            throw new Error('No forum content has been processed yet');
        }

        try {
            console.log(`Querying content for: ${question}`);
            const relevantDocs = await this.vectorStore.similaritySearch(question, 5);
            console.log(`Found ${relevantDocs.length} relevant documents`);

            if (!this.localLLMUrl) {
                throw new Error('LLM URL is not configured');
            }

            const context = relevantDocs.map(doc => doc.pageContent).join('\n\n');

            try {
                const response = await axios.post(`${this.localLLMUrl}/v1/chat/completions`, {
                    model: "hermes-3-llama-3.2-3b",
                    messages: [
                        {
                            role: "system",
                            content: "You are a knowledgeable automotive expert assistant. Your task is to provide detailed, accurate answers based on the forum content provided. Focus on practical solutions and technical details. If the forum content doesn't contain enough information to fully answer the question, acknowledge this and provide the information that is available."
                        },
                        {
                            role: "user",
                            content: `Based on this forum content:\n\n${context}\n\nQuestion: ${question}\n\nPlease provide a detailed answer using the information from the forum content. Include specific steps, part numbers, or technical details if available.`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 800
                });

                return {
                    answer: response.data.choices[0].message.content,
                    sources: relevantDocs.map(doc => ({
                        content: doc.pageContent.substring(0, 200) + '...',
                        metadata: doc.metadata
                    }))
                };
            } catch (error) {
                console.error('Error communicating with LLM:', error);
                if (error.code === 'ERR_INVALID_URL' || error.code === 'ECONNREFUSED') {
                    throw new Error(`Failed to connect to LLM service at ${this.localLLMUrl}. Please ensure the service is running and the URL is correct.`);
                }
                throw error;
            }

        } catch (error) {
            console.error('Error querying content:', error);
            throw new Error(`Failed to process query: ${error.message}`);
        }
    }

    // Add method to extract structured data
    static extractStructuredData($, url) {
        return {
            title: $('h1').first().text().trim(),
            author: $('.post-author').first().text().trim(),
            date: $('.post-date').first().text().trim(),
            category: $('.breadcrumb').text().trim(),
            content: $('.post-content').text().trim(),
            metadata: {
                url,
                forum: 'BMW Forums',
                timestamp: new Date().toISOString()
            }
        };
    }

    static validateEnvironment() {
        if (!process.env.BASE_URL) {
            console.warn('BASE_URL environment variable not set, using default: http://localhost:1234');
        }
        // Add any other environment variable validations here
    }
}

// Add BMW Forums specific error handling
class BMWForumsError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'BMWForumsError';
        this.statusCode = statusCode;
    }
}

export default ForumCrawlerService; 