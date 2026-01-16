const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  port: parseInt(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  
  // URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:3000/admin',
  webappUrl: process.env.WEBAPP_URL || 'http://localhost:8080',
  corsOrigins: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : ['http://localhost:8080', 'https://web.telegram.org'],
  
  // Telegram
  botToken: process.env.BOT_TOKEN,
  botUsername: process.env.BOT_USERNAME,
  botWebhookUrl: process.env.BOT_WEBHOOK_URL,
  
  // Database
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/geeze_bingo',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 100,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    }
  },
  
  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    keyPrefix: 'geeze:',
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  },
  
  // Game
  game: {
    minPlayers: parseInt(process.env.GAME_MIN_PLAYERS) || 2,
    maxPlayers: parseInt(process.env.GAME_MAX_PLAYERS) || 400,
    betAmount: parseInt(process.env.GAME_BET_AMOUNT) || 10,
    roundDuration: parseInt(process.env.GAME_ROUND_DURATION) || 30,
    countdown: parseInt(process.env.GAME_COUNTDOWN) || 10,
    prizePercentage: parseInt(process.env.GAME_PRIZE_PERCENTAGE) || 85,
    houseFee: parseInt(process.env.GAME_HOUSE_FEE) || 15,
    maxCards: parseInt(process.env.GAME_MAX_CARDS) || 400,
    autoStart: process.env.GAME_AUTO_START !== 'false'
  },
  
  // Payment
  payment: {
    minDeposit: parseInt(process.env.MIN_DEPOSIT) || 10,
    maxDeposit: parseInt(process.env.MAX_DEPOSIT) || 50000,
    minWithdrawal: parseInt(process.env.MIN_WITHDRAWAL) || 50,
    maxWithdrawal: parseInt(process.env.MAX_WITHDRAWAL) || 10000,
    withdrawalFee: parseInt(process.env.WITHDRAWAL_FEE) || 0,
    telebirrApiKey: process.env.TELEBIRR_API_KEY,
    telebirrMerchantId: process.env.TELEBIRR_MERCHANT_ID,
    telebirrSecretKey: process.env.TELEBIRR_SECRET_KEY
  },
  
  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_change_in_production',
    jwtExpiry: process.env.JWT_EXPIRY || '24h',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    encryptionKey: process.env.ENCRYPTION_KEY || 'default_32_byte_key_change_in_prod',
    sessionSecret: process.env.SESSION_SECRET || 'session_secret'
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log',
    errorFile: process.env.ERROR_LOG_FILE || 'logs/error.log',
    maxSize: '20m',
    maxFiles: '14d'
  }
};

// Validate required configuration
const requiredConfig = ['botToken', 'jwtSecret'];
requiredConfig.forEach(key => {
  if (!config[key] && config.isProduction) {
    throw new Error(`Missing required configuration: ${key}`);
  }
});

module.exports = config;
