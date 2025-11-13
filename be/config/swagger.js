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
        url: process.env.SWAGGER_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
        description: process.env.SWAGGER_BASE_URL ? 'Deployed server' : 'Development server',
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
              description: 'Gmail address đang theo dõi',
            },
            webhookUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Webhook endpoint để nhận giao dịch (tùy chọn)',
            },
            isActive: {
              type: 'boolean',
              description: 'Cho biết Gmail này có đang nhận push notification hay không',
              default: true,
            },
            lastSyncedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Thời điểm Payhook xử lý email gần nhất',
            },
            watchHistoryId: {
              type: 'string',
              nullable: true,
              description: 'History ID được sử dụng cho Gmail users.watch',
            },
            watchExpiration: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Thời điểm push notification hết hạn (cần gia hạn ~7 ngày/lần)',
            },
            hasRefreshToken: {
              type: 'boolean',
              description: 'Chỉ báo cấu hình này còn refresh_token hợp lệ hay không',
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
        WebhookLog: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Webhook log ID',
            },
            webhookUrl: {
              type: 'string',
              format: 'uri',
              description: 'Webhook URL được gọi',
            },
            userId: {
              type: 'string',
              description: 'User ID',
            },
            userEmail: {
              type: 'string',
              format: 'email',
              description: 'Email của user',
            },
            emailConfigId: {
              type: 'string',
              description: 'Email config ID',
            },
            emailConfigEmail: {
              type: 'string',
              format: 'email',
              description: 'Email của config',
            },
            transactionDocId: {
              type: 'string',
              description: 'Transaction document ID',
            },
            transactionId: {
              type: 'string',
              description: 'Transaction ID từ ngân hàng',
            },
            status: {
              type: 'string',
              enum: ['pending', 'retrying', 'success', 'failed'],
              description: 'Trạng thái webhook',
            },
            attempts: {
              type: 'array',
              description: 'Danh sách các lần thử gửi webhook',
              items: {
                type: 'object',
                properties: {
                  attemptNumber: {
                    type: 'integer',
                  },
                  success: {
                    type: 'boolean',
                  },
                  statusCode: {
                    type: 'integer',
                  },
                  responseBody: {
                    type: 'object',
                  },
                  error: {
                    type: 'string',
                  },
                  durationMs: {
                    type: 'integer',
                  },
                  requestedAt: {
                    type: 'string',
                    format: 'date-time',
                  },
                  completedAt: {
                    type: 'string',
                    format: 'date-time',
                  },
                },
              },
            },
            finalStatusCode: {
              type: 'integer',
              description: 'HTTP status code cuối cùng',
            },
            finalError: {
              type: 'string',
              description: 'Lỗi cuối cùng (nếu có)',
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

