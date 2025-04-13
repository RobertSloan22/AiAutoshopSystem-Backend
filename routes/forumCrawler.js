import express from 'express';
import axios from 'axios';
import jsdom from 'jsdom';
import { ForumCrawlerService } from '../services/ForumCrawlerService.js';
const { JSDOM } = jsdom;

const router = express.Router();

// Utility functions
const extractDTCCodes = (text) => {
    const DTC_PATTERN = /[PBCU]\d{4}/g;
    const codes = text.toUpperCase().match(DTC_PATTERN) || [];
    return Array.from(new Set(codes));
};

const extractVehicleInfo = (text) => {
    const MAKES = /(BMW|Mercedes|Audi|Volkswagen|Toyota|Honda|Ford|Chevrolet|Nissan|Hyundai|Kia)/i;
    const YEAR_PATTERN = /(19|20)\d{2}/;
    
    const makeMatch = text.match(MAKES);
    const yearMatch = text.match(YEAR_PATTERN);

    return {
        make: makeMatch ? makeMatch[0] : null,
        year: yearMatch ? yearMatch[0] : null
    };
};

const scrapeForumPost = async (url) => {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        };

        const response = await axios.get(url, { headers, timeout: 10000 });
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        const contentSelectors = [
            '.post-content',
            '.message-content',
            '.post',
            '.post-message',
            '.post-body',
            '.postcontent',
            '.content',
            '.thread-content',
            '#post_message',
            '#post_content',
            '.entry-content',
            '.comment-content'
        ];

        let content = null;
        for (const selector of contentSelectors) {
            content = document.querySelector(selector);
            if (content) break;
        }

        if (!content) {
            const textBlocks = Array.from(document.querySelectorAll('div, p'));
            if (textBlocks.length) {
                content = textBlocks.reduce((longest, current) => 
                    current.textContent.length > longest.textContent.length ? current : longest
                );
            }
        }

        if (!content) {
            console.warn(`[WARN] No content found for ${url}`);
            return null;
        }

        const text = content.textContent.trim();
        const dtcCodes = extractDTCCodes(text);
        const vehicleInfo = extractVehicleInfo(text);

        const title = document.querySelector('h1, h2, h3')?.textContent?.trim() || null;
        const timestamp = document.querySelector('time, .date, .timestamp, .post-date')?.textContent?.trim() || null;

        return {
            url,
            title,
            content: text,
            dtcCodes,
            vehicleInfo,
            timestamp,
            forumUrl: url,
            forumName: 'Car Forums'
            
        };
    } catch (error) {
        console.error(`[ERROR] Failed to scrape ${url}:`, error);
        return null;
    }
};

// Process forum content
router.post('/process', async (req, res) => {
    try {
        const { url, question } = req.body;
        
        // Enhanced URL validation
        if (!url) {
            return res.status(400).json({ 
                success: false, 
                message: 'URL is required' 
            });
        }
        
        // Basic URL validation before passing to service
        try {
            // Add protocol if missing
            let formattedUrl = url;
            if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                formattedUrl = 'https://' + formattedUrl;
            }
            
            // Test if URL is valid
            new URL(formattedUrl);
            
            // If no question is provided, do a general crawl
            const result = question 
                ? await ForumCrawlerService.crawlForumContent(formattedUrl, question)
                : await ForumCrawlerService.crawlForumContent(formattedUrl);
                
            res.json(result);
        } catch (urlError) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid URL provided: ${url}`,
                error: urlError.message
            });
        }
    } catch (error) {
        console.error('Error processing forum:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to process forum content' 
        });
    }
});

// Query processed forum content
router.post('/query', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ success: false, message: 'Question is required' });
        }

        const result = await ForumCrawlerService.queryContent(question);
        res.json(result);
    } catch (error) {
        console.error('Error querying forum:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to query forum content' });
    }
});

// Search forum posts
router.post('/search', async (req, res) => {
    try {
        const { vehicleInfo, dtcCode, forumUrls } = req.body;
        const posts = await scrapeForumPost(forumUrls[0]); // For now, just handle first URL
        res.json(posts);
    } catch (error) {
        console.error('Error searching forum posts:', error);
        res.status(500).json({ message: 'Failed to search forum posts' });
    }
});

router.post('/process-bmw', async (req, res) => {
    try {
        const { url, options } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, message: 'URL is required' });
        }

        const result = await ForumCrawlerService.crawlBMWForums(url, options);
        res.json(result);
    } catch (error) {
        console.error('Error processing BMW Forums:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Failed to process BMW Forums content',
            error: error instanceof BMWForumsError ? error.statusCode : 500
        });
    }
});

export default router;