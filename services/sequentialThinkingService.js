import multiMCPService from './multiMCPService.js';

/**
 * Sequential Thinking Service
 * 
 * Wrapper service that detects complex problems and automatically
 * uses the sequential thinking MCP server for structured problem-solving.
 */

class SequentialThinkingService {
  constructor() {
    this.serverName = 'sequentialThinking';
    this.complexityKeywords = [
      'complex', 'multiple', 'several', 'various', 'different',
      'analyze', 'investigate', 'diagnose', 'troubleshoot',
      'step by step', 'process', 'procedure', 'methodology',
      'intermittent', 'intermittently', 'sporadic', 'random',
      'multiple systems', 'multiple components', 'interrelated',
      'root cause', 'underlying issue', 'systematic'
    ];
  }

  /**
   * Check if a query would benefit from sequential thinking
   */
  shouldUseSequentialThinking(query) {
    if (!query || typeof query !== 'string') {
      return false;
    }

    const lowerQuery = query.toLowerCase();
    
    // Check for complexity indicators
    const hasComplexityKeywords = this.complexityKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    );

    // Check for multiple questions or steps
    const questionCount = (lowerQuery.match(/\?/g) || []).length;
    const hasMultipleQuestions = questionCount > 1;

    // Check for step indicators
    const stepIndicators = ['first', 'then', 'next', 'finally', 'step 1', 'step 2'];
    const hasStepIndicators = stepIndicators.some(indicator => 
      lowerQuery.includes(indicator)
    );

    // Check query length (longer queries are often more complex)
    const isLongQuery = query.length > 200;

    // Check for diagnostic/problem-solving language
    const diagnosticKeywords = ['why', 'how', 'what causes', 'what could', 'determine', 'identify'];
    const hasDiagnosticLanguage = diagnosticKeywords.some(keyword => 
      lowerQuery.includes(keyword)
    );

    // Use sequential thinking if any complexity indicators are present
    return hasComplexityKeywords || 
           hasMultipleQuestions || 
           hasStepIndicators || 
           (isLongQuery && hasDiagnosticLanguage);
  }

  /**
   * Use sequential thinking to solve a complex problem
   */
  async solveWithSequentialThinking(problem, options = {}) {
    const {
      thoughtNumber = 1,
      totalThoughts = 5,
      isRevision = false,
      revisesThought = null
    } = options;

    try {
      // Check if sequential thinking server is available
      const tools = multiMCPService.getToolDefinitions();
      const sequentialTool = tools.find(tool => {
        const toolName = tool.function?.name || tool.name || '';
        return toolName.toLowerCase().includes('sequential') || 
               toolName.toLowerCase().includes('thinking');
      });
      
      if (!sequentialTool) {
        console.warn('Sequential thinking tool not available');
        return null;
      }

      // Prepare parameters for sequential thinking
      const parameters = {
        thought: problem,
        nextThoughtNeeded: true,
        thoughtNumber: thoughtNumber,
        totalThoughts: totalThoughts,
        isRevision: isRevision || false,
        ...(revisesThought && { revisesThought }),
        ...(isRevision && { needsMoreThoughts: false })
      };

      // Call the sequential thinking tool
      const result = await multiMCPService.callTool('sequentialthinking', parameters);
      
      return this.formatSequentialThinkingResult(result);
    } catch (error) {
      console.error('Error using sequential thinking:', error);
      return null;
    }
  }

  /**
   * Format the result from sequential thinking
   */
  formatSequentialThinkingResult(result) {
    if (typeof result === 'string') {
      return {
        thought: result,
        formatted: result
      };
    }

    if (result && typeof result === 'object') {
      return {
        thought: result.thought || result.content || JSON.stringify(result),
        formatted: this.formatThoughtOutput(result),
        nextThoughtNeeded: result.nextThoughtNeeded || false,
        thoughtNumber: result.thoughtNumber,
        totalThoughts: result.totalThoughts
      };
    }

    return {
      thought: String(result),
      formatted: String(result)
    };
  }

  /**
   * Format thought output for display
   */
  formatThoughtOutput(result) {
    if (result.solution) {
      return `Solution: ${result.solution}\n\nReasoning: ${result.thought || ''}`;
    }
    
    if (result.thought) {
      return result.thought;
    }

    if (result.content) {
      return Array.isArray(result.content) 
        ? result.content.map(c => c.text || c).join('\n')
        : result.content;
    }

    return JSON.stringify(result, null, 2);
  }

  /**
   * Process a complex query with sequential thinking
   * This method breaks down the problem and uses sequential thinking
   */
  async processComplexQuery(query, context = {}) {
    if (!this.shouldUseSequentialThinking(query)) {
      return null; // Not complex enough for sequential thinking
    }

    console.log('🧠 Using sequential thinking for complex query');

    try {
      // Build the problem statement with context
      let problemStatement = query;
      
      if (context.vehicleContext) {
        const vehicle = context.vehicleContext;
        if (vehicle.make || vehicle.model || vehicle.year) {
          problemStatement = `Vehicle: ${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}\n\nProblem: ${query}`;
        }
      }

      if (context.customerContext?.dtcCode) {
        problemStatement += `\n\nDTC Code: ${context.customerContext.dtcCode}`;
      }

      // Use sequential thinking to solve
      const result = await this.solveWithSequentialThinking(problemStatement, {
        totalThoughts: 7 // More thoughts for complex automotive problems
      });

      if (result) {
        return {
          usedSequentialThinking: true,
          result: result.formatted || result.thought,
          rawResult: result
        };
      }
    } catch (error) {
      console.error('Error processing complex query with sequential thinking:', error);
    }

    return null;
  }

  /**
   * Check if sequential thinking server is available
   */
  isAvailable() {
    const tools = multiMCPService.getToolDefinitions();
    return tools.some(tool => {
      const toolName = tool.function?.name || tool.name || '';
      return toolName.toLowerCase().includes('sequential') || 
             toolName.toLowerCase().includes('thinking');
    });
  }
}

export default new SequentialThinkingService();

