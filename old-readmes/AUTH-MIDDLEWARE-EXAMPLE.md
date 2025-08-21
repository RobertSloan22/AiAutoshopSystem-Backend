# Authentication Middleware Usage Examples

This document provides examples of how to use the authentication middleware in your routes.

## Basic Usage

To protect a route so that only authenticated users can access it:

```javascript
import express from 'express';
import protectRoute from '../middleware/protectRoute.js';
import { getProfile, updateProfile } from '../controllers/user.controller.js';

const router = express.Router();

// Protected route - only authenticated users can access
router.get('/profile', protectRoute, getProfile);
router.put('/profile', protectRoute, updateProfile);

export default router;
```

## Using with Automatic Token Refresh

For routes where you want to enable automatic token refresh when tokens expire:

```javascript
import express from 'express';
import refreshTokenMiddleware from '../middleware/refreshTokenMiddleware.js';
import protectRoute from '../middleware/protectRoute.js';
import { getDashboardData } from '../controllers/dashboard.controller.js';

const router = express.Router();

// Apply both middlewares - refresh token first, then protect route
router.get('/dashboard', refreshTokenMiddleware, protectRoute, getDashboardData);

export default router;
```

## Accessing the Authenticated User

In your controller functions, you can access the authenticated user via the `req.user` object:

```javascript
export const getProfile = (req, res) => {
  // req.user contains the authenticated user from the database
  const { _id, username, email, profilePic } = req.user;
  
  res.status(200).json({
    _id,
    username,
    email,
    profilePic
  });
};
```

## Role-Based Access Control

You can create additional middleware to check for specific roles:

```javascript
// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin role required' });
  }
};

// Use in routes
router.get('/admin/dashboard', refreshTokenMiddleware, protectRoute, isAdmin, adminDashboard);
```

## Multiple Authentication Methods

For routes that should support multiple authentication methods:

```javascript
import express from 'express';
import refreshTokenMiddleware from '../middleware/refreshTokenMiddleware.js';
import protectRoute from '../middleware/protectRoute.js';
import apiKeyAuth from '../middleware/apiKeyAuth.js';

const router = express.Router();

// Try API key first, fall back to JWT auth if not present
router.get('/data', 
  (req, res, next) => {
    // Check for API key first
    if (req.headers['x-api-key']) {
      return apiKeyAuth(req, res, next);
    }
    // No API key, use JWT auth
    refreshTokenMiddleware(req, res, () => {
      protectRoute(req, res, next);
    });
  }, 
  getData
);
```

## Optional Authentication

For routes where authentication is optional:

```javascript
import express from 'express';
import refreshTokenMiddleware from '../middleware/refreshTokenMiddleware.js';

const router = express.Router();

// Try to authenticate, but proceed regardless
router.get('/products', 
  (req, res, next) => {
    // Try to refresh token and get user if possible
    const authHeader = req.headers.authorization;
    
    if (authHeader || (req.cookies && req.cookies.jwt)) {
      // Try to authenticate but continue with or without auth
      refreshTokenMiddleware(req, res, () => {
        try {
          protectRoute(req, res, () => next());
        } catch (e) {
          // Continue even if auth fails
          next();
        }
      });
    } else {
      // No auth tokens at all, just continue
      next();
    }
  }, 
  getProducts
);

// Then in the controller, handle both cases:
export const getProducts = (req, res) => {
  const isAuthenticated = !!req.user;
  
  // Maybe show different products or special pricing for authenticated users
  const products = getProductsForUser(isAuthenticated ? req.user : null);
  
  res.status(200).json(products);
};
```

## Refreshing Tokens Manually

For routes that explicitly handle token refresh:

```javascript
import express from 'express';
import { refreshToken } from '../controllers/auth.controller.js';

const router = express.Router();

// Route for explicitly refreshing a token
router.post('/auth/refresh', refreshToken);

export default router;
```