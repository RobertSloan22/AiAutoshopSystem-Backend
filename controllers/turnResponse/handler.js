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
      // Create the response with web search enabled
      const response = await openai.responses.create({
        model: model || MODEL,
        input: messages[messages.length - 1].content,
        tools: tools,
        stream: stream || true,
        temperature: temperature || 0.7,
        max_output_tokens: 1000,
        parallel_tool_calls: parallel_tool_calls || true,
        store: store || true,
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