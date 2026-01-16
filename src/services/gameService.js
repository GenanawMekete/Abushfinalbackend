const Game = require('../models/Game');
const User = require('../models/User');
const walletService = require('./walletService');
const gameState = require('../engine/gameState');
const cardGenerator = require('../engine/cardGenerator');
const config = require('../config/env');

class GameService {
  async joinGame(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      
      if (user.balance < config.BET_AMOUNT) {
        return { success: false, message: 'Insufficient balance' };
      }
      
      // Deduct bet amount
      const deductResult = await walletService.deductForGame(userId, config.BET_AMOUNT);
      
      if (!deductResult.success) {
        return { success: false, message: deductResult.message };
      }
      
      // Update user stats
      user.totalGames += 1;
      user.totalWagered += config.BET_AMOUNT;
      await user.save();
      
      // Add player to current game
      const player = {
        user: user._id,
        username: user.username || user.firstName,
        userId: user.telegramId
      };
      
      const result = gameState.addPlayer(player);
      
      if (result.success) {
        // Start countdown if we have enough players
        if (gameState.activeGame.players.length >= config.MIN_PLAYERS) {
          if (!gameState.countdownInterval) {
            gameState.startCountdown();
          }
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('Join game error:', error);
      return {
        success: false,
        message: 'Failed to join game'
      };
    }
  }
  
  async saveGame(gameData) {
    try {
      const game = new Game({
        gameId: gameData.gameId,
        status: gameData.status,
        players: gameData.players.map(p => ({
          user: p.user,
          card: p.card,
          markedNumbers: p.markedNumbers,
          hasBingo: p.hasBingo,
          bingoAt: p.bingoAt,
          prizeAmount: p.prizeAmount
        })),
        drawnNumbers: gameData.drawnNumbers,
        totalPrizePool: gameData.totalPrizePool,
        winnerCount: gameData.winnerCount,
        startTime: gameData.startTime,
        endTime: gameData.endTime,
        scheduledStart: gameData.scheduledStart,
        roundDuration: gameData.roundDuration,
        betAmount: gameData.betAmount,
        winningPatterns: this.determineWinningPatterns(gameData)
      });
      
      await game.save();
      
      // Update user win stats
      await this.updateUserStats(game);
      
      return game;
      
    } catch (error) {
      console.error('Save game error:', error);
      throw error;
    }
  }
  
  determineWinningPatterns(gameData) {
    const patterns = new Set();
    
    gameData.players.forEach(player => {
      if (player.hasBingo) {
        // Determine which patterns were achieved
        // This would require checking the actual marked numbers
        patterns.add('bingo');
      }
    });
    
    return Array.from(patterns);
  }
  
  async updateUserStats(game) {
    for (const player of game.players) {
      const updateData = {
        lastActive: new Date()
      };
      
      if (player.hasBingo) {
        updateData.totalWins = 1;
      }
      
      await User.findByIdAndUpdate(
        player.user,
        { $inc: updateData }
      );
    }
  }
  
  async getActiveGame() {
    return Game.findOne({ status: 'active' })
      .populate('players.user', 'username telegramId')
      .sort({ createdAt: -1 });
  }
  
  async getGameHistory(limit = 10) {
    return Game.find({ status: 'completed' })
      .populate('players.user', 'username telegramId')
      .sort({ createdAt: -1 })
      .limit(limit);
  }
  
  async getUserGames(userId, limit = 10) {
    return Game.find({
      'players.user': userId,
      status: 'completed'
    })
    .sort({ createdAt: -1 })
    .limit(limit);
  }
  
  async cancelInactiveGames() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
    
    const games = await Game.find({
      status: 'waiting',
      createdAt: { $lt: cutoff }
    });
    
    for (const game of games) {
      game.status = 'cancelled';
      await game.save();
      
      // Refund players
      for (const player of game.players) {
        await walletService.updateBalance(
          player.user,
          game.betAmount,
          'game_refund'
        );
      }
    }
    
    return games.length;
  }
}

module.exports = new GameService();
