const cron = require('node-cron');
const gameState = require('../engine/gameState');
const gameService = require('../services/gameService');
const logger = require('../utils/logger');
const config = require('../config/env');

class RoundScheduler {
  constructor() {
    this.isRunning = false;
  }
  
  start() {
    if (this.isRunning) return;
    
    // Schedule game every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      await this.startNewRound();
    });
    
    // Cleanup expired deposits every hour
    cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredDeposits();
    });
    
    // Cancel inactive games every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await this.cancelInactiveGames();
    });
    
    logger.info('Round scheduler started');
    this.isRunning = true;
  }
  
  async startNewRound() {
    try {
      // Check if there's already an active game
      if (gameState.activeGame && gameState.activeGame.status === 'active') {
        return;
      }
      
      // Check if there are enough players waiting
      if (!gameState.activeGame || gameState.activeGame.players.length < config.MIN_PLAYERS) {
        // Not enough players, wait for more
        return;
      }
      
      // Start the game
      if (gameState.activeGame.status === 'waiting') {
        gameState.startGame();
        logger.info(`Game ${gameState.activeGame.gameId} started with ${gameState.activeGame.players.length} players`);
      }
      
    } catch (error) {
      logger.error('Start new round error:', error);
    }
  }
  
  async cleanupExpiredDeposits() {
    try {
      const expiredCount = await depositService.expireOldDeposits();
      if (expiredCount > 0) {
        logger.info(`Cleaned up ${expiredCount} expired deposits`);
      }
    } catch (error) {
      logger.error('Cleanup expired deposits error:', error);
    }
  }
  
  async cancelInactiveGames() {
    try {
      const cancelledCount = await gameService.cancelInactiveGames();
      if (cancelledCount > 0) {
        logger.info(`Cancelled ${cancelledCount} inactive games`);
      }
    } catch (error) {
      logger.error('Cancel inactive games error:', error);
    }
  }
  
  stop() {
    this.isRunning = false;
    logger.info('Round scheduler stopped');
  }
}

module.exports = new RoundScheduler();
