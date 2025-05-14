import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Define allowed origins (should match your main server CORS config)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://noobtoolai.com',
  'https://www.noobtoolai.com',
  'https://dist-nrl1pmml9-robmit2023s-projects.vercel.app',
  'https://eliza.ngrok.app',
  'wss://eliza.ngrok.app'
];

// Initialize Socket.io with better configuration
const io = new Server(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin) || 
          origin.includes('vercel.app') || 
          origin.includes('ngrok.app') || 
          origin.includes('ngrok-free.app')) {
        return callback(null, true);
      }
      
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'], // Keep both transports
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8,
  // Add these for better WebSocket handling
  allowUpgrades: true,
  cookie: false, // Disable cookies for better compatibility
  serveClient: false // Don't serve Socket.IO client files
});

const userSocketMap = {}; // {userId: socketId}

export const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

// Get all connected users
export const getConnectedUsers = () => {
  return Object.keys(userSocketMap);
};

// Initialize main Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  console.log("Origin:", socket.handshake.headers.origin);

  const userId = socket.handshake.query.userId;
  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    console.log(`User ${userId} mapped to socket ${socket.id}`);
  }

  // Emit online users to all clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Emit connection status to the connected client
  socket.emit("connection_status", {
    status: "connected",
    userId: userId,
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    server: 'Socket.IO'
  });

  // Handle realtime chat events
  socket.on("chat_message", (data) => {
    try {
      const { message, sessionId, receiverId } = data;
      console.log('Chat message received:', { sessionId, receiverId, messageLength: message?.length });

      // If there's a specific receiver, send only to them
      if (receiverId) {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("chat_message", {
            ...data,
            timestamp: new Date().toISOString()
          });
          console.log(`Message sent to user ${receiverId}`);
          return;
        } else {
          console.log(`Receiver ${receiverId} not found online`);
        }
      }

      // Otherwise broadcast to the room if sessionId exists
      if (sessionId) {
        socket.to(sessionId).emit("chat_message", {
          ...data,
          timestamp: new Date().toISOString()
        });
        console.log(`Message broadcast to session ${sessionId}`);
      }
    } catch (error) {
      console.error("Chat message error:", error);
      socket.emit("error", {
        type: "chat_message_error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle room joining for realtime sessions
  socket.on("join_session", ({ sessionId }) => {
    if (sessionId) {
      socket.join(sessionId);
      socket.to(sessionId).emit("user_joined", {
        userId,
        sessionId,
        timestamp: new Date().toISOString()
      });
      console.log(`User ${userId} joined session ${sessionId}`);
      
      // Confirm join to the user
      socket.emit("session_joined", {
        sessionId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle room leaving
  socket.on("leave_session", ({ sessionId }) => {
    if (sessionId) {
      socket.leave(sessionId);
      socket.to(sessionId).emit("user_left", {
        userId,
        sessionId,
        timestamp: new Date().toISOString()
      });
      console.log(`User ${userId} left session ${sessionId}`);
      
      // Confirm leave to the user
      socket.emit("session_left", {
        sessionId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle research-specific events
  socket.on("vector-search", async (data) => {
    try {
      const { query, filters, limit = 10 } = data;
      console.log('Vector search request:', { query, filters, limit });
      
      // Here you could integrate with your vector search service
      // For now, we'll emit a placeholder response
      socket.emit("vector-search-results", {
        success: true,
        results: [],
        totalResults: 0,
        query,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Vector search error:", error);
      socket.emit("vector-search-results", {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle research agent connection status
  socket.on("research_agent_status", (data) => {
    try {
      const { status, agentId, message } = data;
      console.log('Research agent status:', { status, agentId });
      
      // Broadcast to all clients or specific session
      if (data.sessionId) {
        socket.to(data.sessionId).emit("research_agent_status", {
          ...data,
          timestamp: new Date().toISOString()
        });
      } else {
        io.emit("research_agent_status", {
          ...data,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Research agent status error:", error);
    }
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log("User disconnected:", socket.id, "Reason:", reason);

    // Clean up user mapping
    const disconnectedUserId = Object.keys(userSocketMap).find(
      id => userSocketMap[id] === socket.id
    );

    if (disconnectedUserId) {
      delete userSocketMap[disconnectedUserId];
      console.log(`Removed user ${disconnectedUserId} from user map`);
    }

    // Notify all clients that this user disconnected
    io.emit("user_disconnected", {
      userId: disconnectedUserId,
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Update online users list
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });

  // Handle connection errors
  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
  });

  // Handle general errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
    socket.emit("error", {
      message: "An error occurred in the socket connection",
      timestamp: new Date().toISOString()
    });
  });

  // Handle WebRTC signaling
  socket.on("webrtc_signal", (data) => {
    try {
      const { signal, sessionId, receiverId } = data;
      console.log('WebRTC signal:', { sessionId, receiverId, signalType: signal?.type });

      if (receiverId) {
        const receiverSocketId = getReceiverSocketId(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("webrtc_signal", {
            signal,
            sessionId,
            senderId: userId,
            timestamp: new Date().toISOString()
          });
          console.log(`WebRTC signal sent to user ${receiverId}`);
        } else {
          console.log(`WebRTC receiver ${receiverId} not found online`);
        }
      } else if (sessionId) {
        // Broadcast to session if no specific receiver
        socket.to(sessionId).emit("webrtc_signal", {
          signal,
          sessionId,
          senderId: userId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("WebRTC signaling error:", error);
      socket.emit("error", {
        type: "webrtc_signal_error",
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle ping/pong for connection testing
  socket.on("ping", (data) => {
    socket.emit("pong", {
      ...data,
      serverTime: new Date().toISOString()
    });
  });
});

// Handle server-level Socket.IO errors
io.engine.on("connection_error", (err) => {
  console.error("Socket.IO connection error:", err.req);
  console.error("Error code:", err.code);
  console.error("Error message:", err.message);
  console.error("Error context:", err.context);
});

// Log server events
io.on("connect_error", (error) => {
  console.error("Socket.IO server connect error:", error);
});

// Add middleware to log all connections
io.use((socket, next) => {
  console.log('Socket.IO middleware - New connection attempt from:', socket.handshake.address);
  console.log('Headers:', socket.handshake.headers);
  next();
});

// Export app, server and io for use in main server
export { io, app, server };
