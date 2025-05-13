// CORS Fix for Eliza Service Proxy
// This file contains the corrected proxy configuration for the Eliza service

import { createProxyMiddleware } from 'http-proxy-middleware';

export const elizaProxyMiddleware = createProxyMiddleware({
  target: 'http://localhost:3000',
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    '^/eliza': '/' // rewrite path
  },
  // Add these settings:
  timeout: 60000, // Increase timeout to 60 seconds
  proxyTimeout: 60000,
  // Configure larger limits for proxy
  maxBodyLength: 50 * 1024 * 1024, // 50MB max body length
  // Handle CORS headers correctly
  onProxyRes: (proxyRes, req, res) => {
    // Get the origin from the request
    const origin = req.headers.origin;
    
    // If there's an origin header, ensure proper CORS headers are set
    if (origin) {
      // For preflight OPTIONS requests and regular requests
      // IMPORTANT: Force overwrite of the CORS headers from the proxied service
      proxyRes.headers['Access-Control-Allow-Origin'] = origin;
      proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
      proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With, Accept, Origin';
      proxyRes.headers['Access-Control-Max-Age'] = '86400'; // 24 hours
      
      // Remove '*' wildcard if it exists in lowercase headers
      if (proxyRes.headers['access-control-allow-origin'] === '*') {
        proxyRes.headers['access-control-allow-origin'] = origin;
      }
    }
    
    console.log('Eliza proxy response to origin:', origin);
  },
  // Better request handling
  onProxyReq: (proxyReq, req, res) => {
    // Add origin header to forwarded request if missing
    if (!proxyReq.getHeader('origin') && req.headers.origin) {
      proxyReq.setHeader('origin', req.headers.origin);
    }

    // Set appropriate content length if possible
    if (req.body) {
      try {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        // Stream body to request
        proxyReq.write(bodyData);
      } catch (error) {
        console.error('Error processing request body:', error);
      }
    }
    
    console.log('Eliza proxy request from origin:', req.headers.origin);
  },
  // WebSocket-specific settings
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    // Log WebSocket connection attempts
    console.log(`WebSocket connection attempt to Eliza from ${req.headers.origin || 'unknown origin'}`);
    
    // Add origin to the headers if available
    if (req.headers.origin) {
      proxyReq.setHeader('Origin', req.headers.origin);
    }
  },
  // Handle connection errors better
  onError: (err, req, res) => {
    console.error('Eliza proxy error:', err);
    
    // Check if this is a WebSocket connection (no res object)
    if (!res || !res.writeHead) {
      console.error('Eliza WebSocket proxy error:', err.message || 'Unknown WebSocket error');
      return;
    }
    
    if (!res.headersSent) {
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin'
      });
      res.end(JSON.stringify({ 
        error: "Eliza service is currently unavailable",
        message: err.message,
        code: "SERVICE_UNAVAILABLE"
      }));
    }
  }
});

// To use this middleware in server.js:
// 1. Import the middleware: import { elizaProxyMiddleware } from './cors-eliza-fix.js';
// 2. Replace the existing '/eliza' route with: app.use('/eliza', elizaProxyMiddleware);

// Special handling for OPTIONS requests to eliza endpoint
export const elizaOptionsHandler = (req, res) => {
  const origin = req.headers.origin;
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
};

// To use this handler in server.js:
// app.options('/eliza/*', elizaOptionsHandler);