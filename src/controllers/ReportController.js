const { Parser } = require('json2csv');
const ReportEntry = require('../models/ReportEntry');

exports.downloadReport = async (req, res) => {
  try {
    const { runId } = req.params;
    const entries = await ReportEntry.find({ runId });

    if (!entries || entries.length === 0) {
      return res.status(404).json({ error: 'No report found for this Run ID.' });
    }


    const flatData = entries.map(entry => ({
      Category: entry.status,
      Reason: entry.reason,

      User_Txn_ID: entry.userRawData.transaction_id || 'N/A',
      User_Asset: entry.userRawData.asset || 'N/A',
      User_Type: entry.userRawData.type || 'N/A',
      User_Quantity: entry.userRawData.quantity || 'N/A',

      Exchange_Txn_ID: entry.exchangeRawData.transaction_id || 'N/A',
      Exchange_Asset: entry.exchangeRawData.asset || 'N/A',
      Exchange_Type: entry.exchangeRawData.type || 'N/A',
      Exchange_Quantity: entry.exchangeRawData.quantity || 'N/A'
    }));

    const json2csvParser = new Parser();
    const csvData = json2csvParser.parse(flatData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation_${runId}.csv"`);
    
    return res.status(200).send(csvData);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.getSummary = async (req, res) => {
  try {
    const { runId } = req.params;
    
    const counts = await ReportEntry.aggregate([
      { $match: { runId } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const summary = {
      MATCHED: 0,
      CONFLICTING: 0,
      UNMATCHED_USER: 0,
      UNMATCHED_EXCHANGE: 0
    };

    counts.forEach(c => { summary[c._id] = c.count; });

    return res.status(200).json({ success: true, runId, summary });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUnmatched = async (req, res) => {
  try {
    const { runId } = req.params;
    
    const unmatched = await ReportEntry.find({
      runId,
      status: { $in: ['UNMATCHED_USER', 'UNMATCHED_EXCHANGE'] }
    }).select('status reason userTxnId exchangeTxnId userRawData exchangeRawData -_id');

    return res.status(200).json({ success: true, runId, data: unmatched });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
