import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

// Create a single Socket.IO instance with unified configuration
const io = new Server(server, {
	cors: {
		origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080", "https://your-production-url.com"],
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
		delete userSocketMap[userId];
		io.emit("getOnlineUsers", Object.keys(userSocketMap));
	});

	// Handle errors
	socket.on("error", (error) => {
		console.error("Socket error:", error);
	});
});

export { app, io, server };
