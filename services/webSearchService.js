import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class WebSearchService {
  constructor() {
    this.serperApiKey = process.env.VITE_SERPER_API_KEY || process.env.SERPER_API_KEY;
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    
    // Service availability flags
    this.hasSerper = !!this.serperApiKey;
    this.hasGoogleSearch = !!(this.googleApiKey && this.googleSearchEngineId);
    this.hasOpenAI = !!this.openaiApiKey;
    
    console.log('WebSearchService initialized:', {
      serper: this.hasSerper,
      googleSearch: this.hasGoogleSearch,
      openai: this.hasOpenAI
    });
  }

  // Tool definition for OpenAI function calling
  getToolDefinitions() {
    const tools = [];

    // Web search tool
    tools.push({
      type: 'function',
      function: {
        name: 'web_search',
        description: 'Search the web for current information, automotive technical data, service bulletins, recalls, and troubleshooting guides. Use this for up-to-date information not in your training data.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query. Be specific and include relevant keywords like vehicle make, model, year, DTC codes, etc.'
            },
            search_type: {
              type: 'string',
              enum: ['general', 'automotive', 'technical', 'recall', 'tsb'],
              description: 'Type of search to perform',
              default: 'general'
            },
            max_results: {
              type: 'integer',
              description: 'Maximum number of results to return (1-10)',
              minimum: 1,
              maximum: 10,
              default: 5
            }
          },
          required: ['query']
        }
      }
    });

    // Image search tool for technical diagrams
    tools.push({
      type: 'function',
      function: {
        name: 'search_technical_images',
        description: 'Search for technical images, diagrams, wiring diagrams, and visual guides related to automotive repair and diagnostics.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Image search query (e.g., "2020 Toyota Camry engine diagram", "P0301 diagnostic flowchart")'
            },
            vehicle_context: {
              type: 'object',
              properties: {
                make: { type: 'string' },
                model: { type: 'string' },
                year: { type: 'string' }
              },
              description: 'Vehicle context to improve search relevance'
            },
            image_type: {
              type: 'string',
              enum: ['diagram', 'wiring', 'flowchart', 'parts', 'general'],
              description: 'Type of technical image to search for',
              default: 'general'
            }
          },
          required: ['query']
        }
      }
    });

    return tools;
  }

  async performWebSearch(query, options = {}) {
    const { search_type = 'general', max_results = 5 } = options;

    // Enhance query based on search type
    const enhancedQuery = this.enhanceQuery(query, search_type);
    
    try {
      // Try Serper API first (most reliable)
      if (this.hasSerper) {
        return await this.searchWithSerper(enhancedQuery, max_results);
      }
      
      // Fallback to Google Custom Search
      if (this.hasGoogleSearch) {
        return await this.searchWithGoogle(enhancedQuery, max_results);
      }
      
      throw new Error('No web search service available. Please configure SERPER_API_KEY or Google Search API.');
      
    } catch (error) {
      console.error('Web search error:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  async searchTechnicalImages(query, options = {}) {
    const { vehicle_context = {}, image_type = 'general' } = options;
    
    // Build enhanced query with vehicle context
    let enhancedQuery = query;
    if (vehicle_context.year || vehicle_context.make || vehicle_context.model) {
      const vehicleInfo = [
        vehicle_context.year,
        vehicle_context.make,
        vehicle_context.model
      ].filter(Boolean).join(' ');
      enhancedQuery = `${vehicleInfo} ${query}`;
    }

    // Add image type specific terms
    const imageTypeTerms = {
      diagram: 'diagram schematic blueprint',
      wiring: 'wiring diagram electrical schematic',
      flowchart: 'diagnostic flowchart troubleshooting guide',
      parts: 'parts diagram exploded view',
      general: 'automotive technical'
    };
    
    enhancedQuery += ` ${imageTypeTerms[image_type] || imageTypeTerms.general}`;

    try {
      if (this.hasSerper) {
        return await this.searchImagesWithSerper(enhancedQuery);
      }
      
      if (this.hasGoogleSearch) {
        return await this.searchImagesWithGoogle(enhancedQuery);
      }
      
      throw new Error('No image search service available.');
      
    } catch (error) {
      console.error('Image search error:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  enhanceQuery(query, searchType) {
    const enhancements = {
      automotive: 'automotive car vehicle truck',
      technical: 'technical manual service repair',
      recall: 'recall TSB technical service bulletin NHTSA',
      tsb: 'TSB technical service bulletin manufacturer recall',
      general: ''
    };

    const enhancement = enhancements[searchType] || '';
    return enhancement ? `${query} ${enhancement}` : query;
  }

  async searchWithSerper(query, maxResults = 5) {
    const response = await axios.post('https://google.serper.dev/search', {
      q: query,
      num: maxResults,
      gl: 'us',
      hl: 'en'
    }, {
      headers: {
        'X-API-KEY': this.serperApiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const results = response.data.organic || [];
    
    return {
      success: true,
      query: query,
      total_results: results.length,
      results: results.map(result => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        date: result.date || null,
        source: this.extractDomain(result.link)
      }))
    };
  }

  async searchImagesWithSerper(query) {
    const response = await axios.post('https://google.serper.dev/images', {
      q: query,
      num: 10,
      gl: 'us',
      hl: 'en'
    }, {
      headers: {
        'X-API-KEY': this.serperApiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const results = response.data.images || [];
    
    return {
      success: true,
      query: query,
      total_results: results.length,
      results: results.map(result => ({
        title: result.title,
        url: result.link,
        image_url: result.imageUrl,
        thumbnail_url: result.imageUrl,
        source: this.extractDomain(result.link),
        width: result.imageWidth,
        height: result.imageHeight,
        size: result.size
      }))
    };
  }

  async searchWithGoogle(query, maxResults = 5) {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: this.googleApiKey,
        cx: this.googleSearchEngineId,
        q: query,
        num: maxResults,
        safe: 'active'
      },
      timeout: 10000
    });

    const results = response.data.items || [];
    
    return {
      success: true,
      query: query,
      total_results: results.length,
      results: results.map(result => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        date: result.pagemap?.metatags?.[0]?.['article:published_time'] || null,
        source: this.extractDomain(result.link)
      }))
    };
  }

  async searchImagesWithGoogle(query) {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: this.googleApiKey,
        cx: this.googleSearchEngineId,
        q: query,
        searchType: 'image',
        num: 10,
        safe: 'active',
        fileType: 'jpg,png,jpeg',
        rights: 'cc_publicdomain,cc_attribute,cc_sharealike,cc_noncommercial,cc_nonderived'
      },
      timeout: 10000
    });

    const results = response.data.items || [];
    
    return {
      success: true,
      query: query,
      total_results: results.length,
      results: results.map(result => ({
        title: result.title,
        url: result.link,
        image_url: result.link,
        thumbnail_url: result.image?.thumbnailLink,
        source: this.extractDomain(result.image?.contextLink || result.link),
        width: result.image?.width,
        height: result.image?.height
      }))
    };
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  // Execute tool call
  async executeTool(toolName, parameters) {
    switch (toolName) {
      case 'web_search':
        return await this.performWebSearch(
          parameters.query,
          {
            search_type: parameters.search_type,
            max_results: parameters.max_results
          }
        );
        
      case 'search_technical_images':
        return await this.searchTechnicalImages(
          parameters.query,
          {
            vehicle_context: parameters.vehicle_context,
            image_type: parameters.image_type
          }
        );
        
      default:
        throw new Error(`Unknown web search tool: ${toolName}`);
    }
  }

  // Get service status
  getStatus() {
    return {
      available: this.hasSerper || this.hasGoogleSearch,
      services: {
        serper: this.hasSerper,
        googleSearch: this.hasGoogleSearch,
        openai: this.hasOpenAI
      },
      tools: this.getToolDefinitions().map(tool => tool.function.name)
    };
  }
}

export default WebSearchService;