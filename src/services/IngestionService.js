const fs = require('fs');
const csv = require('csv-parser');
const Transaction = require('../models/Transaction');

const ASSET_ALIASES = { 'BITCOIN': 'BTC', 'ETHEREUM': 'ETH', 'SOLANA': 'SOL' };
const TYPE_MAP = { 'TRANSFER_OUT': 'TRANSFER_IN' };

class IngestionService {
  static async ingestCSV(filePath, source, runId) {
    const records = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          let isFlagged = false;
          let flagReason = null;

          let parsedDate = new Date(row.timestamp);
          if (isNaN(parsedDate.getTime())) {
            isFlagged = true;
            flagReason = `Invalid or corrupt timestamp: ${row.timestamp}`;
            parsedDate = new Date();
          }

          const rawAsset = (row.asset || '').trim().toUpperCase();
          const standardizedAsset = ASSET_ALIASES[rawAsset] || rawAsset;

          const rawType = (row.type || 'UNKNOWN').trim().toUpperCase();
          
          const standardizedType = TYPE_MAP[rawType] || (rawType === '' ? 'UNKNOWN' : rawType);

          records.push({
            runId,
            source,
            originalId: row.transaction_id || 'UNKNOWN',
            timestamp: parsedDate,
            type: row.type || 'UNKNOWN',
            standardizedType,
            asset: row.asset || 'UNKNOWN',
            standardizedAsset,
            quantity: parseFloat(row.quantity) || 0,
            priceUsd: row.price_usd ? parseFloat(row.price_usd) : null,
            fee: parseFloat(row.fee) || 0,
            isFlagged,
            flagReason,
            rawRow: row
          });
        })
        .on('end', async () => {
          try {
            await Transaction.insertMany(records);
            resolve(records.length);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (error) => reject(error));
    });
  }
}

module.exports = IngestionService;