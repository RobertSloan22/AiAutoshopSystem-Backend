import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
	cors: {
		origin: "*", // In production, restrict to your frontend domain
		credentials: true,
		methods: ["GET", "POST"],
		allowedHeaders: ["Content-Type", "Authorization"]
	},
	path: '/socket.io/',
	transports: ['websocket', 'polling'],
	allowEIO3: true,
	pingTimeout: 60000,
	pingInterval: 25000,
	upgradeTimeout: 30000,
	maxHttpBufferSize: 1e8
});

const userSocketMap = {}; // {userId: socketId}

export const getReceiverSocketId = (receiverId) => {
	return userSocketMap[receiverId];
};

// Initialize main Socket.IO connection handling
io.on("connection", (socket) => {
	console.log("User connected:", socket.id);

	const userId = socket.handshake.query.userId;
	if (userId != "undefined") userSocketMap[userId] = socket.id;

	// Emit online users to all clients
	io.emit("getOnlineUsers", Object.keys(userSocketMap));

	// Emit connection status to the connected client
	socket.emit("connection_status", {
		status: "connected",
		userId: userId,
		socketId: socket.id,
		timestamp: new Date().toISOString()
	});

	// Handle realtime chat events
	socket.on("chat_message", (data) => {
		try {
			const { message, sessionId, receiverId } = data;

			// If there's a specific receiver, send only to them
			if (receiverId) {
				const receiverSocketId = getReceiverSocketId(receiverId);
				if (receiverSocketId) {
					io.to(receiverSocketId).emit("chat_message", {
						...data,
						timestamp: new Date().toISOString()
					});
					return;
				}
			}

			// Otherwise broadcast to the room if sessionId exists
			if (sessionId) {
				socket.to(sessionId).emit("chat_message", {
					...data,
					timestamp: new Date().toISOString()
				});
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
		}
	});

	// Handle research-specific events
	socket.on("vector-search", async (data) => {
		try {
			const { query, filters, limit } = data;
			// Handle vector search logic here
			socket.emit("vector-search-results", {
				success: true,
				results: [],
				totalResults: 0
			});
		} catch (error) {
			console.error("Vector search error:", error);
			socket.emit("vector-search-results", {
				success: false,
				error: error.message
			});
		}
	});

	// Handle disconnection
	socket.on("disconnect", () => {
		console.log("User disconnected:", socket.id);

		// Notify all clients that this user disconnected
		io.emit("user_disconnected", {
			userId,
			timestamp: new Date().toISOString()
		});

		delete userSocketMap[userId];
		io.emit("getOnlineUsers", Object.keys(userSocketMap));
	});

	// Handle errors
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

			if (receiverId) {
				const receiverSocketId = getReceiverSocketId(receiverId);
				if (receiverSocketId) {
					io.to(receiverSocketId).emit("webrtc_signal", {
						signal,
						sessionId,
						senderId: userId,
						timestamp: new Date().toISOString()
					});
				}
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
});

// Export app, server and io for use in server.js
export { io, app, server };
