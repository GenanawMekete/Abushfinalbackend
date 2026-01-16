const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  smsContent: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'failed', 'expired'],
    default: 'pending'
  },
  verifiedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  },
  metadata: {
    type: Map,
    of: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
depositSchema.index({ user: 1, status: 1 });
depositSchema.index({ createdAt: 1 });
depositSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Deposit', depositSchema);
