process.env.TAVILY_API_KEY = "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";

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import PQueue from 'p-queue';

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
const LOCALAI_BASE_URL = process.env.LOCALAI_URL || "http://localhost:8080";

// Modify the fetchLocalAI function to use the queue
async function fetchLocalAI(path, method = "GET", body = null, isFile = false) {
  return queue.add(async () => {
    const url = `${LOCALAI_BASE_URL}${path}`;
    const headers = {};
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // Increased to 20 second timeout

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
router.get("/api/p2p", async (req, res) => {
  try {
    const r = await fetchLocalAI("/api/p2p");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/api/p2p/token", async (req, res) => {
  try {
    const r = await fetchLocalAI("/api/p2p/token");
    // This one returns string in some implementations
    const text = await r.text();
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   Backend Monitoring & Shutdown
  ─────────────────────────────────────────────────────────────
*/
router.get("/backend/monitor", async (req, res) => {
  try {
    // GET endpoint with optional body. 
    // Realistically, a GET usually doesn't have a request body, 
    // but the swagger specifies it, so we do it if needed.
    const r = await fetchLocalAI("/backend/monitor");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/backend/shutdown", async (req, res) => {
  try {
    const r = await fetchLocalAI("/backend/shutdown", "POST", req.body);
    // This returns no schema, so just a success message
    res.json({ message: "Backend shutdown triggered" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   Metrics: /metrics
  ─────────────────────────────────────────────────────────────
*/
router.get("/metrics", async (req, res) => {
  try {
    const r = await fetchLocalAI("/metrics");
    // Prometheus metrics might be raw text - check your LocalAI usage
    const text = await r.text();
    res.type("text/plain").send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   Model Management (/models/*)
  ─────────────────────────────────────────────────────────────
*/
router.post("/models/apply", async (req, res) => {
  try {
    const r = await fetchLocalAI("/models/apply", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/models/available", async (req, res) => {
  try {
    const r = await fetchLocalAI("/models/available");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/models/delete/:name", async (req, res) => {
  try {
    const r = await fetchLocalAI(`/models/delete/${req.params.name}`, "POST");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   Models - Galleries / Jobs
  ─────────────────────────────────────────────────────────────
*/
router.get("/models/galleries", async (req, res) => {
  try {
    const r = await fetchLocalAI("/models/galleries");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/models/galleries", async (req, res) => {
  try {
    const r = await fetchLocalAI("/models/galleries", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/models/galleries", async (req, res) => {
  try {
    const r = await fetchLocalAI("/models/galleries", "DELETE", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/models/jobs", async (req, res) => {
  try {
    const r = await fetchLocalAI("/models/jobs");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/models/jobs/:uuid", async (req, res) => {
  try {
    const r = await fetchLocalAI(`/models/jobs/${req.params.uuid}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   System Info
  ─────────────────────────────────────────────────────────────
*/
router.get("/system", async (req, res) => {
  try {
    const r = await fetchLocalAI("/system");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   tokenMetrics
  ─────────────────────────────────────────────────────────────
*/
router.get("/tokenMetrics", async (req, res) => {
  try {
    const r = await fetchLocalAI("/tokenMetrics");
    // According to swagger, this returns an audio file
    const arrayBuffer = await r.arrayBuffer();
    res.set("Content-Type", "audio/x-wav");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   TTS (Plain /tts) 
  ─────────────────────────────────────────────────────────────
*/
router.post("/tts", async (req, res) => {
  try {
    // Returns audio/wav
    const url = "/tts";
    const response = await fetchLocalAI(url, "POST", req.body);
    const arrayBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/x-wav");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/assistants
  ─────────────────────────────────────────────────────────────
*/
router.get("/v1/assistants", async (req, res) => {
  // May have query params: limit, order, after, before
  try {
    const queryStr = new URLSearchParams(req.query).toString();
    const fullPath = "/v1/assistants" + (queryStr ? `?${queryStr}` : "");
    const r = await fetchLocalAI(fullPath);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/v1/assistants", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/assistants", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/v1/assistants/:assistant_id", async (req, res) => {
  try {
    const r = await fetchLocalAI(`/v1/assistants/${req.params.assistant_id}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/v1/assistants/:assistant_id", async (req, res) => {
  try {
    const r = await fetchLocalAI(`/v1/assistants/${req.params.assistant_id}`, "DELETE");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/audio/speech
  ─────────────────────────────────────────────────────────────
*/
router.post("/v1/audio/speech", async (req, res) => {
  try {
    const response = await fetchLocalAI("/v1/audio/speech", "POST", req.body);
    const arrayBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/x-wav");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/audio/transcriptions
  ─────────────────────────────────────────────────────────────
   - This uses multipart/form-data with "model" and "file"
*/
router.post("/v1/audio/transcriptions", async (req, res) => {
  try {
    // Check for file
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded. Use formData with 'file' field." });
    }

    // Build formData
    const formData = new FormData();
    formData.append("model", req.body.model || "whisper-1");
    formData.append("file", req.files.file.data, req.files.file.name);

    const url = "/v1/audio/transcriptions";
    const response = await fetchLocalAI(url, "POST", formData, true);
    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
router.post("/v1/edits", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/edits", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
router.get("/v1/files", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/files");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/v1/files/:file_id", async (req, res) => {
  try {
    const r = await fetchLocalAI(`/v1/files/${req.params.file_id}`);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/v1/files/:file_id", async (req, res) => {
  try {
    const r = await fetchLocalAI(`/v1/files/${req.params.file_id}`, "DELETE");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/v1/files/:file_id/content", async (req, res) => {
  try {
    const r = await fetchLocalAI(`/v1/files/${req.params.file_id}/content`);
    // This presumably returns text or raw file content
    const content = await r.text();
    res.send(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ...
// v1/realtime
router.get("/v1/realtime", async (req, res) => {
  try {
    // This calls LocalAI's /v1/realtime endpoint (assuming it exists in Go code).
    const response = await fetchLocalAI("/v1/realtime"); 
    // If the LocalAI endpoint returns JSON, parse it:
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/images/generations
  ─────────────────────────────────────────────────────────────
*/
router.post("/v1/images/generations", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/images/generations", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
router.post("/v1/rerank", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/rerank", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/sound-generation
  ─────────────────────────────────────────────────────────────
*/
router.post("/v1/sound-generation", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/sound-generation", "POST", req.body);
    const text = await r.text(); // According to schema, returns "string"
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/text-to-speech/:voice-id
  ─────────────────────────────────────────────────────────────
*/
router.post("/v1/text-to-speech/:voice_id", async (req, res) => {
  try {
    const r = await fetchLocalAI(`/v1/text-to-speech/${req.params.voice_id}`, "POST", req.body);
    const text = await r.text();
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/tokenMetrics
  ─────────────────────────────────────────────────────────────
*/
router.get("/v1/tokenMetrics", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/tokenMetrics");
    const arrayBuffer = await r.arrayBuffer();
    res.set("Content-Type", "audio/x-wav");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /v1/tokenize
  ─────────────────────────────────────────────────────────────
*/
router.post("/v1/tokenize", async (req, res) => {
  try {
    const r = await fetchLocalAI("/v1/tokenize", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
  ─────────────────────────────────────────────────────────────
   /vad
  ─────────────────────────────────────────────────────────────
*/
router.post("/vad", async (req, res) => {
  try {
    const r = await fetchLocalAI("/vad", "POST", req.body);
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
