const User = require('../models/User');
const depositService = require('../services/depositService');
const parseTelebirr = require('../utils/parseTelebirr');

module.exports = {
  async handleMessage(msg) {
    // Skip if it's a command
    if (msg.text && msg.text.startsWith('/')) {
      return;
    }
    
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId.toString() });
      
      if (!user) {
        return this.bot.sendMessage(chatId, 'Please use /start first.');
      }
      
      // Check if user has pending withdrawal info
      if (user.pendingWithdrawal && !user.pendingPhone) {
        return this.handleWithdrawPhone(msg, user);
      }
      
      // Otherwise, treat as deposit SMS
      await this.handleDepositSMS(msg, user);
      
    } catch (error) {
      console.error('Message handling error:', error);
      this.bot.sendMessage(chatId, '❌ Failed to process message.');
    }
  },
  
  async handleWithdrawPhone(msg, user) {
    const phone = msg.text.trim();
    
    // Validate Ethiopian phone number
    const phoneRegex = /^(09\d{8}|9\d{8})$/;
    if (!phoneRegex.test(phone)) {
      return this.bot.sendMessage(msg.chat.id,
        '❌ Invalid phone number format.\n' +
        'Please enter a valid Ethiopian phone number (e.g., 0912345678)'
      );
    }
    
    user.pendingPhone = phone;
    await user.save();
    
    // Ask for confirmation
    const options = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm', callback_data: 'confirm_withdraw' },
            { text: '❌ Cancel', callback_data: 'cancel_withdraw' }
          ]
        ]
      }
    };
    
    this.bot.sendMessage(msg.chat.id,
      `Please confirm withdrawal:\n\n` +
      `Amount: ${user.pendingWithdrawal} ETB\n` +
      `Phone: ${phone}\n\n` +
      `Processing fee: ${config.withdrawal.processingFee}%\n` +
      `You will receive: ${user.pendingWithdrawal * (1 - config.withdrawal.processingFee / 100)} ETB`,
      options
    );
  },
  
  async handleDepositSMS(msg, user) {
    const smsText = msg.text;
    const parsed = parseTelebirr(smsText);
    
    if (!parsed) {
      return this.bot.sendMessage(msg.chat.id,
        `❌ Could not parse SMS.\n\n` +
        `Please send the exact SMS from Telebirr.\n` +
        `Example format:\n` +
        `"You have received 100.00 ETB from 0912xxxxxx. Your new balance is 500.00 ETB. Transaction ID: ABC123XYZ"`
      );
    }
    
    if (parsed.amount < config.deposit.minAmount) {
      return this.bot.sendMessage(msg.chat.id,
        `❌ Minimum deposit is ${config.deposit.minAmount} ETB\n` +
        `Your amount: ${parsed.amount} ETB`
      );
    }
    
    if (parsed.amount > config.deposit.maxAmount) {
      return this.bot.sendMessage(msg.chat.id,
        `❌ Maximum deposit is ${config.deposit.maxAmount} ETB\n` +
        `Your amount: ${parsed.amount} ETB`
      );
    }
    
    // Process deposit
    const result = await depositService.processDeposit(
      user._id,
      parsed.amount,
      smsText,
      parsed.transactionId
    );
    
    if (result.success) {
      this.bot.sendMessage(msg.chat.id,
        `✅ Deposit verified!\n\n` +
        `Amount: ${parsed.amount} ETB\n` +
        `Transaction ID: ${parsed.transactionId}\n` +
        `New balance: ${result.newBalance} ETB\n\n` +
        `You can now play with /play`
      );
    } else {
      this.bot.sendMessage(msg.chat.id,
        `❌ ${result.message}\n\n` +
        `If you believe this is an error, please contact support.`
      );
    }
  }
};
