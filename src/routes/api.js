const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const User = require('../models/User');
const gameService = require('../services/gameService');

// Get current game status
router.get('/game/status', async (req, res) => {
  try {
    const game = await gameService.getActiveGame();
    
    if (!game) {
      return res.json({
        status: 'waiting',
        message: 'No active game'
      });
    }
    
    res.json({
      gameId: game.gameId,
      status: game.status,
      players: game.players.length,
      drawnNumbers: game.drawnNumbers,
      totalPrizePool: game.totalPrizePool,
      startTime: game.startTime,
      endTime: game.endTime
    });
  } catch (error) {
    console.error('Get game status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent games
router.get('/games/recent', async (req, res) => {
  try {
    const games = await gameService.getGameHistory(10);
    
    res.json(games.map(game => ({
      gameId: game.gameId,
      status: game.status,
      players: game.players.length,
      winners: game.players.filter(p => p.hasBingo).length,
      totalPrizePool: game.totalPrizePool,
      createdAt: game.createdAt
    })));
  } catch (error) {
    console.error('Get recent games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user stats
router.get('/user/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.params.telegramId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const games = await gameService.getUserGames(user._id, 5);
    
    res.json({
      telegramId: user.telegramId,
      username: user.username,
      balance: user.balance,
      totalWins: user.totalWins,
      totalGames: user.totalGames,
      totalWagered: user.totalWagered,
      referralCode: user.referralCode,
      recentGames: games.map(game => ({
        gameId: game.gameId,
        result: game.players.find(p => p.user.equals(user._id))?.hasBingo ? 'won' : 'lost',
        prize: game.players.find(p => p.user.equals(user._id))?.prizeAmount || 0,
        date: game.createdAt
      }))
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public stats
router.get('/stats', async (req, res) => {
  try {
    const totalGames = await Game.countDocuments({ status: 'completed' });
    const totalPlayers = await User.countDocuments();
    const totalWagered = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalWagered' } } }
    ]);
    const recentWinners = await Game.aggregate([
      { $match: { status: 'completed', 'players.hasBingo': true } },
      { $unwind: '$players' },
      { $match: { 'players.hasBingo': true } },
      { $lookup: {
          from: 'users',
          localField: 'players.user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: '$userInfo' },
      { $sort: { 'players.bingoAt': -1 } },
      { $limit: 5 },
      { $project: {
          gameId: 1,
          username: '$userInfo.username',
          prizeAmount: '$players.prizeAmount',
          date: '$players.bingoAt'
        }
      }
    ]);
    
    res.json({
      totalGames,
      totalPlayers,
      totalWagered: totalWagered[0]?.total || 0,
      recentWinners,
      currentPrizePool: gameState.activeGame?.totalPrizePool || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
