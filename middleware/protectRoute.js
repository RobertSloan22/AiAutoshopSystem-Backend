import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const protectRoute = async (req, res, next) => {
	// Check if we're in development mode or if authentication should be bypassed
	const bypassAuth = process.env.NODE_ENV === 'development' || process.env.BYPASS_AUTH === 'true';
	
	// If we're bypassing auth, create a mock user and proceed
	if (bypassAuth) {
		console.log('🛠️ DEVELOPMENT MODE: Authentication bypassed');
		
		// Create a mock user object with admin privileges
		req.user = {
			_id: '000000000000000000000000', // Mock ObjectId
			username: 'devuser',
			email: 'dev@example.com',
			role: 'admin',
			// Add any other user properties your app expects
		};
		
		return next();
	}
	
	// Normal authentication logic for production
	try {
		// Try to get token from multiple sources
		let token;
		
		// 1. Check Authorization header (Bearer token)
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			token = authHeader.split(' ')[1];
		}
		
		// 2. If no token in Authorization header, check cookies
		if (!token && req.cookies && req.cookies.jwt) {
			token = req.cookies.jwt;
		}
		
		// No token found in any location
		if (!token) {
			return res.status(401).json({ 
				message: 'Authentication failed: No token provided',
				details: 'Please provide a valid JWT token either in the Authorization header or as a jwt cookie'
			});
		}

		// Verify the token
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		
		// Get user from database
		const user = await User.findById(decoded.userId);
		if (!user) {
			return res.status(401).json({ message: 'User not found' });
		}

		// Set user in request object
		req.user = user;
		next();
	} catch (error) {
		// Create a more detailed error message for debugging
		let errorMessage;
		let statusCode = 401;
		
		switch(error.name) {
			case 'JsonWebTokenError':
				errorMessage = 'Invalid token format';
				break;
			case 'TokenExpiredError':
				errorMessage = 'Token has expired';
				break;
			case 'NotBeforeError':
				errorMessage = 'Token not yet active';
				break;
			default:
				errorMessage = 'Authentication error: ' + error.message;
				// For unexpected errors, use 500 status
				if (!error.name.includes('Token') && !error.name.includes('JWT')) {
					statusCode = 500;
				}
		}
		
		// Add debug info in development
		const details = process.env.NODE_ENV === 'development' 
			? { error: error.name, stack: error.stack }
			: undefined;
				
		res.status(statusCode).json({ 
			message: errorMessage,
			details
		});
	}
};

export default protectRoute;
