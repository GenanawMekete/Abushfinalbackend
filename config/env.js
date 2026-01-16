require('dotenv').config();

module.exports = {
  // Bot
  BOT_TOKEN: process.env.BOT_TOKEN,
  BOT_WEBHOOK_URL: process.env.BOT_WEBHOOK_URL,
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/bingo_bot',
  
  // Game
  BET_AMOUNT: parseInt(process.env.BET_AMOUNT) || 10,
  MIN_PLAYERS: parseInt(process.env.MIN_PLAYERS) || 2,
  MAX_PLAYERS: parseInt(process.env.MAX_PLAYERS) || 50,
  ROUND_DURATION: parseInt(process.env.ROUND_DURATION) || 30,
  BINGO_CARD_SIZE: parseInt(process.env.BINGO_CARD_SIZE) || 5,
  PRIZE_PERCENTAGE: parseFloat(process.env.PRIZE_PERCENTAGE) || 85,
  
  // Admin
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  JWT_SECRET: process.env.JWT_SECRET || 'default_secret',
  
  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development'
};
