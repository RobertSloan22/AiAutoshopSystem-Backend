import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Automotive AI Platform API',
      version: '1.0.0',
      description: 'API documentation for the Automotive AI Platform',
      contact: {
        name: 'API Support',
        email: 'support@automotiveai.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./routes/*.js'] // Path to the API routes
};

export const specs = swaggerJsdoc(options); 