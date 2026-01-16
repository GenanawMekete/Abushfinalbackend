const Withdraw = require('../models/Withdraw');
const User = require('../models/User');
const walletService = require('./walletService');

class WithdrawService {
  async createWithdrawal(userId, amount, phoneNumber) {
    const session = await User.startSession();
    
    try {
      session.startTransaction();
      
      const user = await User.findById(userId).session(session);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Validate amount
      if (amount < config.withdrawal.minAmount) {
        throw new Error(`Minimum withdrawal is ${config.withdrawal.minAmount} ETB`);
      }
      
      if (amount > config.withdrawal.maxAmount) {
        throw new Error(`Maximum withdrawal is ${config.withdrawal.maxAmount} ETB`);
      }
      
      if (amount > user.balance) {
        throw new Error('Insufficient balance');
      }
      
      // Check daily limit
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const todayWithdrawals = await Withdraw.aggregate([
        {
          $match: {
            user: user._id,
            status: { $in: ['completed', 'processing'] },
            createdAt: { $gte: todayStart }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]).session(session);
      
      const todayTotal = todayWithdrawals[0]?.total || 0;
      
      if (todayTotal + amount > config.withdrawal.dailyLimit) {
        throw new Error(`Daily withdrawal limit exceeded. Remaining: ${config.withdrawal.dailyLimit - todayTotal} ETB`);
      }
      
      // Deduct balance
      const deductResult = await walletService.updateBalance(
        userId,
        -amount,
        'withdrawal'
      );
      
      if (!deductResult.success) {
        throw new Error(deductResult.message);
      }
      
      // Create withdrawal record
      const withdrawal = new Withdraw({
        user: userId,
        amount,
        phoneNumber,
        status: 'pending'
      });
      
      await withdrawal.save({ session });
      
      await session.commitTransaction();
      
      return {
        success: true,
        withdrawal,
        message: 'Withdrawal request submitted'
      };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('Create withdrawal error:', error);
      
      return {
        success: false,
        message: error.message || 'Failed to create withdrawal'
      };
    } finally {
      session.endSession();
    }
  }
  
  async processWithdrawal(withdrawalId, adminId, notes = '') {
    try {
      const withdrawal = await Withdraw.findById(withdrawalId);
      
      if (!withdrawal) {
        return { success: false, message: 'Withdrawal not found' };
      }
      
      if (withdrawal.status !== 'pending') {
        return { success: false, message: 'Withdrawal already processed' };
      }
      
      // Mark as processing
      withdrawal.status = 'processing';
      withdrawal.adminNotes = notes;
      withdrawal.processedAt = new Date();
      await withdrawal.save();
      
      // TODO: Integrate with payment gateway (Telebirr API)
      // const paymentResult = await this.processPayment(withdrawal);
      
      // For now, simulate successful payment
      await this.completeWithdrawal(withdrawalId, 'TXN_' + Date.now());
      
      return {
        success: true,
        message: 'Withdrawal processed successfully'
      };
      
    } catch (error) {
      console.error('Process withdrawal error:', error);
      return {
        success: false,
        message: 'Failed to process withdrawal'
      };
    }
  }
  
  async completeWithdrawal(withdrawalId, transactionId) {
    const withdrawal = await Withdraw.findByIdAndUpdate(
      withdrawalId,
      {
        status: 'completed',
        transactionId,
        completedAt: new Date()
      }
    );
    
    // TODO: Send notification to user
    return withdrawal;
  }
  
  async rejectWithdrawal(withdrawalId, reason, adminId) {
    const session = await User.startSession();
    
    try {
      session.startTransaction();
      
      const withdrawal = await Withdraw.findById(withdrawalId).session(session);
      
      if (!withdrawal) {
        throw new Error('Withdrawal not found');
      }
      
      // Refund amount to user
      await walletService.updateBalance(
        withdrawal.user,
        withdrawal.amount,
        'withdrawal_refund'
      );
      
      // Update withdrawal status
      withdrawal.status = 'rejected';
      withdrawal.rejectedReason = reason;
      await withdrawal.save({ session });
      
      await session.commitTransaction();
      
      // TODO: Notify user
      
      return { success: true };
      
    } catch (error) {
      await session.abortTransaction();
      console.error('Reject withdrawal error:', error);
      return { success: false, message: error.message };
    } finally {
      session.endSession();
    }
  }
  
  async getPendingWithdrawals() {
    return Withdraw.find({ status: 'pending' })
      .populate('user', 'telegramId username firstName balance')
      .sort({ createdAt: -1 });
  }
}

module.exports = new WithdrawService();
