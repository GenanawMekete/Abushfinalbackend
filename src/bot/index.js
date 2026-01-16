const TelegramBot = require('node-telegram-bot-api');
const config = require('../config/env');
const logger = require('../utils/logger');
const commands = require('./commands');
const callbacks = require('./callbacks');
const messages = require('./messages');

class BingoBot {
  constructor() {
    this.bot = new TelegramBot(config.BOT_TOKEN, {
      polling: config.NODE_ENV === 'development',
      webHook: config.NODE_ENV === 'production'
    });
    
    this.setupHandlers();
  }
  
  setupHandlers() {
    // Commands
    this.bot.onText(/\/start(?:\s+(.+))?/, commands.start.bind(this));
    this.bot.onText(/\/play/, commands.play.bind(this));
    this.bot.onText(/\/balance/, commands.balance.bind(this));
    this.bot.onText(/\/deposit/, commands.deposit.bind(this));
    this.bot.onText(/\/withdraw/, commands.withdraw.bind(this));
    this.bot.onText(/\/history/, commands.history.bind(this));
    this.bot.onText(/\/help/, commands.help.bind(this));
    this.bot.onText(/\/referral/, commands.referral.bind(this));
    
    // Callback queries (inline keyboard)
    this.bot.on('callback_query', callbacks.handleCallbackQuery.bind(this));
    
    // Messages (for SMS parsing)
    this.bot.on('message', messages.handleMessage.bind(this));
    
    // Error handling
    this.bot.on('polling_error', (error) => {
      logger.error('Polling error:', error);
    });
    
    this.bot.on('webhook_error', (error) => {
      logger.error('Webhook error:', error);
    });
  }
  
  async setWebhook() {
    if (config.NODE_ENV === 'production') {
      try {
        await this.bot.setWebHook(`${config.BOT_WEBHOOK_URL}/bot${config.BOT_TOKEN}`);
        logger.info('Webhook set successfully');
      } catch (error) {
        logger.error('Failed to set webhook:', error);
      }
    }
  }
  
  getBot() {
    return this.bot;
  }
}

module.exports = new BingoBot();
