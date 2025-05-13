import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import generateTokenAndSetCookie from "../utils/generateToken.js";
import jwt from "jsonwebtoken";

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
