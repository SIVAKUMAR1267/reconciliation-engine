const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  runId: { type: String, required: true },
  source: { type: String, enum: ['USER', 'EXCHANGE'], required: true },
  originalId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  type: { type: String, required: true },
  standardizedType: { type: String, required: true },
  asset: { type: String, required: true },
  standardizedAsset: { type: String, required: true },
  quantity: { type: Number, required: true },
  priceUsd: { type: Number },
  fee: { type: Number, default: 0 },
  isFlagged: { type: Boolean, default: false },
  flagReason: { type: String, default: null },
  rawRow: { type: Object, required: true }
});

TransactionSchema.index({ runId: 1, standardizedAsset: 1, timestamp: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);