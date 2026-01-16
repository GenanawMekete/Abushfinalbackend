const config = require('../config');
const logger = require('../utils/logger');

class WebAppHandler {
  constructor(bot, gameEngine) {
    this.bot = bot;
    this.gameEngine = gameEngine;
    this.webappUrl = config.webappUrl;
  }
  
  initialize() {
    this.setupCommands();
    this.setupInlineButtons();
    logger.info('WebApp handler initialized');
  }
  
  setupCommands() {
    // /app command to launch web app
    this.bot.onText(/\/app|start/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendWebAppButton(chatId);
    });
    
    // /play command
    this.bot.onText(/\/play/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendPlayOptions(chatId);
    });
  }
  
  async sendWebAppButton(chatId) {
    const welcomeMessage = `🎮 *Welcome to Abush Bingo!* 🎮\n\n` +
      `Experience the ultimate bingo gaming with our interactive Web App!\n\n` +
      `✨ *Features:*\n` +
      `• Real-time multiplayer games\n` +
      `• Interactive bingo cards\n` +
      `• Instant prize distribution\n` +
      `• Secure payments\n` +
      `• Live game statistics\n\n` +
      `Click the button below to start the game:`;
    
    const options = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🎮 START GAME',
            web_app: { url: this.webappUrl }
          }
        ]]
      }
    };
    
    await this.bot.sendMessage(chatId, welcomeMessage, options);
  }
  
  async sendPlayOptions(chatId) {
    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🎮 Play Now',
              web_app: { url: `${this.webappUrl}?action=quickplay` }
            }
          ],
          [
            {
              text: '💰 Check Balance',
              callback_data: 'check_balance'
            },
            {
              text: '📊 Game Stats',
              callback_data: 'game_stats'
            }
          ],
          [
            {
              text: '📱 Select Card',
              web_app: { url: `${this.webappUrl}?action=selectcard` }
            }
          ]
        ]
      }
    };
    
    const message = `🎲 *Bingo Game Options*\n\n` +
      `Choose how you want to play:\n\n` +
      `• *Quick Play* - Join the next available game\n` +
      `• *Select Card* - Choose your preferred card (1-400)\n` +
      `• *Check Balance* - View your wallet\n` +
      `• *Game Stats* - See your game history`;
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      ...options
    });
  }
  
  async handleWebAppData(webAppData) {
    try {
      const data = JSON.parse(webAppData);
      
      switch (data.action) {
        case 'join_game':
          return await this.handleJoinGame(data);
        case 'select_card':
          return await this.handleSelectCard(data);
        case 'claim_bingo':
          return await this.handleClaimBingo(data);
        case 'deposit':
          return await this.handleDeposit(data);
        case 'withdraw':
          return await this.handleWithdraw(data);
        default:
          return { success: false, message: 'Unknown action' };
      }
    } catch (error) {
      logger.error('WebApp data handling error:', error);
      return { success: false, message: 'Invalid data format' };
    }
  }
  
  async handleJoinGame(data) {
    const { userId, betAmount = 10 } = data;
    
    try {
      // Find or create game
      const game = await this.gameEngine.joinGame(userId, betAmount);
      
      return {
        success: true,
        gameId: game.gameId,
        playerCount: game.players.length,
        totalPrizePool: game.totalPrizePool,
        message: 'Successfully joined game'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  async handleSelectCard(data) {
    const { userId, gameId, cardNumber } = data;
    
    try {
      // Check if card is available
      const isAvailable = await this.gameEngine.checkCardAvailability(gameId, cardNumber);
      
      if (!isAvailable) {
        return {
          success: false,
          message: 'Card already taken'
        };
      }
      
      // Assign card to user
      const card = await this.gameEngine.assignCard(userId, gameId, cardNumber);
      
      return {
        success: true,
        cardNumber,
        card: card,
        message: 'Card selected successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  async sendGameUpdate(chatId, update) {
    const message = this.formatGameUpdate(update);
    
    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  }
  
  formatGameUpdate(update) {
    switch (update.type) {
      case 'game_started':
        return `🎮 <b>Game Started!</b>\n\n` +
               `Game ID: <code>${update.gameId}</code>\n` +
               `Players: ${update.playerCount}\n` +
               `Prize Pool: ${update.totalPrizePool} ETB\n` +
               `Duration: ${update.duration} seconds`;
               
      case 'number_drawn':
        return `🔢 <b>Number Drawn:</b> ${update.letter}-${update.number}\n\n` +
               `Total drawn: ${update.totalDrawn}\n` +
               `Remaining: ${75 - update.totalDrawn}`;
               
      case 'bingo':
        return `🎉 <b>BINGO!</b> 🎉\n\n` +
               `Player: @${update.username}\n` +
               `Prize: ${update.prizeAmount} ETB\n` +
               `Card: #${update.cardNumber}`;
               
      case 'game_ended':
        return `🏁 <b>Game Ended!</b>\n\n` +
               `Winners: ${update.winnerCount}\n` +
               `Total Prize: ${update.totalPrizePool} ETB\n` +
               `Next game in 30 seconds!`;
               
      default:
        return JSON.stringify(update);
    }
  }
}

module.exports = WebAppHandler;
