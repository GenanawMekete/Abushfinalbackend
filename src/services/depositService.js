const Deposit = require('../models/Deposit');
const User = require('../models/User');
const walletService = require('./walletService');
const parseTelebirr = require('../utils/parseTelebirr');

class DepositService {
  async processDeposit(userId, amount, smsContent, transactionId) {
    try {
      // Check for duplicate transaction
      const existingDeposit = await Deposit.findOne({ 
        transactionId,
        status: { $in: ['verified', 'pending'] }
      });
      
      if (existingDeposit) {
        return {
          success: false,
          message: 'This transaction has already been processed'
        };
      }
      
      // Create deposit record
      const deposit = new Deposit({
        user: userId,
        amount,
        smsContent,
        transactionId,
        status: 'pending'
      });
      
      await deposit.save();
      
      // Auto-verify if enabled
      if (config.deposit.autoVerify) {
        return await this.verifyDeposit(deposit._id);
      }
      
      return {
        success: true,
        depositId: deposit._id,
        message: 'Deposit recorded. Waiting for verification...'
      };
      
    } catch (error) {
      console.error('Process deposit error:', error);
      return {
        success: false,
        message: 'Failed to process deposit'
      };
    }
  }
  
  async verifyDeposit(depositId) {
    try {
      const deposit = await Deposit.findById(depositId).populate('user');
      
      if (!deposit) {
        return { success: false, message: 'Deposit not found' };
      }
      
      if (deposit.status === 'verified') {
        return { success: false, message: 'Deposit already verified' };
      }
      
      // Verify SMS content (implement actual verification logic)
      const isValid = await this.verifySMSText(deposit.smsContent);
      
      if (!isValid) {
        deposit.status = 'failed';
        await deposit.save();
        
        return {
          success: false,
          message: 'SMS verification failed'
        };
      }
      
      // Update deposit status
      deposit.status = 'verified';
      deposit.verifiedAt = new Date();
      await deposit.save();
      
      // Add to user balance
      const result = await walletService.updateBalance(
        deposit.user._id,
        deposit.amount,
        'deposit'
      );
      
      if (result.success) {
        // Update user stats
        await User.findByIdAndUpdate(deposit.user._id, {
          $inc: { totalDeposits: deposit.amount }
        });
        
        return {
          success: true,
          newBalance: result.newBalance,
          depositId: deposit._id,
          message: 'Deposit verified successfully'
        };
      } else {
        return {
          success: false,
          message: 'Failed to update balance'
        };
      }
      
    } catch (error) {
      console.error('Verify deposit error:', error);
      return {
        success: false,
        message: 'Verification failed'
      };
    }
  }
  
  async verifySMSText(smsText) {
    // Implement actual Telebirr SMS verification
    // This could involve:
    // 1. Checking SMS format
    // 2. Validating with Telebirr API if available
    // 3. Checking against known fraud patterns
    
    const parsed = parseTelebirr(smsText);
    if (!parsed) return false;
    
    // Additional checks
    if (parsed.amount < config.deposit.minAmount) return false;
    if (parsed.amount > config.deposit.maxAmount) return false;
    
    // Check if transaction ID follows expected format
    if (!parsed.transactionId || parsed.transactionId.length < 8) return false;
    
    return true;
  }
  
  async getPendingDeposits() {
    return Deposit.find({ status: 'pending' })
      .populate('user', 'telegramId username firstName')
      .sort({ createdAt: -1 });
  }
  
  async expireOldDeposits() {
    const expired = await Deposit.updateMany(
      {
        status: 'pending',
        expiresAt: { $lt: new Date() }
      },
      {
        status: 'expired'
      }
    );
    
    return expired.modifiedCount;
  }
}

module.exports = new DepositService();
