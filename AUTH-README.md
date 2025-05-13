# Authentication System Guide

This document outlines the authentication system implementation and provides detailed guidance on how the frontend should interact with it.

## Overview

The authentication system provides:

1. JWT-based authentication with tokens returned in response body
2. Refresh token mechanism for extending sessions
3. Consistent API responses for frontend integration
4. Secure password handling with bcrypt hashing

## Authentication Controllers

### Updated Signup Controller

```javascript
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
```

### Updated Login Controller

```javascript
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
```

### Updated Logout Controller

```javascript
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
```

### New Refresh Token Controller

```javascript
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
```

## Updated Routes

```javascript
import express from 'express';
import { signup, login, logout, refreshToken } from '../controllers/auth.controller.js';
const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);

export default router;
```

## Authentication Workflow

### Registration (Signup)
1. User submits username and password
2. Backend validates data
3. Backend creates user in database
4. Backend generates access token and refresh token
5. Backend returns tokens and user data in response
6. Backend also sets tokens as cookies for backward compatibility

### Login
1. User submits username and password
2. Backend verifies credentials
3. Backend generates access token and refresh token
4. Backend returns tokens and user data in response
5. Backend also sets tokens as cookies for backward compatibility

### Token Refresh
1. Frontend sends refresh token when access token expires
2. Backend verifies refresh token
3. Backend generates new access token and refresh token
4. Backend returns new tokens to frontend
5. Backend also sets new tokens as cookies

### Automatic Token Refresh
The system also includes an automatic token refresh mechanism:
1. When a protected route is accessed with an expired token
2. The refreshTokenMiddleware checks for a valid refresh token
3. If valid, new tokens are generated and included in the response headers
4. The protected route then proceeds with the new tokens

### Logout
1. Frontend removes tokens from local storage
2. Backend clears token cookies

## Authentication Middleware

### protectRoute Middleware
This middleware protects routes that require authentication:

1. Checks for authentication token in multiple locations:
   - Authorization header (Bearer token)
   - JWT cookie
2. Verifies the token using JWT_SECRET
3. Loads the user from the database
4. Attaches the user to the request object for use in route handlers
5. Provides detailed error messages for authentication failures

### refreshTokenMiddleware
This middleware handles automatic token refresh:

1. Can be used before protectRoute on routes that need authentication
2. Checks if the access token is expired but refresh token is valid
3. Issues new tokens if refresh is needed
4. Sets new tokens in cookies and response headers
5. Updates the Authorization header for downstream middleware

## JWT Structure

### Access Token
- Contains userId as payload
- Expires in 24 hours
- Used for API authorization

### Refresh Token
- Contains userId as payload
- Expires in 7 days
- Used to get new access tokens

## Frontend Integration Guide

This section provides detailed instructions on how the frontend should interact with the authentication API.

### Required API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Register a new user |
| `/api/auth/login` | POST | Authenticate a user |
| `/api/auth/refresh` | POST | Refresh authentication tokens |
| `/api/auth/logout` | POST | Logout a user |

### Frontend Implementation

#### Setting Up Axios

```javascript
import axios from 'axios';

// Create axios instance with baseURL
const API = axios.create({
  baseURL: 'http://your-api-url/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true // Important for CORS with credentials
});

// Add authorization header interceptor
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for token refresh
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried refreshing yet
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Get refresh token from storage
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          // Redirect to login if no refresh token
          window.location.href = '/login';
          return Promise.reject(error);
        }
        
        // Attempt to refresh the token
        const response = await axios.post('/api/auth/refresh', { 
          refreshToken 
        });
        
        // Store new tokens
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        
        // Update authorization header
        originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
        
        // Retry the original request
        return axios(originalRequest);
      } catch (refreshError) {
        // If refresh fails, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('chat-user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default API;
```

#### User Registration

```javascript
const registerUser = async (username, password) => {
  try {
    const response = await API.post('/auth/signup', {
      username,
      password
    });
    
    // Store tokens and user data
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    localStorage.setItem('chat-user', JSON.stringify(response.data.user));
    
    return response.data.user;
  } catch (error) {
    // Handle specific error cases
    if (error.response) {
      const errorMsg = error.response.data.error || 'Registration failed';
      throw new Error(errorMsg);
    }
    throw new Error('Unable to connect to server');
  }
};
```

#### User Login

```javascript
const loginUser = async (username, password) => {
  try {
    const response = await API.post('/auth/login', {
      username,
      password
    });
    
    // Store tokens and user data
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    localStorage.setItem('chat-user', JSON.stringify(response.data.user));
    
    return response.data.user;
  } catch (error) {
    // Handle specific error cases
    if (error.response) {
      const errorMsg = error.response.data.error || 'Login failed';
      throw new Error(errorMsg);
    }
    throw new Error('Unable to connect to server');
  }
};
```

#### User Logout

```javascript
const logoutUser = async () => {
  try {
    // Optional: notify the server
    await API.post('/auth/logout');
    
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('chat-user');
    
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear local storage even if server request fails
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('chat-user');
    
    return true;
  }
};
```

#### Getting Current User

```javascript
const getCurrentUser = () => {
  const userStr = localStorage.getItem('chat-user');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (e) {
    localStorage.removeItem('chat-user');
    return null;
  }
};
```

#### Making Authenticated API Calls

```javascript
// Example: Fetch user profile
const getUserProfile = async () => {
  try {
    const response = await API.get('/users/profile');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch profile:', error);
    throw error;
  }
};

// Example: Update user data
const updateUserProfile = async (userData) => {
  try {
    const response = await API.put('/users/profile', userData);
    return response.data;
  } catch (error) {
    console.error('Failed to update profile:', error);
    throw error;
  }
};
```

### Authentication State Management

For React applications, consider using context for auth state management:

```javascript
// AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Check for stored user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('chat-user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);
  
  // Register new user
  const register = async (username, password) => {
    const response = await API.post('/auth/signup', { username, password });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    localStorage.setItem('chat-user', JSON.stringify(response.data.user));
    setCurrentUser(response.data.user);
    return response.data.user;
  };
  
  // Login user
  const login = async (username, password) => {
    const response = await API.post('/auth/login', { username, password });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    localStorage.setItem('chat-user', JSON.stringify(response.data.user));
    setCurrentUser(response.data.user);
    return response.data.user;
  };
  
  // Logout user
  const logout = async () => {
    await API.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('chat-user');
    setCurrentUser(null);
  };
  
  const value = {
    currentUser,
    login,
    register,
    logout,
    loading
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
```

### Protected Routes Component

```javascript
// ProtectedRoute.js
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    // Show loading spinner while checking authentication
    return <div>Loading...</div>;
  }
  
  if (!currentUser) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" replace />;
  }
  
  // Render the protected content
  return <Outlet />;
};

export default ProtectedRoute;
```

### Using Protected Routes

```javascript
// App.js
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Other protected routes */}
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

## Security Considerations

1. All passwords are hashed using bcrypt
2. Tokens are signed with JWT_SECRET environment variable
3. Tokens have appropriate expiration times (24h for access, 7d for refresh)
4. Error messages are generic to prevent information leakage
5. Store tokens securely in localStorage (consider httpOnly cookies for production)
6. Implement CSRF protection for cookie-based auth
7. Always use HTTPS in production

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure the backend allows requests from your frontend origin and supports credentials
   ```
   Access to XMLHttpRequest has been blocked by CORS policy
   ```
   - Solution: Check CORS configuration on the server

2. **401 Unauthorized**: Token might be invalid or expired
   ```
   Unauthorized: Invalid token
   ```
   - Solution: Ensure token refresh logic is working correctly

3. **Invalid Token Format**: Check Authorization header format
   ```
   jwt malformed
   ```
   - Solution: Ensure token is being sent as `Bearer {token}`

4. **Token Missing From Requests**: Verify the interceptor is working
   - Solution: Check that localStorage has the token and the interceptor is adding it to headers

## Environment Variables Required

### Backend
```
JWT_SECRET=your_jwt_secret_key
```

### Frontend
```
REACT_APP_API_URL=http://localhost:5000/api
```

This authentication system provides a secure and robust way to handle user authentication while maintaining compatibility with frontend requirements.