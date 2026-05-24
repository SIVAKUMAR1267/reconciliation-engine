const mongoose = require('mongoose');

const ReportEntrySchema = new mongoose.Schema({
  runId: { type: String, required: true, index: true },
  status: { 
    type: String, 
    enum: ['MATCHED', 'CONFLICTING', 'UNMATCHED_USER', 'UNMATCHED_EXCHANGE'], 
    required: true 
  },
  reason: { type: String, required: true },
  userTxnId: { type: String, default: null },
  exchangeTxnId: { type: String, default: null },
  userRawData: { type: Object, default: {} },
  exchangeRawData: { type: Object, default: {} }
});

module.exports = mongoose.model('ReportEntry', ReportEntrySchema);