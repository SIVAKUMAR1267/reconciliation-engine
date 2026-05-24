const { v4: uuidv4 } = require('uuid');
const IngestionService = require('../services/IngestionService');
const MatchingService = require('../services/MatchingService');
const Report = require('../models/ReportEntry');

exports.triggerReconciliation = async (req, res) => {
  try {
    const { v4: uuidv4 } = require('uuid');
    const runId = uuidv4();
    const body = req.body || {};

    const config = {
      TIMESTAMP_TOLERANCE_SECONDS: body.TIMESTAMP_TOLERANCE_SECONDS || process.env.TIMESTAMP_TOLERANCE_SECONDS || 300,
      QUANTITY_TOLERANCE_PCT: body.QUANTITY_TOLERANCE_PCT || process.env.QUANTITY_TOLERANCE_PCT || 0.01
    };
    await IngestionService.ingestCSV('./user_transactions.csv', 'USER', runId);
    await IngestionService.ingestCSV('./exchange_transactions.csv', 'EXCHANGE', runId);

    const summary = await MatchingService.runReconciliation(runId, config);
    return res.status(200).json({
      success: true,
      runId,
      config,
      summary
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};