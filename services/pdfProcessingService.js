import axios from 'axios';
import dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();
const require = createRequire(import.meta.url);

class PDFProcessingService {
  constructor() {
    this.maxFileSize = 50 * 1024 * 1024; // 50MB limit
    this.supportedFormats = ['.pdf'];
    this.cacheTimeout = 30 * 60 * 1000; // 30 minutes cache
    this.cache = new Map();
    this.pdfParse = null; // Will be loaded on first use
    
    console.log('PDFProcessingService initialized');
  }

  // Lazy load pdf-parse to avoid initialization errors
  async loadPdfParse() {
    if (!this.pdfParse) {
      try {
        // Use require instead of dynamic import to avoid ESM issues
        this.pdfParse = require('pdf-parse');
        console.log('pdf-parse module loaded successfully');
      } catch (error) {
        console.error('Failed to load pdf-parse module:', error.message);
        throw new Error('PDF parsing library not available');
      }
    }
    return this.pdfParse;
  }

  // Tool definition for OpenAI function calling
  getToolDefinition() {
    return {
      type: 'function',
      function: {
        name: 'process_pdf_from_url',
        description: 'Download and process a PDF document from a URL. Extracts text content and metadata for analysis. Useful for processing manuals, technical documents, service bulletins, and other PDF resources.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the PDF document to process'
            },
            extraction_mode: {
              type: 'string',
              enum: ['full', 'summary', 'metadata', 'search'],
              description: 'How to process the PDF content',
              default: 'full'
            },
            search_terms: {
              type: 'array',
              items: { type: 'string' },
              description: 'Terms to search for in the PDF (only used with search mode)'
            },
            page_range: {
              type: 'object',
              properties: {
                start: { type: 'integer', minimum: 1 },
                end: { type: 'integer', minimum: 1 }
              },
              description: 'Specific page range to extract (optional)'
            }
          },
          required: ['url']
        }
      }
    };
  }

  // Main execution method for tool calls
  async executeTool(toolName, parameters) {
    if (toolName !== 'process_pdf_from_url') {
      throw new Error(`Unknown PDF processing tool: ${toolName}`);
    }
    
    return await this.processPDFFromURL(
      parameters.url,
      {
        extractionMode: parameters.extraction_mode,
        searchTerms: parameters.search_terms,
        pageRange: parameters.page_range
      }
    );
  }

  // Process PDF from URL
  async processPDFFromURL(url, options = {}) {
    const { 
      extractionMode = 'full',
      searchTerms = [],
      pageRange = null
    } = options;

    try {
      console.log(`Processing PDF from URL: ${url}`);
      console.log(`Extraction mode: ${extractionMode}`);

      // Check cache first
      const cacheKey = `${url}_${extractionMode}_${JSON.stringify(searchTerms)}_${JSON.stringify(pageRange)}`;
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (cached.timestamp > Date.now() - this.cacheTimeout) {
          console.log('Returning cached PDF data');
          return cached.data;
        }
      }

      // Download PDF
      const pdfBuffer = await this.downloadPDF(url);
      
      // Load pdf-parse module
      const pdfParse = await this.loadPdfParse();
      
      // Parse PDF
      const pdfData = await pdfParse(pdfBuffer, {
        max: pageRange ? pageRange.end : 0,
        version: 'v1.10.100'
      });

      // Process based on extraction mode
      let result;
      switch (extractionMode) {
        case 'full':
          result = await this.extractFullContent(pdfData, pageRange);
          break;
        case 'summary':
          result = await this.extractSummary(pdfData);
          break;
        case 'metadata':
          result = await this.extractMetadata(pdfData);
          break;
        case 'search':
          result = await this.searchContent(pdfData, searchTerms);
          break;
        default:
          throw new Error(`Invalid extraction mode: ${extractionMode}`);
      }

      // Cache the result
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });

      // Clean old cache entries
      this.cleanCache();

      return result;

    } catch (error) {
      console.error('PDF processing error:', error);
      return {
        success: false,
        error: error.message,
        url: url
      };
    }
  }

  // Download PDF from URL
  async downloadPDF(url) {
    console.log(`Downloading PDF from: ${url}`);
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'AiAutoshopSystem-PDFProcessor/1.0'
      },
      timeout: 30000, // 30 second timeout
      maxContentLength: this.maxFileSize
    });

    if (!response.headers['content-type']?.includes('pdf')) {
      throw new Error('URL does not point to a PDF file');
    }

    console.log(`PDF downloaded successfully, size: ${response.data.byteLength} bytes`);
    return Buffer.from(response.data);
  }

  // Extract full content
  async extractFullContent(pdfData, pageRange) {
    let text = pdfData.text;
    
    // If page range specified, extract only those pages
    if (pageRange && pdfData.numpages) {
      const pages = text.split('\n\n');
      const startIdx = Math.max(0, (pageRange.start || 1) - 1);
      const endIdx = Math.min(pages.length, pageRange.end || pages.length);
      text = pages.slice(startIdx, endIdx).join('\n\n');
    }

    // Split into manageable chunks for analysis
    const chunks = this.splitIntoChunks(text, 4000);

    return {
      success: true,
      content: {
        full_text: text,
        chunks: chunks,
        num_chunks: chunks.length
      },
      metadata: {
        num_pages: pdfData.numpages,
        info: pdfData.info,
        version: pdfData.version,
        text_length: text.length
      },
      extraction_mode: 'full',
      page_range: pageRange
    };
  }

  // Extract summary information
  async extractSummary(pdfData) {
    const text = pdfData.text;
    
    // Extract first 2000 characters for summary
    const preview = text.substring(0, 2000);
    
    // Find table of contents if exists
    const tocPattern = /table of contents|contents|index/i;
    const tocMatch = text.match(new RegExp(`(${tocPattern.source}[\\s\\S]{0,5000})`, 'i'));
    
    return {
      success: true,
      content: {
        preview: preview,
        table_of_contents: tocMatch ? tocMatch[1] : null,
        sections: this.extractSections(text)
      },
      metadata: {
        num_pages: pdfData.numpages,
        info: pdfData.info,
        text_length: text.length
      },
      extraction_mode: 'summary'
    };
  }

  // Extract metadata only
  async extractMetadata(pdfData) {
    return {
      success: true,
      metadata: {
        num_pages: pdfData.numpages,
        info: pdfData.info,
        version: pdfData.version,
        text_length: pdfData.text.length,
        creation_date: pdfData.info?.CreationDate,
        modification_date: pdfData.info?.ModDate,
        author: pdfData.info?.Author,
        title: pdfData.info?.Title,
        subject: pdfData.info?.Subject,
        keywords: pdfData.info?.Keywords
      },
      extraction_mode: 'metadata'
    };
  }

  // Search for specific terms
  async searchContent(pdfData, searchTerms) {
    if (!searchTerms || searchTerms.length === 0) {
      throw new Error('Search terms required for search mode');
    }

    const text = pdfData.text;
    const results = [];

    for (const term of searchTerms) {
      const regex = new RegExp(`(.{0,100})\\b${this.escapeRegex(term)}\\b(.{0,100})`, 'gi');
      const matches = [];
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          context: match[0].trim(),
          position: match.index,
          before: match[1].trim(),
          after: match[2].trim()
        });
      }

      results.push({
        term: term,
        count: matches.length,
        matches: matches.slice(0, 10) // Limit to first 10 matches per term
      });
    }

    return {
      success: true,
      search_results: results,
      total_matches: results.reduce((sum, r) => sum + r.count, 0),
      metadata: {
        num_pages: pdfData.numpages,
        text_length: text.length
      },
      extraction_mode: 'search',
      search_terms: searchTerms
    };
  }

  // Helper method to split text into chunks
  splitIntoChunks(text, chunkSize = 4000) {
    const chunks = [];
    const sentences = text.split(/[.!?]\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize) {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + sentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  // Extract sections from text
  extractSections(text) {
    const sections = [];
    
    // Common section patterns
    const sectionPatterns = [
      /^(?:\d+\.?\s*)?([A-Z][A-Z\s]{2,})$/m,
      /^(?:Chapter|Section|Part)\s+\d+[:\s]+(.+)$/mi,
      /^(?:\d+\.?\s+)([A-Z][a-zA-Z\s]+)$/m
    ];

    for (const pattern of sectionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        sections.push({
          title: match[1].trim(),
          position: match.index
        });
      }
    }

    // Sort by position and deduplicate
    return sections
      .sort((a, b) => a.position - b.position)
      .filter((s, i, arr) => i === 0 || s.title !== arr[i-1].title)
      .slice(0, 20); // Limit to first 20 sections
  }

  // Escape regex special characters
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Clean old cache entries
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < now - this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  // Get service status
  getStatus() {
    return {
      available: true,
      supported_formats: this.supportedFormats,
      max_file_size: `${this.maxFileSize / (1024 * 1024)}MB`,
      cache_size: this.cache.size,
      tools: ['process_pdf_from_url']
    };
  }
}

export default PDFProcessingService;