# CORS Troubleshooting Guide

This document explains the CORS configuration changes made to fix authentication issues and provides guidance for future CORS-related problems.

## Issues Fixed

The main CORS issue was:

```
Access to XMLHttpRequest at 'https://eliza.ngrok.app/api/auth/signup' from origin 'https://noobtoolai.com' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*' when the request's credentials mode is 'include'.
```

This error occurs when:
1. The frontend is making a request with credentials (`withCredentials: true`)
2. The backend is responding with `Access-Control-Allow-Origin: *` (wildcard)

## Key Changes Made

### 1. Updated CORS Configuration

- Expanded allowed origins list to include all variations of domains (http/https, www/non-www)
- Added specific checks for noobtoolai.com and ngrok domains
- Added more wildcards for ngrok subdomains
- Configured CORS to always return the specific origin rather than a wildcard

### 2. Improved Preflight Handling

- Added proper handling of OPTIONS requests (preflight)
- Set Access-Control-Max-Age to reduce the number of preflight requests
- Ensured consistent response headers across all CORS handlers

### 3. Enhanced Proxy Middleware

- Updated proxy middleware to properly handle CORS headers for all responses
- Added more detailed logging for CORS-related requests and responses
- Ensured consistent CORS headers across all proxied routes

## Test Scenarios and Expected Results

When testing CORS with this configuration:

### 1. Frontend on noobtoolai.com → Backend on eliza.ngrok.app

- Preflight request: should return 200 OK with proper CORS headers
- Actual request: should succeed with proper CORS headers

### 2. Frontend on localhost → Backend on eliza.ngrok.app

- Should work with the same CORS configuration

### 3. Cross-origin requests with credentials

- Should now work properly as we're setting the specific origin in responses

## Common CORS Issues and Solutions

### Issue: "has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header"

**Solution:**
- Ensure the origin is in the allowedOrigins array
- Check if the CORS middleware is correctly applied
- Verify that preflight OPTIONS requests are being handled

### Issue: "has been blocked by CORS policy: The value of the 'Access-Control-Allow-Origin' header must not be '*' when credentials mode is 'include'"

**Solution:**
- Always set a specific origin value, never '*' when using credentials
- Example: `res.setHeader('Access-Control-Allow-Origin', origin);`
- Ensure 'Access-Control-Allow-Credentials' is set to 'true'

### Issue: "has been blocked by CORS policy: Request header field X-Custom-Header is not allowed"

**Solution:**
- Add the header to the 'Access-Control-Allow-Headers' list
- Ensure preflight OPTIONS requests are handled correctly

## Configuration Explanation

### Main CORS Middleware

```javascript
app.use(cors({
  origin: function(origin, callback) {
    // Allow specific origins or patterns based on your needs
    if (allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    // For development, you might allow all origins
    return callback(null, origin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
```

### Route-Specific CORS Handling

```javascript
app.use('/api/auth', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
```

## Production Recommendations

For production environments:

1. Restrict allowed origins to only those you trust
2. Add proper error handling for rejected CORS requests
3. Consider using a whitelist approach rather than allowing all origins
4. Audit and regularly review your CORS configuration

## Testing CORS

You can test your CORS setup with:

```javascript
fetch('https://your-api.com/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({ key: 'value' })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

## Additional Resources

- [MDN CORS Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS middleware](https://github.com/expressjs/cors)
- [CORS debugging in Chrome DevTools](https://developer.chrome.com/docs/devtools/network/reference/#filtering)