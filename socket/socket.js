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

// Export app, server and io for use in server.js
export { io, app, server };
