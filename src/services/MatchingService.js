const Transaction = require('../models/Transaction');
const ReportEntry = require('../models/ReportEntry');
const BigNumber = require('bignumber.js');

class MatchingService {
  static async runReconciliation(runId, config) {

    const userTxns = await Transaction.find({ runId, source: 'USER', isFlagged: false });
    const exchangeTxns = await Transaction.find({ runId, source: 'EXCHANGE', isFlagged: false });

    const userByAsset = this.groupByAsset(userTxns);
    const exchangeByAsset = this.groupByAsset(exchangeTxns);
    const allAssets = new Set([...Object.keys(userByAsset), ...Object.keys(exchangeByAsset)]);

    const matched = [];
    const conflicting = [];
    const unmatchedUser = [];
    const unmatchedExchange = [];

    for (const asset of allAssets) {
      const uTxns = userByAsset[asset] || [];
      const eTxns = exchangeByAsset[asset] || [];
      
      const results = this.reconcileAsset(uTxns, eTxns, config);
      
      matched.push(...results.matched);
      conflicting.push(...results.conflicting);
      unmatchedUser.push(...results.unmatchedUser);
      unmatchedExchange.push(...results.unmatchedExchange);
    }

    await this.saveReportEntries(runId, { matched, conflicting, unmatchedUser, unmatchedExchange });

    return {
      MATCHED: matched.length,
      CONFLICTING: conflicting.length,
      UNMATCHED_USER: unmatchedUser.length,
      UNMATCHED_EXCHANGE: unmatchedExchange.length
    };
  }

  static groupByAsset(txns) {
    return txns.reduce((acc, txn) => {
      const asset = txn.standardizedAsset || 'UNKNOWN';
      if (!acc[asset]) acc[asset] = [];
      acc[asset].push(txn);
      return acc;
    }, {});
  }

  static reconcileAsset(userTxns, exchangeTxns, config) {
    userTxns.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    exchangeTxns.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const timeToleranceMs = (config.TIMESTAMP_TOLERANCE_SECONDS || 300) * 1000;
    const quantityTolerancePct = new BigNumber(config.QUANTITY_TOLERANCE_PCT || 0.01);

    const matched = [];
    const conflicting = [];
    const unmatchedUser = [];
    const consumedExchangeIndices = new Set();
    let windowStart = 0;

    for (let i = 0; i < userTxns.length; i++) {
      const userTxn = userTxns[i];
      const uTime = userTxn.timestamp.getTime();

      while (
        windowStart < exchangeTxns.length && 
        exchangeTxns[windowStart].timestamp.getTime() < (uTime - timeToleranceMs)
      ) {
        windowStart++;
      }

      let foundMatch = false;
      let bestConflict = null;

      for (let j = windowStart; j < exchangeTxns.length; j++) {
        const exTxn = exchangeTxns[j];
        const exTime = exTxn.timestamp.getTime();

        if (exTime > (uTime + timeToleranceMs)) break;
        if (consumedExchangeIndices.has(j)) continue;
        if (userTxn.standardizedType !== exTxn.standardizedType) continue;

        const uQty = new BigNumber(userTxn.quantity);
        const exQty = new BigNumber(exTxn.quantity);
        const absoluteDiff = uQty.minus(exQty).absoluteValue();
        const maxQty = BigNumber.max(uQty.absoluteValue(), exQty.absoluteValue());
        
        const pctDiff = maxQty.isZero() 
          ? new BigNumber(0) 
          : absoluteDiff.dividedBy(maxQty).multipliedBy(100);

        if (pctDiff.lte(quantityTolerancePct)) {
          matched.push({ userTxn, exTxn, reason: 'Matched within tolerances' });
          consumedExchangeIndices.add(j);
          foundMatch = true;
          break; 
        } else {
          if (!bestConflict) {
            bestConflict = { 
              userTxn, exTxn, conflictIndex: j, 
              reason: `Quantity differs by ${pctDiff.toFixed(4)}%` 
            };
          }
        }
      }

      if (!foundMatch) {
        if (bestConflict) {
          conflicting.push(bestConflict);
          consumedExchangeIndices.add(bestConflict.conflictIndex);
        } else {
          unmatchedUser.push({ userTxn, reason: 'No exchange transaction found within window' });
        }
      }
    }

    const unmatchedExchange = exchangeTxns
      .filter((_, idx) => !consumedExchangeIndices.has(idx))
      .map(exTxn => ({ exTxn, reason: 'No matching user transaction found' }));

    return { matched, conflicting, unmatchedUser, unmatchedExchange };
  }

  static async saveReportEntries(runId, { matched, conflicting, unmatchedUser, unmatchedExchange }) {
    const reportDocs = [];

    matched.forEach(({ userTxn, exTxn, reason }) => {
      reportDocs.push({
        runId, status: 'MATCHED', reason,
        userTxnId: userTxn.originalId, exchangeTxnId: exTxn.originalId,
        userRawData: userTxn.rawRow, exchangeRawData: exTxn.rawRow
      });
    });

    conflicting.forEach(({ userTxn, exTxn, reason }) => {
      reportDocs.push({
        runId, status: 'CONFLICTING', reason,
        userTxnId: userTxn.originalId, exchangeTxnId: exTxn.originalId,
        userRawData: userTxn.rawRow, exchangeRawData: exTxn.rawRow
      });
    });

    unmatchedUser.forEach(({ userTxn, reason }) => {
      reportDocs.push({
        runId, status: 'UNMATCHED_USER', reason,
        userTxnId: userTxn.originalId, userRawData: userTxn.rawRow
      });
    });

    unmatchedExchange.forEach(({ exTxn, reason }) => {
      reportDocs.push({
        runId, status: 'UNMATCHED_EXCHANGE', reason,
        exchangeTxnId: exTxn.originalId, exchangeRawData: exTxn.rawRow
      });
    });

    if (reportDocs.length > 0) {
      await ReportEntry.insertMany(reportDocs);
    }
  }
}

module.exports = MatchingService;