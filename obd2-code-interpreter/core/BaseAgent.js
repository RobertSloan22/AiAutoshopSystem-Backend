/**
 * BaseAgent - Core agent class for OBD2 secure code interpreter
 * This is SEPARATE from your existing agent systems
 */

class BaseAgent {
  constructor({ prompt, model, languageModelInterface, reasoningEffort = null }) {
    this.prompt = prompt;
    this.model = model;
    this.languageModelInterface = languageModelInterface;
    this.reasoningEffort = reasoningEffort;
    this.messages = [{ role: 'system', content: prompt }];
    this.tools = [];
    this.generatedPlots = []; // Store plots separately to preserve them after truncation
  }

  addContext(content) {
    this.messages.push({ role: 'user', content });
  }

  /**
   * Reset message history to initial state (system prompt only)
   * Call this after completing an analysis to prevent context buildup
   */
  resetMessageHistory() {
    this.messages = [{ role: 'system', content: this.prompt }];
    console.log('🔄 Message history reset to system prompt only');
  }

  /**
   * Get current message history token estimate
   * Rough estimate: 1 token ≈ 4 characters
   */
  getTokenEstimate() {
    const totalChars = this.messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return sum + content.length;
    }, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Prune old messages to keep context within limits
   * Keeps system prompt + most recent N message pairs
   */
  pruneMessageHistory(keepRecentPairs = 3) {
    if (this.messages.length <= 1 + (keepRecentPairs * 2)) {
      return; // Not enough messages to prune
    }

    const systemPrompt = this.messages[0]; // Always keep system prompt
    const recentMessages = this.messages.slice(-(keepRecentPairs * 2)); // Keep last N pairs

    const beforeCount = this.messages.length;
    this.messages = [systemPrompt, ...recentMessages];
    const afterCount = this.messages.length;

    console.log(`🔄 Pruned message history: ${beforeCount} → ${afterCount} messages`);
  }

  registerTool(tool) {
    this.tools.push(tool);
  }

  getToolDefinitions() {
    return this.tools.map(tool => tool.getDefinition());
  }

  /**
   * Truncates large tool results to prevent context overflow
   * Keeps essential information while reducing token count
   * AGGRESSIVE mode: Removes plot data entirely from message history
   */
  truncateToolResult(toolResult, maxLength = 5000) {
    if (toolResult.length <= maxLength) {
      return toolResult;
    }

    try {
      // Try to parse as JSON to create an intelligent summary
      const parsed = JSON.parse(toolResult);

      if (parsed.success) {
        // For successful results, keep summary but truncate large data
        const truncated = {
          success: parsed.success,
          message: parsed.message || 'Data loaded successfully',
          summary: parsed.summary || {},
          dataLocation: parsed.dataLocation,
          instructions: parsed.instructions,
          // REMOVED: plots array to save context space
          plotCount: parsed.plots ? parsed.plots.length : 0,
          _truncated: true,
          _originalSize: toolResult.length,
          _plotsRemoved: true
        };

        return JSON.stringify(truncated, null, 2);
      }

      // For Python execution results, be VERY aggressive
      if (parsed.plots && Array.isArray(parsed.plots)) {
        // Extract only minimal output summary (first and last 10 lines)
        let outputSummary = null;
        if (parsed.output) {
          const outputLines = parsed.output.split('\n');
          if (outputLines.length > 20) {
            const firstPart = outputLines.slice(0, 10).join('\n');
            const lastPart = outputLines.slice(-10).join('\n');
            outputSummary = `${firstPart}\n... [${outputLines.length - 20} lines omitted] ...\n${lastPart}`;
          } else {
            outputSummary = parsed.output.substring(0, 2000); // Max 2000 chars
          }
        }

        const truncated = {
          output: outputSummary,
          errors: parsed.errors,
          // REMOVED: plots array - saves 50-200KB per plot!
          plotCount: parsed.plots.length,
          plotFilenames: parsed.plots.map(p => p.filename || 'unknown'),
          _truncated: true,
          _originalSize: toolResult.length,
          _plotsRemoved: true,
          _note: 'Plots generated successfully but removed from context to save tokens'
        };
        return JSON.stringify(truncated, null, 2);
      }

      // For other JSON, return minimal preview
      return JSON.stringify({
        _truncated: true,
        _originalSize: toolResult.length,
        _preview: toolResult.substring(0, 1000) // Reduced from 5000
      }, null, 2);

    } catch (e) {
      // Not JSON, just truncate with indicator
      return toolResult.substring(0, maxLength) + `\n\n[... truncated ${toolResult.length - maxLength} bytes]`;
    }
  }

  async task(userQuery, options = {}) {
    const maxRetries = options.maxRetries || 2;

    this.messages.push({ role: 'user', content: userQuery });

    // CRITICAL: Check token count before each API call to prevent context overflow
    const estimatedTokens = this.getTokenEstimate();
    console.log(`📊 Current message history: ${this.messages.length} messages, ~${estimatedTokens} tokens`);

    // If approaching context limit (o3-mini has 128k context), prune aggressively
    if (estimatedTokens > 100000) {
      console.warn(`⚠️  Context approaching limit (${estimatedTokens} tokens), pruning to most recent messages`);
      this.pruneMessageHistory(2); // Keep only last 2 message pairs + system prompt
    } else if (estimatedTokens > 60000) {
      console.warn(`⚠️  Context getting large (${estimatedTokens} tokens), pruning old messages`);
      this.pruneMessageHistory(4); // Keep only last 4 message pairs + system prompt
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const apiParams = {
          model: this.model,
          messages: this.messages,
          tools: this.getToolDefinitions()
        };

        if (this.reasoningEffort) {
          apiParams.reasoning_effort = this.reasoningEffort;
        }

        const response = await this.languageModelInterface.createCompletion(apiParams);
        const message = response.choices[0].message;

        // Handle tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
          console.log(`🔧 Tool calls detected: ${message.tool_calls.length}`);
          const toolCall = message.tool_calls[0];
          console.log(`🔧 Calling tool: ${toolCall.function.name}`);
          console.log(`🔧 Tool arguments: ${toolCall.function.arguments}`);
          const tool = this.tools.find(t => t.name === toolCall.function.name);

          if (tool) {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`🔧 Executing tool with parsed args:`, args);

            let toolResult;
            try {
              toolResult = await tool.run(args);
              console.log(`🔧 Tool result length: ${toolResult.length} bytes`);
              console.log(`🔧 Tool result preview: ${toolResult.substring(0, 200)}...`);

              // Check if tool result contains an error
              const parsedResult = JSON.parse(toolResult);
              if (parsedResult.error && attempt < maxRetries) {
                // Tool execution failed, but we can retry
                console.log(`⚠️  Tool execution failed (attempt ${attempt + 1}/${maxRetries + 1}): ${parsedResult.error}`);

                // Add error feedback to help LLM fix the issue
                this.messages.push(message);
                this.messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    error: parsedResult.error,
                    feedback: 'The code execution failed. Please fix the error and try again. Remember: keep all strings on single lines, use \\n for newlines, avoid literal line breaks in f-strings.'
                  })
                });

                console.log(`🔄 Retrying with error feedback...`);
                continue; // Retry
              }
            } catch (toolError) {
              console.error(`❌ Tool execution threw exception:`, toolError);

              if (attempt < maxRetries) {
                // Add error feedback
                this.messages.push(message);
                this.messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    error: toolError.message,
                    feedback: 'An unexpected error occurred during code execution. Please review your code for syntax errors and try again.'
                  })
                });

                console.log(`🔄 Retrying after exception (attempt ${attempt + 1}/${maxRetries + 1})...`);
                continue; // Retry
              } else {
                // Max retries reached, return error
                toolResult = JSON.stringify({
                  error: toolError.message,
                  message: 'Maximum retry attempts reached. Unable to execute code successfully.'
                });
              }
            }

            this.messages.push(message);

            // CRITICAL: Extract plots BEFORE truncation to preserve them
            try {
              const parsedToolResult = JSON.parse(toolResult);
              if (parsedToolResult.plots && Array.isArray(parsedToolResult.plots)) {
                this.generatedPlots.push(...parsedToolResult.plots);
                console.log(`📊 Extracted ${parsedToolResult.plots.length} plot(s), total: ${this.generatedPlots.length}`);
              }
            } catch (e) {
              // Not JSON or no plots, skip
            }

            // CRITICAL FIX: Truncate large tool results BEFORE sending to LLM
            // This prevents context overflow on the immediate next call
            let contentForLLM = toolResult;
            if (toolResult.length > 10000) {
              console.log(`🔧 Truncating large tool result (${toolResult.length} bytes) before LLM call`);
              contentForLLM = this.truncateToolResult(toolResult, 8000);
              console.log(`🔧 Tool result truncated to ${contentForLLM.length} bytes for LLM`);
            }

            // Add the truncated tool result for the immediate next call
            const toolMessage = {
              role: 'tool',
              tool_call_id: toolCall.id,
              content: contentForLLM
            };
            this.messages.push(toolMessage);

            console.log(`🔧 Requesting final response from LLM...`);
            const finalResponse = await this.languageModelInterface.createCompletion({
              model: this.model,
              messages: this.messages,
              ...(this.reasoningEffort && { reasoning_effort: this.reasoningEffort })
            });

            const finalMessage = finalResponse.choices[0].message.content;
            console.log(`🔧 Final response received: ${finalMessage.substring(0, 200)}...`);

            this.messages.push({ role: 'assistant', content: finalMessage });
            return finalMessage;
          } else {
            console.log(`⚠️  Tool not found: ${toolCall.function.name}`);
          }
        } else {
          console.log(`ℹ️  No tool calls in response`);
        }

        this.messages.push(message);
        return message.content;

      } catch (error) {
        console.error(`❌ Error in task execution (attempt ${attempt + 1}/${maxRetries + 1}):`, error);

        if (attempt >= maxRetries) {
          throw error; // Re-throw if max retries exceeded
        }

        // Add error context for retry
        this.messages.push({
          role: 'system',
          content: `Previous attempt failed with error: ${error.message}. Please try a different approach.`
        });
      }
    }
  }
}

export default BaseAgent;
