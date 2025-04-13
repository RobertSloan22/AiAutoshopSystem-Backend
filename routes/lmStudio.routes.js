process.env.TAVILY_API_KEY = "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";

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { default as PQueue } from 'p-queue';

// Configure queue with concurrency limit
const queue = new PQueue({
  concurrency: 2, // Process 2 requests at a time
  timeout: 30000, // 30 second timeout for entire queue operation
  throwOnTimeout: true
});

// localaiRoutes.js
import express from "express";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const router = express.Router();
const LOCALAI_BASE_URL = process.env.LOCALAI_URL || "http://192.168.56.1:1234";

// A helper function to handle fetch calls
async function fetchLocalAI(path, method = "GET", body = null, isFile = false) {
  return queue.add(async () => {
    const url = `${LOCALAI_BASE_URL}${path}`;
    const headers = {};
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    let fetchOptions = { 
      method,
      signal: controller.signal,
      keepalive: true // Keep connection alive
    };

    if (!isFile) {
      headers["Content-Type"] = "application/json";
      if (body) fetchOptions.body = JSON.stringify(body);
    } else {
      fetchOptions.body = body;
      headers["Accept"] = "application/json";
    }

    fetchOptions.headers = headers;

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeout);
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`LocalAI API Error: ${response.status} ${response.statusText}. Details: ${text}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: The LLM took too long to respond');
      }
      throw error;
    }
  }, { timeout: 25000 }); // Individual queue item timeout
}

/*
  ─────────────────────────────────────────────────────────────
   P2P Endpoints: /api/p2p, /api/p2p/token
  ─────────────────────────────────────────────────────────────
*/


/*
  ─────────────────────────────────────────────────────────────
   /v1/audio/speech
  ─────────────────────────────────────────────────────────────
*/


/*
  ─────────────────────────────────────────────────────────────
   /v1/audio/transcriptions
  ─────────────────────────────────────────────────────────────
   - This uses multipart/form-data with "model" and "file"
*/


/*
  ─────────────────────────────────────────────────────────────
   /v1/chat/completions
  ─────────────────────────────────────────────────────────────
*/
router.post("/v1/chat/completions", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/chat/completions", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/completions
  ─────────────────────────────────────────────────────────────
*/
router.post("/v1/completions", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/completions", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/edits
  ─────────────────────────────────────────────────────────────
*/


/*
  ─────────────────────────────────────────────────────────────
   /v1/embeddings
  ─────────────────────────────────────────────────────────────
*/
router.post("/v1/embeddings", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/embeddings", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/files
  ─────────────────────────────────────────────────────────────
*/



// ...
// v1/realtime


/*
  ─────────────────────────────────────────────────────────────
   /v1/images/generations
  ─────────────────────────────────────────────────────────────
*/


/*
  ─────────────────────────────────────────────────────────────
   /v1/models
  ─────────────────────────────────────────────────────────────
*/
router.get("/v1/models", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/models");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/rerank
  ─────────────────────────────────────────────────────────────
*/


export default router;
