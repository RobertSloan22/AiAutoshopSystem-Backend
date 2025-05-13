import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

/**
 * Middleware to check and handle token refresh
 * This middleware should be used before protectRoute on routes that need authentication
 */
const refreshTokenMiddleware = async (req, res, next) => {
  // Skip if we're in development mode with bypassed auth
  const bypassAuth = process.env.NODE_ENV === 'development' || process.env.BYPASS_AUTH === 'true';
  if (bypassAuth) {
    return next();
  }
  
  // Get the refresh token from request body, cookies, or header
  const refreshToken = 
    req.body.refreshToken || 
    (req.cookies && req.cookies.refreshToken) || 
    req.headers['x-refresh-token'];
  
  // No refresh token, proceed to normal authentication
  if (!refreshToken) {
    return next();
  }
  
  try {
    // Check for expired access token
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : req.cookies && req.cookies.jwt;
    
    // Attempt to verify the access token
    if (accessToken) {
      try {
        jwt.verify(accessToken, process.env.JWT_SECRET);
        // If no error, token is still valid, no need to refresh
        return next();
      } catch (tokenError) {
        // Only proceed with refresh if token is expired
        if (tokenError.name !== 'TokenExpiredError') {
          return next();
        }
        // If token is expired, we'll continue to refresh it
      }
    }
    
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(); // Let the protectRoute middleware handle this error
    }
    
    // Generate new tokens
    const newAccessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const newRefreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Set cookies for backward compatibility
    res.cookie("jwt", newAccessToken, {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV !== "development",
    });
    
    res.cookie("refreshToken", newRefreshToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV !== "development",
    });
    
    // Set new tokens in response headers
    res.setHeader('x-new-access-token', newAccessToken);
    res.setHeader('x-new-refresh-token', newRefreshToken);
    
    // Update authorization header for downstream middleware
    req.headers.authorization = `Bearer ${newAccessToken}`;
    
    // Continue to the next middleware
    next();
  } catch (error) {
    // If refresh token is invalid, just continue to normal auth flow
    // This will be handled by protectRoute middleware
    next();
  }
};

export default refreshTokenMiddleware;