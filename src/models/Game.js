const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'cancelled'],
    default: 'waiting'
  },
  players: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    card: {
      type: [[Number]],
      required: true
    },
    markedNumbers: {
      type: [Number],
      default: []
    },
    hasBingo: {
      type: Boolean,
      default: false
    },
    bingoAt: {
      type: Date
    },
    prizeAmount: {
      type: Number,
      default: 0
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  drawnNumbers: {
    type: [Number],
    default: []
  },
  totalPrizePool: {
    type: Number,
    default: 0
  },
  winnerCount: {
    type: Number,
    default: 0
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  scheduledStart: {
    type: Date
  },
  roundDuration: {
    type: Number,
    default: 30
  },
  betAmount: {
    type: Number,
    required: true
  },
  winningPatterns: [{
    type: String,
    enum: ['line', 'vertical', 'diagonal', 'fourcorners', 'fullhouse']
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
gameSchema.index({ status: 1 });
gameSchema.index({ createdAt: 1 });
gameSchema.index({ scheduledStart: 1 });
gameSchema.index({ 'players.user': 1 });

module.exports = mongoose.model('Game', gameSchema);
