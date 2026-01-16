const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected', 'cancelled'],
    default: 'pending'
  },
  phoneNumber: {
    type: String,
    required: true
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  rejectedReason: {
    type: String
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  adminNotes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
withdrawSchema.index({ user: 1, status: 1 });
withdrawSchema.index({ createdAt: 1 });
withdrawSchema.index({ status: 1 });

module.exports = mongoose.model('Withdraw', withdrawSchema);
