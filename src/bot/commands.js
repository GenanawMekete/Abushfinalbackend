const User = require('../models/User');
const Game = require('../models/Game');
const gameService = require('../services/gameService');
const walletService = require('../services/walletService');
const config = require('../config/env');

module.exports = {
  async start(msg, match) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const referralCode = match[1];
    
    try {
      let user = await User.findOne({ telegramId: userId.toString() });
      
      if (!user) {
        user = new User({
          telegramId: userId.toString(),
          username: msg.from.username,
          firstName: msg.from.first_name,
          lastName: msg.from.last_name
        });
        
        // Handle referral if provided
        if (referralCode) {
          const referrer = await User.findOne({ referralCode });
          if (referrer) {
            user.referredBy = referrer._id;
            referrer.referralCount += 1;
            await referrer.save();
          }
        }
        
        await user.save();
        
        this.bot.sendMessage(chatId, 
          `🎉 Welcome to Bingo Bot, ${msg.from.first_name}!\n\n` +
          `Your starting balance: ${config.BET_AMOUNT} ETB (FREE!)\n\n` +
          `Available commands:\n` +
          `/play - Join the next Bingo game\n` +
          `/balance - Check your balance\n` +
          `/deposit - Add funds to your account\n` +
          `/withdraw - Withdraw your winnings\n` +
          `/history - View your game history\n` +
          `/referral - Get your referral link\n` +
          `/help - Show all commands`
        );
        
        // Add free balance for new users
        await walletService.updateBalance(user._id, config.BET_AMOUNT);
        
      } else {
        this.bot.sendMessage(chatId,
          `👋 Welcome back, ${msg.from.first_name}!\n\n` +
          `Current balance: ${user.balance} ETB\n` +
          `Total wins: ${user.totalWins}\n\n` +
          `Type /play to join the next game!`
        );
      }
    } catch (error) {
      console.error('Start command error:', error);
      this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
  },
  
  async play(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId.toString() });
      
      if (!user) {
        return this.bot.sendMessage(chatId, 'Please use /start first to register.');
      }
      
      if (user.balance < config.BET_AMOUNT) {
        return this.bot.sendMessage(chatId,
          `❌ Insufficient balance!\n\n` +
          `Required: ${config.BET_AMOUNT} ETB\n` +
          `Your balance: ${user.balance} ETB\n\n` +
          `Use /deposit to add funds.`
        );
      }
      
      const result = await gameService.joinGame(user._id);
      
      if (result.success) {
        const game = result.game;
        const card = game.players.find(p => p.user.equals(user._id)).card;
        
        // Format bingo card
        let cardText = '🎯 Your Bingo Card:\n\n';
        for (let i = 0; i < card.length; i++) {
          cardText += `${config.game.card.columns[i]}: ${card[i].join(' | ')}\n`;
        }
        
        this.bot.sendMessage(chatId,
          `✅ Joined game #${game.gameId}!\n\n` +
          `Bet amount: ${config.BET_AMOUNT} ETB\n` +
          `Players: ${game.players.length}/${config.MAX_PLAYERS}\n` +
          `Prize pool: ${game.totalPrizePool} ETB\n\n` +
          `${cardText}\n` +
          `Game starts in ${config.game.countdownDuration} seconds...`
        );
      } else {
        this.bot.sendMessage(chatId, result.message);
      }
    } catch (error) {
      console.error('Play command error:', error);
      this.bot.sendMessage(chatId, '❌ Failed to join game. Please try again.');
    }
  },
  
  async balance(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId.toString() });
      
      if (!user) {
        return this.bot.sendMessage(chatId, 'Please use /start first.');
      }
      
      const activeGames = await Game.countDocuments({
        status: 'active',
        'players.user': user._id
      });
      
      this.bot.sendMessage(chatId,
        `💰 Your Balance\n\n` +
        `Available: ${user.balance} ETB\n` +
        `Total Wins: ${user.totalWins} games\n` +
        `Games Played: ${user.totalGames}\n` +
        `Active Games: ${activeGames}\n\n` +
        `📊 Stats\n` +
        `Total Wagered: ${user.totalWagered} ETB\n` +
        `Referrals: ${user.referralCount} users`
      );
    } catch (error) {
      console.error('Balance command error:', error);
      this.bot.sendMessage(chatId, '❌ Failed to fetch balance.');
    }
  },
  
  async deposit(msg) {
    const chatId = msg.chat.id;
    
    const instructions = `💳 Deposit Instructions\n\n` +
      `1. Send money via Telebirr to: *0911xxxxxx*\n` +
      `2. Send the SMS confirmation here\n` +
      `3. We'll verify and add to your balance\n\n` +
      `📱 Example SMS format:\n` +
      `You have received 100.00 ETB from 0912xxxxxx. Your new balance is 500.00 ETB. Transaction ID: ABC123XYZ\n\n` +
      `Minimum deposit: ${config.deposit.minAmount} ETB\n` +
      `Maximum deposit: ${config.deposit.maxAmount} ETB`;
    
    this.bot.sendMessage(chatId, instructions, { parse_mode: 'Markdown' });
  },
  
  async withdraw(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId.toString() });
      
      if (!user) {
        return this.bot.sendMessage(chatId, 'Please use /start first.');
      }
      
      if (user.balance < config.withdrawal.minAmount) {
        return this.bot.sendMessage(chatId,
          `❌ Minimum withdrawal is ${config.withdrawal.minAmount} ETB\n` +
          `Your balance: ${user.balance} ETB`
        );
      }
      
      // Show withdrawal options
      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '50 ETB', callback_data: 'withdraw_50' },
              { text: '100 ETB', callback_data: 'withdraw_100' },
              { text: '200 ETB', callback_data: 'withdraw_200' }
            ],
            [
              { text: '500 ETB', callback_data: 'withdraw_500' },
              { text: '1000 ETB', callback_data: 'withdraw_1000' },
              { text: 'Custom', callback_data: 'withdraw_custom' }
            ],
            [
              { text: 'Max Amount', callback_data: `withdraw_${user.balance}` }
            ]
          ]
        }
      };
      
      this.bot.sendMessage(chatId,
        `🏧 Withdraw Funds\n\n` +
        `Available balance: ${user.balance} ETB\n` +
        `Minimum: ${config.withdrawal.minAmount} ETB\n` +
        `Maximum: ${config.withdrawal.maxAmount} ETB\n\n` +
        `Select amount to withdraw:`,
        options
      );
    } catch (error) {
      console.error('Withdraw command error:', error);
      this.bot.sendMessage(chatId, '❌ Failed to process withdrawal.');
    }
  },
  
  async history(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId.toString() });
      
      if (!user) {
        return this.bot.sendMessage(chatId, 'Please use /start first.');
      }
      
      // Get last 5 games
      const games = await Game.find({
        'players.user': user._id,
        status: 'completed'
      }).sort({ createdAt: -1 }).limit(5);
      
      if (games.length === 0) {
        return this.bot.sendMessage(chatId, 'No game history found. Play your first game with /play');
      }
      
      let historyText = '📜 Last 5 Games\n\n';
      
      games.forEach((game, index) => {
        const player = game.players.find(p => p.user.equals(user._id));
        const won = player && player.hasBingo;
        
        historyText += `Game #${game.gameId}\n`;
        historyText += `Date: ${game.createdAt.toLocaleDateString()}\n`;
        historyText += `Bet: ${game.betAmount} ETB\n`;
        historyText += `Result: ${won ? `🎉 WON ${player.prizeAmount} ETB` : '❌ Lost'}\n`;
        historyText += `Players: ${game.players.length}\n`;
        historyText += `-----------------\n`;
      });
      
      this.bot.sendMessage(chatId, historyText);
    } catch (error) {
      console.error('History command error:', error);
      this.bot.sendMessage(chatId, '❌ Failed to fetch history.');
    }
  },
  
  async referral(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    try {
      const user = await User.findOne({ telegramId: userId.toString() });
      
      if (!user) {
        return this.bot.sendMessage(chatId, 'Please use /start first.');
      }
      
      const referralLink = `https://t.me/${this.bot.options.username}?start=${user.referralCode}`;
      
      this.bot.sendMessage(chatId,
        `👥 Referral Program\n\n` +
        `Your referral code: *${user.referralCode}*\n\n` +
        `Share this link:\n` +
        `${referralLink}\n\n` +
        `For each friend who joins and plays:\n` +
        `• You get 5 ETB bonus\n` +
        `• They get 10 ETB bonus\n\n` +
        `Total referrals: ${user.referralCount}`
      );
    } catch (error) {
      console.error('Referral command error:', error);
      this.bot.sendMessage(chatId, '❌ Failed to get referral info.');
    }
  },
  
  async help(msg) {
    const chatId = msg.chat.id;
    
    const helpText = `🎮 *Bingo Bot Commands*\n\n` +
      `*Game Commands:*\n` +
      `/play - Join the next Bingo game\n` +
      `/balance - Check your balance\n` +
      `/history - View your game history\n\n` +
      `*Wallet Commands:*\n` +
      `/deposit - Add funds via Telebirr\n` +
      `/withdraw - Withdraw winnings\n\n` +
      `*Account Commands:*\n` +
      `/referral - Get your referral link\n` +
      `/help - Show this message\n\n` +
      `*Game Rules:*\n` +
      `• Bet: ${config.BET_AMOUNT} ETB per game\n` +
      `• Game starts every ${config.ROUND_DURATION} seconds\n` +
      `• Win by completing lines, diagonals, or full house\n` +
      `• ${config.PRIZE_PERCENTAGE}% of bets go to prize pool`;
    
    this.bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
  }
};
