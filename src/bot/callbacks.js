const User = require('../models/User');
const withdrawService = require('../services/withdrawService');
const walletService = require('../services/walletService');

module.exports = {
  async handleCallbackQuery(query) {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    
    try {
      const user = await User.findOne({ telegramId: userId.toString() });
      
      if (!user) {
        return this.bot.answerCallbackQuery(query.id, { text: 'Please use /start first.' });
      }
      
      // Handle different callback types
      if (data.startsWith('withdraw_')) {
        await this.handleWithdrawCallback(query, user, data);
      } else if (data === 'confirm_withdraw') {
        await this.confirmWithdraw(query, user);
      } else if (data === 'cancel_withdraw') {
        await this.cancelWithdraw(query, user);
      }
      
    } catch (error) {
      console.error('Callback error:', error);
      this.bot.answerCallbackQuery(query.id, { text: '❌ An error occurred' });
    }
  },
  
  async handleWithdrawCallback(query, user, data) {
    const amountStr = data.replace('withdraw_', '');
    const amount = amountStr === 'custom' ? null : parseFloat(amountStr);
    
    if (amount === null) {
      // Ask for custom amount
      this.bot.sendMessage(query.message.chat.id, 
        'Enter the amount to withdraw (ETB):\n' +
        `Min: ${config.withdrawal.minAmount}, Max: ${config.withdrawal.maxAmount}`
      );
      return this.bot.answerCallbackQuery(query.id);
    }
    
    if (isNaN(amount) || amount < config.withdrawal.minAmount || amount > config.withdrawal.maxAmount) {
      return this.bot.answerCallbackQuery(query.id, {
        text: `Invalid amount. Min: ${config.withdrawal.minAmount}, Max: ${config.withdrawal.maxAmount}`
      });
    }
    
    if (user.balance < amount) {
      return this.bot.answerCallbackQuery(query.id, {
        text: '❌ Insufficient balance'
      });
    }
    
    // Store withdrawal request temporarily
    user.pendingWithdrawal = amount;
    await user.save();
    
    // Ask for phone number
    this.bot.sendMessage(query.message.chat.id,
      `Please enter your Telebirr phone number:\n\n` +
      `Example: 0912345678\n` +
      `Amount: ${amount} ETB`
    );
    
    this.bot.answerCallbackQuery(query.id);
  },
  
  async confirmWithdraw(query, user) {
    if (!user.pendingWithdrawal || !user.pendingPhone) {
      return this.bot.answerCallbackQuery(query.id, {
        text: 'Withdrawal info missing'
      });
    }
    
    const result = await withdrawService.createWithdrawal(
      user._id,
      user.pendingWithdrawal,
      user.pendingPhone
    );
    
    if (result.success) {
      // Clear pending data
      user.pendingWithdrawal = undefined;
      user.pendingPhone = undefined;
      await user.save();
      
      this.bot.editMessageText(
        `✅ Withdrawal request submitted!\n\n` +
        `Amount: ${result.withdrawal.amount} ETB\n` +
        `To: ${result.withdrawal.phoneNumber}\n` +
        `Status: Pending\n\n` +
        `You will receive payment within 24 hours.`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id
        }
      );
    } else {
      this.bot.answerCallbackQuery(query.id, {
        text: result.message
      });
    }
  },
  
  async cancelWithdraw(query, user) {
    user.pendingWithdrawal = undefined;
    user.pendingPhone = undefined;
    await user.save();
    
    this.bot.editMessageText(
      'Withdrawal cancelled.',
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id
      }
    );
  }
};
