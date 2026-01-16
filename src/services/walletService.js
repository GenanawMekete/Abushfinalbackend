const User = require('../models/User');
const Game = require('../models/Game');

class WalletService {
  async updateBalance(userId, amount, transactionType = 'game') {
    const session = await User.startSession();
    
    try {
      session.startTransaction();
      
      const user = await User.findById(userId).session(session);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if enough balance for withdrawal
      if (amount < 0 && Math.abs(amount) > user.balance) {
        throw new Error('Insufficient balance');
      }
      
      const newBalance = user.balance + amount;
      
      // Update balance
      user.balance = newBalance;
      await user.save({ session });
      
      // Log transaction
      await this.logTransaction(userId, amount, transactionType, session);
      
      await session.commitTransaction();
      
      return {
        success: true,
        newBalance,
        message: amount >= 0 ? 
          `Added ${amount} ETB to balance` : 
          `Deducted ${Math.abs(amount)} ETB from balance`
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('Update balance error:', error);
      
      return {
        success: false,
        message: error.message || 'Failed to update balance'
      };
    } finally {
      session.endSession();
    }
  }
  
  async deductForGame(userId, betAmount) {
    return this.updateBalance(userId, -betAmount, 'game_bet');
  }
  
  async addWinnings(userId, amount) {
    const result = await this.updateBalance(userId, amount, 'game_win');
    
    if (result.success) {
      // Update user stats
      await User.findByIdAndUpdate(userId, {
        $inc: { totalWins: 1 }
      });
    }
    
    return result;
  }
  
  async logTransaction(userId, amount, type, session = null) {
    // Implement transaction logging
    // You can create a Transaction model if needed
    console.log(`Transaction: User ${userId}, ${type}, ${amount} ETB`);
  }
  
  async getUserBalance(userId) {
    const user = await User.findById(userId);
    return user ? user.balance : 0;
  }
  
  async getTransactionHistory(userId, limit = 10) {
    // Return recent transactions
    // This would query a Transaction model
    return [];
  }
}

module.exports = new WalletService();
