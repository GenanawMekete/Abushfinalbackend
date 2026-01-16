const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const gameSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `BINGO-${Date.now()}-${uuidv4().slice(0, 8)}`.toUpperCase()
  },
  
  status: {
    type: String,
    enum: ['waiting', 'countdown', 'active', 'completed', 'cancelled'],
    default: 'waiting',
    index: true
  },
  
  // Game Configuration
  betAmount: {
    type: Number,
    required: true,
    min: 1,
    default: 10
  },
  
  roundDuration: {
    type: Number,
    default: 30,
    min: 10,
    max: 300
  },
  
  prizePercentage: {
    type: Number,
    default: 85,
    min: 50,
    max: 100
  },
  
  // Players
  players: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    telegramId: String,
    username: String,
    firstName: String,
    cardNumber: {
      type: Number,
      min: 1,
      max: 400
    },
    card: [[Number]],
    markedNumbers: [Number],
    hasBingo: {
      type: Boolean,
      default: false
    },
    bingoAt: Date,
    prizeAmount: {
      type: Number,
      default: 0
    },
    autoMark: {
      type: Boolean,
      default: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Game Progress
  drawnNumbers: [Number],
  totalPrizePool: {
    type: Number,
    default: 0
  },
  winnerCount: {
    type: Number,
    default: 0
  },
  
  // Timing
  scheduledStart: Date,
  startTime: Date,
  endTime: Date,
  actualEndTime: Date,
  
  // Winners
  winners: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    cardNumber: Number,
    prizeAmount: Number,
    bingoAt: Date,
    winningPattern: String
  }],
  
  // Statistics
  totalBets: {
    type: Number,
    default: 0
  },
  houseProfit: {
    type: Number,
    default: 0
  },
  
  // Metadata
  version: {
    type: String,
    default: '1.0.0'
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
gameSchema.index({ status: 1, scheduledStart: 1 });
gameSchema.index({ 'players.userId': 1 });
gameSchema.index({ createdAt: -1 });
gameSchema.index({ 'winners.userId': 1 });

// Virtuals
gameSchema.virtual('playerCount').get(function() {
  return this.players.length;
});

gameSchema.virtual('remainingTime').get(function() {
  if (!this.startTime || !this.roundDuration) return 0;
  
  const elapsed = (Date.now() - this.startTime.getTime()) / 1000;
  return Math.max(0, this.roundDuration - elapsed);
});

gameSchema.virtual('isFull').get(function() {
  return this.players.length >= 400;
});

// Methods
gameSchema.methods.addPlayer = function(playerData) {
  const existingPlayer = this.players.find(p => 
    p.userId.toString() === playerData.userId.toString()
  );
  
  if (existingPlayer) {
    throw new Error('Player already in game');
  }
  
  this.players.push({
    ...playerData,
    joinedAt: new Date()
  });
  
  this.totalPrizePool += this.betAmount * (this.prizePercentage / 100);
  this.totalBets += this.betAmount;
  this.houseProfit += this.betAmount * ((100 - this.prizePercentage) / 100);
  
  return this;
};

gameSchema.methods.removePlayer = function(userId) {
  const playerIndex = this.players.findIndex(p => 
    p.userId.toString() === userId.toString()
  );
  
  if (playerIndex > -1) {
    this.players.splice(playerIndex, 1);
    return true;
  }
  
  return false;
};

gameSchema.methods.drawNumber = function() {
  const allNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
  const availableNumbers = allNumbers.filter(n => !this.drawnNumbers.includes(n));
  
  if (availableNumbers.length === 0) return null;
  
  const randomIndex = Math.floor(Math.random() * availableNumbers.length);
  const drawnNumber = availableNumbers[randomIndex];
  
  this.drawnNumbers.push(drawnNumber);
  return drawnNumber;
};

gameSchema.methods.checkBingo = function(userId) {
  const player = this.players.find(p => 
    p.userId.toString() === userId.toString()
  );
  
  if (!player || !player.card || player.hasBingo) {
    return false;
  }
  
  // Check for winning patterns
  const patterns = [
    this.checkHorizontalLines(player),
    this.checkVerticalLines(player),
    this.checkDiagonals(player),
    this.checkFourCorners(player),
    this.checkFullHouse(player)
  ];
  
  const winningPattern = patterns.find(pattern => pattern.won);
  
  if (winningPattern) {
    player.hasBingo = true;
    player.bingoAt = new Date();
    player.winningPattern = winningPattern.pattern;
    
    this.winnerCount++;
    
    // Calculate prize
    const totalWinners = this.players.filter(p => p.hasBingo).length;
    player.prizeAmount = (this.totalPrizePool / totalWinners);
    
    this.winners.push({
      userId: player.userId,
      username: player.username,
      cardNumber: player.cardNumber,
      prizeAmount: player.prizeAmount,
      bingoAt: player.bingoAt,
      winningPattern: player.winningPattern
    });
    
    return winningPattern;
  }
  
  return false;
};

gameSchema.methods.checkHorizontalLines = function(player) {
  const card = player.card;
  const marked = player.markedNumbers;
  
  for (let row = 0; row < 5; row++) {
    let complete = true;
    
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) continue; // Free space
      if (!marked.includes(card[col][row])) {
        complete = false;
        break;
      }
    }
    
    if (complete) {
      return { won: true, pattern: `horizontal-${row + 1}` };
    }
  }
  
  return { won: false };
};

gameSchema.methods.checkVerticalLines = function(player) {
  const card = player.card;
  const marked = player.markedNumbers;
  
  for (let col = 0; col < 5; col++) {
    let complete = true;
    
    for (let row = 0; row < 5; row++) {
      if (row === 2 && col === 2) continue; // Free space
      if (!marked.includes(card[col][row])) {
        complete = false;
        break;
      }
    }
    
    if (complete) {
      return { won: true, pattern: `vertical-${String.fromCharCode(65 + col)}` };
    }
  }
  
  return { won: false };
};

gameSchema.methods.checkDiagonals = function(player) {
  const card = player.card;
  const marked = player.markedNumbers;
  
  // Main diagonal
  let mainComplete = true;
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue; // Free space
    if (!marked.includes(card[i][i])) {
      mainComplete = false;
      break;
    }
  }
  
  if (mainComplete) {
    return { won: true, pattern: 'diagonal-main' };
  }
  
  // Anti-diagonal
  let antiComplete = true;
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue; // Free space
    if (!marked.includes(card[4 - i][i])) {
      antiComplete = false;
      break;
    }
  }
  
  if (antiComplete) {
    return { won: true, pattern: 'diagonal-anti' };
  }
  
  return { won: false };
};

gameSchema.methods.checkFourCorners = function(player) {
  const card = player.card;
  const marked = player.markedNumbers;
  
  const corners = [
    card[0][0],    // Top-left
    card[4][0],    // Top-right
    card[0][4],    // Bottom-left
    card[4][4]     // Bottom-right
  ];
  
  const allMarked = corners.every(corner => marked.includes(corner));
  
  if (allMarked) {
    return { won: true, pattern: 'four-corners' };
  }
  
  return { won: false };
};

gameSchema.methods.checkFullHouse = function(player) {
  const card = player.card;
  const marked = player.markedNumbers;
  
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 5; row++) {
      if (row === 2 && col === 2) continue; // Free space
      if (!marked.includes(card[col][row])) {
        return { won: false };
      }
    }
  }
  
  return { won: true, pattern: 'full-house' };
};

// Static methods
gameSchema.statics.findActiveGames = function() {
  return this.find({ 
    status: { $in: ['waiting', 'countdown', 'active'] }
  }).sort({ createdAt: -1 });
};

gameSchema.statics.findUserGames = function(userId) {
  return this.find({
    'players.userId': userId,
    status: 'completed'
  }).sort({ createdAt: -1 }).limit(20);
};

gameSchema.statics.calculateStats = async function() {
  const stats = await this.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: null,
        totalGames: { $sum: 1 },
        totalPlayers: { $sum: { $size: '$players' } },
        totalBets: { $sum: '$totalBets' },
        totalPrizes: { $sum: '$totalPrizePool' },
        totalWinners: { $sum: '$winnerCount' },
        houseProfit: { $sum: '$houseProfit' },
        averagePlayers: { $avg: { $size: '$players' } }
      }
    }
  ]);
  
  return stats[0] || {
    totalGames: 0,
    totalPlayers: 0,
    totalBets: 0,
    totalPrizes: 0,
    totalWinners: 0,
    houseProfit: 0,
    averagePlayers: 0
  };
};

// Pre-save middleware
gameSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create and export model
const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
