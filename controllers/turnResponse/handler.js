import OpenAI from "openai";
import { MODEL } from "../../config/constants.js";
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// FINAL CORRECTED Tool formatting function
function formatToolsForOpenAI(tools) {
  if (!Array.isArray(tools)) {
    console.warn('Tools is not an array:', typeof tools);
    return [];
  }

  return tools.map(tool => {
    if (!tool || typeof tool !== 'object') {
      console.warn('Invalid tool object:', tool);
      return null;
    }

    // Handle different tool types correctly
    switch (tool.type) {
      case 'web_search':
        // Web search tools should NOT have a name property
        return {
          type: 'web_search'
        };

      case 'code_interpreter':
        // Code interpreter tools should NOT have a name property
        return {
          type: 'code_interpreter'
        };

      case 'file_search':
        // File search tools should NOT have a name property
        return {
          type: 'file_search',
          vector_store_ids: tool.vector_store_ids || []
        };

      case 'function':
        // Function tools NEED BOTH top-level name AND nested function.name
        if (tool.function) {
          // Already in correct format - ensure both names match
          return {
            type: 'function',
            name: tool.function.name, // ✅ TOP-LEVEL NAME REQUIRED
            function: {
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters,
              ...(tool.function.strict !== undefined && { strict: tool.function.strict })
            }
          };
        } else {
          // Legacy format - convert to correct structure with both names
          return {
            type: 'function',
            name: tool.name, // ✅ TOP-LEVEL NAME REQUIRED
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              ...(tool.strict !== undefined && { strict: tool.strict })
            }
          };
        }

      default:
        // If it's a function tool without explicit type but has name/description
        if (tool.name && (tool.description || tool.parameters)) {
          console.warn('Converting legacy function tool:', tool.name);
          return {
            type: 'function',
            name: tool.name, // ✅ TOP-LEVEL NAME REQUIRED
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              ...(tool.strict !== undefined && { strict: tool.strict })
            }
          };
        }

        // Unknown tool type - log error and skip
        console.error('Unknown or malformed tool type:', tool);
        return null;
    }
  }).filter(Boolean); // Remove any null/undefined tools
}

export const handleTurnResponse = async (req, res) => {
  try {
    console.log("Turn response handler called");
    console.log("Request body:", req.body);
    console.log("Request headers:", req.headers);

    const { messages, tools, model, input, stream, temperature, parallel_tool_calls, store, previous_response_id } = req.body;
    console.log("Received messages:", messages);
    console.log("Received tools:", tools);

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Messages array is required and must not be empty");
    }

    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    console.log("Making OpenAI API call with model:", model || MODEL);

    try {
      // FINAL CORRECTED: Process tools to ensure they have the correct format
      console.log("Processing tools for OpenAI API:", JSON.stringify(tools, null, 2));
      
      const formattedTools = formatToolsForOpenAI(tools || []);
      
      // Final validation check
      formattedTools.forEach((tool, index) => {
        if (tool.type === 'function') {
          if (!('name' in tool)) {
            console.error(`❌ Function tool at index ${index} missing top-level name:`, JSON.stringify(tool, null, 2));
          }
          if (tool.name !== tool.function?.name) {
            console.error(`❌ Function tool at index ${index} names don't match. Top: "${tool.name}", Function: "${tool.function?.name}"`);
          }
        }
        if (tool.type !== 'function' && 'name' in tool) {
          console.error(`❌ Non-function tool at index ${index} has name property:`, JSON.stringify(tool, null, 2));
        }
      });
      
      console.log("Formatted tools:", JSON.stringify(formattedTools, null, 2));
      
      // Create the response with web search enabled
      const response = await openai.responses.create({
        model: model || MODEL,
        input: messages[messages.length - 1].content,
        tools: formattedTools,
        stream: stream !== undefined ? stream : true,
        temperature: temperature || 0.7,
        max_output_tokens: 1000,
        parallel_tool_calls: parallel_tool_calls !== undefined ? parallel_tool_calls : true,
        store: store !== undefined ? store : true,
        previous_response_id: previous_response_id
      });

      console.log("OpenAI API call successful, starting stream");

      // Stream the events to the client
      for await (const event of response) {
        if (event.type === 'web_search_call') {
          // Handle web search call event
          const data = JSON.stringify({
            event: 'response.web_search_call.completed',
            data: {
              item_id: event.id,
              output: event.output
            }
          });
          console.log("Web search event:", data);
          res.write(`data: ${data}\n\n`);
        } else if (event.type === 'message') {
          // Handle message event with delta streaming
          const content = event.content[0];
          if (content?.type === 'output_text') {
            const data = JSON.stringify({
              event: 'response.output_text.delta',
              data: {
                delta: content.text,
                item_id: event.id
              }
            });
            console.log("Message delta event:", data);
            res.write(`data: ${data}\n\n`);

            // Send annotation events if any
            if (content.annotations?.length > 0) {
              for (const annotation of content.annotations) {
                const annotationData = JSON.stringify({
                  event: 'response.output_text.annotation.added',
                  data: {
                    annotation,
                    item_id: event.id
                  }
                });
                res.write(`data: ${annotationData}\n\n`);
              }
            }
          }
        } else if (event.type === 'function_call') {
          // Handle function call events
          const data = JSON.stringify({
            event: 'response.function_call_arguments.delta',
            data: {
              delta: event.arguments,
              item_id: event.id
            }
          });
          console.log("Function call event:", data);
          res.write(`data: ${data}\n\n`);

          // Send function call completion event
          const completionData = JSON.stringify({
            event: 'response.function_call_arguments.done',
            data: {
              item_id: event.id,
              arguments: event.arguments
            }
          });
          res.write(`data: ${completionData}\n\n`);
        }
      }

      // Send completion event
      res.write('data: [DONE]\n\n');
      console.log("Stream completed");
      res.end();
    } catch (openaiError) {
      console.error("OpenAI API Error:", openaiError);
      res.write(`data: ${JSON.stringify({ error: openaiError.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("Error in turn response handler:", error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};