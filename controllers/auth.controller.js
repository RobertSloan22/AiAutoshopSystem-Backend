import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import generateTokenAndSetCookie from "../utils/generateToken.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const signup = async (req, res) => {
	try {
		const { username, password, confirmPassword } = req.body;

		// Only check confirmPassword if it was provided
		if (confirmPassword && password !== confirmPassword) {
			return res.status(400).json({ error: "Passwords don't match" });
		}

		if (!username || !password) {
			return res.status(400).json({ error: "Username and password are required" });
		}

		const user = await User.findOne({ username });

		if (user) {
			return res.status(400).json({ error: "Username already exists" });
		}

		// HASH PASSWORD HERE
		const salt = await bcrypt.genSalt(10);
		const hashedPassword = await bcrypt.hash(password, salt);

		const newUser = new User({
			username,
			password: hashedPassword,
		});

		if (newUser) {
			await newUser.save();
			
			// Generate token
			const token = jwt.sign(
				{ userId: newUser._id },
				process.env.JWT_SECRET,
				{ expiresIn: '24h' }
			);
			
			// Generate refresh token
			const refreshToken = jwt.sign(
				{ userId: newUser._id },
				process.env.JWT_SECRET,
				{ expiresIn: '7d' }
			);
			
			// Also set as cookie for backward compatibility
			generateTokenAndSetCookie(newUser._id, res);

			res.status(201).json({
				token,
				refreshToken,
				user: {
					_id: newUser._id,
					username: newUser.username,
				}
			});
		} else {
			res.status(400).json({ error: "Invalid user data" });
		}
	} catch (error) {
		console.log("Error in signup controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const login = async (req, res) => {
	try {
		const { username, password } = req.body;
		
		if (!username || !password) {
			return res.status(400).json({ error: "All fields are required" });
		}

		const user = await User.findOne({ username });
		if (!user) {
			return res.status(401).json({ error: "Invalid username or password" });
		}

		const isPasswordCorrect = await bcrypt.compare(password, user.password);
		if (!isPasswordCorrect) {
			return res.status(401).json({ error: "Invalid username or password" });
		}

		// Generate token for JSON response
		const token = jwt.sign(
			{ userId: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: '24h' }
		);
		
		// Generate refresh token
		const refreshToken = jwt.sign(
			{ userId: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: '7d' }
		);
		
		// Also set as cookie for backward compatibility
		generateTokenAndSetCookie(user._id, res);

		res.status(200).json({
			token,
			refreshToken,
			user: {
				_id: user._id,
				username: user.username,
			}
		});
	} catch (error) {
		console.error("Error in login controller:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const logout = (req, res) => {
	try {
		// For cookie-based auth, clear the cookie
		res.cookie("jwt", "", {
			maxAge: 0,
			httpOnly: true,
		});
		
		res.status(200).json({ message: "Logged out successfully" });
	} catch (error) {
		console.log("Error in logout controller", error.message);
		res.status(500).json({ error: "Internal Server Error" });
	}
};

export const refreshToken = async (req, res) => {
	try {
		const { refreshToken } = req.body;
		
		if (!refreshToken) {
			return res.status(400).json({ error: "Refresh token is required" });
		}
		
		// Verify the refresh token (using the same JWT_SECRET for now)
		// In a production app, you might want to use a separate secret for refresh tokens
		const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
		
		// Find the user
		const user = await User.findById(decoded.userId);
		if (!user) {
			return res.status(401).json({ error: "User not found" });
		}
		
		// Generate new tokens
		const newToken = jwt.sign(
			{ userId: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: '24h' }
		);
		
		// Generate new refresh token (with longer expiration)
		const newRefreshToken = jwt.sign(
			{ userId: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: '7d' }
		);
		
		// Also update cookie for backward compatibility
		generateTokenAndSetCookie(user._id, res);
		
		res.status(200).json({
			token: newToken,
			refreshToken: newRefreshToken
		});
	} catch (error) {
		console.error("Error in refresh token controller:", error);
		if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
			return res.status(401).json({ error: "Invalid or expired refresh token" });
		}
		res.status(500).json({ error: "Internal Server Error" });
	}
};

// Google OAuth verification
async function verifyGoogleToken(token) {
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: token,
			audience: process.env.GOOGLE_CLIENT_ID,
		});
		
		const payload = ticket.getPayload();
		
		if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
			throw new Error('Invalid audience');
		}
		
		if (payload.exp * 1000 < Date.now()) {
			throw new Error('Token expired');
		}
		
		return {
			googleId: payload.sub,
			email: payload.email,
			name: payload.name,
			picture: payload.picture,
			emailVerified: payload.email_verified,
		};
	} catch (error) {
		console.error('Google token verification failed:', error);
		throw new Error('Invalid Google token');
	}
}

export const googleAuth = async (req, res) => {
	try {
		const { token } = req.body;
		
		if (!token) {
			return res.status(400).json({ 
				success: false, 
				error: 'Google token is required' 
			});
		}
		
		// Verify the Google token
		const googleUser = await verifyGoogleToken(token);
		
		// Check if user exists with Google ID
		let user = await User.findOne({ googleId: googleUser.googleId });
		
		if (!user) {
			// Check if user exists with same email (account linking)
			const existingUser = await User.findOne({ email: googleUser.email });
			
			if (existingUser) {
				// Link Google account to existing user
				existingUser.googleId = googleUser.googleId;
				existingUser.profilePic = googleUser.picture || existingUser.profilePic;
				existingUser.emailVerified = googleUser.emailVerified || existingUser.emailVerified;
				existingUser.authProvider = 'google';
				existingUser.lastLoginAt = new Date();
				user = await existingUser.save();
			} else {
				// Create new user
				user = new User({
					googleId: googleUser.googleId,
					email: googleUser.email,
					fullName: googleUser.name,
					profilePic: googleUser.picture,
					emailVerified: googleUser.emailVerified,
					authProvider: 'google',
					lastLoginAt: new Date(),
				});
				await user.save();
			}
		} else {
			// Update last login time and picture
			user.lastLoginAt = new Date();
			user.profilePic = googleUser.picture || user.profilePic;
			await user.save();
		}
		
		// Generate app tokens
		const appToken = jwt.sign(
			{ userId: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: '24h' }
		);
		
		const refreshToken = jwt.sign(
			{ userId: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: '7d' }
		);
		
		// Set cookie for backward compatibility
		generateTokenAndSetCookie(user._id, res);
		
		res.json({
			success: true,
			token: appToken,
			refreshToken,
			user: {
				_id: user._id,
				email: user.email,
				fullName: user.fullName,
				profilePic: user.profilePic,
				emailVerified: user.emailVerified,
				authProvider: user.authProvider,
			}
		});
		
	} catch (error) {
		console.error('Google auth verification error:', error);
		res.status(400).json({
			success: false,
			error: error.message || 'Authentication failed'
		});
	}
};

export const verifyToken = async (req, res) => {
	try {
		const authHeader = req.headers['authorization'];
		const token = authHeader && authHeader.split(' ')[1];
		
		if (!token) {
			return res.status(401).json({ error: 'Access token required' });
		}
		
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.userId).select('-password');
		
		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}
		
		res.json({
			success: true,
			user: {
				_id: user._id,
				email: user.email,
				username: user.username,
				fullName: user.fullName,
				profilePic: user.profilePic,
				emailVerified: user.emailVerified,
				authProvider: user.authProvider,
			}
		});
	} catch (error) {
		console.error('Token verification error:', error);
		if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
			return res.status(403).json({ error: 'Invalid or expired token' });
		}
		res.status(500).json({ error: 'Internal server error' });
	}
};
