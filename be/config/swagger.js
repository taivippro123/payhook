const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Payhook API',
      version: '2.0.0',
      description: 'API documentation for Payhook - Email transaction monitoring system',
      contact: {
        name: 'Payhook API Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID',
            },
            username: {
              type: 'string',
              description: 'Username',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: 'User role',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        EmailConfig: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Config ID',
            },
            userId: {
              type: 'string',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Gmail address',
            },
            scanInterval: {
              type: 'integer',
              description: 'Scan interval in milliseconds',
              default: 30000,
            },
            isActive: {
              type: 'boolean',
              description: 'Whether monitoring is active',
              default: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Transaction: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Transaction ID',
            },
            userId: {
              type: 'string',
              description: 'User ID',
            },
            emailConfigId: {
              type: 'string',
              description: 'Email config ID',
            },
            bank: {
              type: 'string',
              description: 'Bank name',
              example: 'TPBank',
            },
            transactionId: {
              type: 'string',
              description: 'Bank transaction ID',
            },
            amountVND: {
              type: 'number',
              description: 'Transaction amount in VND',
            },
            description: {
              type: 'string',
              description: 'Transaction description',
            },
            detectedAt: {
              type: 'string',
              format: 'date-time',
              description: 'When transaction was detected',
            },
            executedAt: {
              type: 'string',
              description: 'When transaction was executed',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            message: {
              type: 'string',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js', './index.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;

