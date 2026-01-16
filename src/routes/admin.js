const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Game = require('../models/Game');
const Deposit = require('../models/Deposit');
const Withdraw = require('../models/Withdraw');
const depositService = require('../services/depositService');
const withdrawService = require('../services/withdrawService');
const adminAuth = require('../middleware/adminAuth');
const config = require('../config/env');

// Admin login
router.post('/login', async (req, res) => {
  const { password } = req.body;
  
  if (password === config.ADMIN_PASSWORD) {
    const token = jwt.sign(
      { admin: true, timestamp: Date.now() },
      config.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Protected routes
router.use(adminAuth);

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      activeGames,
      totalDeposits,
      totalWithdrawals,
      pendingDeposits,
      pendingWithdrawals,
      recentGames
    ] = await Promise.all([
      User.countDocuments(),
      Game.countDocuments({ status: 'active' }),
      Deposit.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Withdraw.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Deposit.countDocuments({ status: 'pending' }),
      Withdraw.countDocuments({ status: 'pending' }),
      Game.find({ status: 'completed' })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('players.user', 'username')
    ]);
    
    res.json({
      totalUsers,
      activeGames,
      totalDeposits: totalDeposits[0]?.total || 0,
      totalWithdrawals: totalWithdrawals[0]?.total || 0,
      pendingDeposits,
      pendingWithdrawals,
      recentGames: recentGames.map(game => ({
        gameId: game.gameId,
        players: game.players.length,
        winners: game.players.filter(p => p.hasBingo).length,
        totalPrizePool: game.totalPrizePool,
        date: game.createdAt
      }))
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Users
router.get('/users', async (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  
  try {
    const query = search ? {
      $or: [
        { telegramId: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } }
      ]
    } : {};
    
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Pending deposits
router.get('/deposits/pending', async (req, res) => {
  try {
    const deposits = await depositService.getPendingDeposits();
    res.json(deposits);
  } catch (error) {
    console.error('Get pending deposits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify deposit
router.post('/deposits/:id/verify', async (req, res) => {
  try {
    const result = await depositService.verifyDeposit(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Verify deposit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Pending withdrawals
router.get('/withdrawals/pending', async (req, res) => {
  try {
    const withdrawals = await withdrawService.getPendingWithdrawals();
    res.json(withdrawals);
  } catch (error) {
    console.error('Get pending withdrawals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process withdrawal
router.post('/withdrawals/:id/process', async (req, res) => {
  try {
    const { notes } = req.body;
    const result = await withdrawService.processWithdrawal(
      req.params.id,
      req.adminId,
      notes
    );
    res.json(result);
  } catch (error) {
    console.error('Process withdrawal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject withdrawal
router.post('/withdrawals/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await withdrawService.rejectWithdrawal(
      req.params.id,
      reason,
      req.adminId
    );
    res.json(result);
  } catch (error) {
    console.error('Reject withdrawal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Games history
router.get('/games', async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  
  try {
    const query = status ? { status } : {};
    
    const games = await Game.find(query)
      .populate('players.user', 'username telegramId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Game.countDocuments(query);
    
    res.json({
      games,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user balance
router.post('/users/:id/balance', async (req, res) => {
  try {
    const { amount, reason } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.balance += parseFloat(amount);
    await user.save();
    
    // Log the adjustment
    console.log(`Admin ${req.adminId} adjusted balance for user ${user._id}: ${amount} ETB. Reason: ${reason}`);
    
    res.json({
      success: true,
      newBalance: user.balance,
      message: 'Balance updated successfully'
    });
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
