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
  }

  addContext(content) {
    this.messages.push({ role: 'user', content });
  }

  registerTool(tool) {
    this.tools.push(tool);
  }

  getToolDefinitions() {
    return this.tools.map(tool => tool.getDefinition());
  }

  async task(userQuery, options = {}) {
    this.messages.push({ role: 'user', content: userQuery });

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
        const toolResult = await tool.run(args);
        console.log(`🔧 Tool result length: ${toolResult.length} bytes`);
        console.log(`🔧 Tool result preview: ${toolResult.substring(0, 200)}...`);

        this.messages.push(message);
        this.messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult
        });

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
  }
}

export default BaseAgent;
