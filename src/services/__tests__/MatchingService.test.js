const MatchingService = require('../MatchingService');

describe('MatchingService.reconcileAsset', () => {
  // Default Config for tests
  const config = {
    TIMESTAMP_TOLERANCE_SECONDS: 300, // 5 minutes
    QUANTITY_TOLERANCE_PCT: 0.01      // 0.01%
  };

  it('should perfectly match two identical transactions', () => {
    const userTxns = [{
      originalId: 'U1',
      standardizedAsset: 'BTC',
      standardizedType: 'BUY',
      quantity: 0.5,
      timestamp: new Date('2024-03-01T10:00:00Z')
    }];

    const exchangeTxns = [{
      originalId: 'E1',
      standardizedAsset: 'BTC',
      standardizedType: 'BUY',
      quantity: 0.5,
      timestamp: new Date('2024-03-01T10:02:00Z') // Within 5 min window
    }];

    const result = MatchingService.reconcileAsset(userTxns, exchangeTxns, config);

    expect(result.matched).toHaveLength(1);
    expect(result.conflicting).toHaveLength(0);
    expect(result.unmatchedUser).toHaveLength(0);
    expect(result.matched[0].userTxn.originalId).toBe('U1');
    expect(result.matched[0].exTxn.originalId).toBe('E1');
  });

  it('should flag a conflict if quantity exceeds tolerance', () => {
    const userTxns = [{
      originalId: 'U2',
      standardizedAsset: 'ETH',
      standardizedType: 'SELL',
      quantity: 1.0,
      timestamp: new Date('2024-03-01T10:00:00Z')
    }];

    const exchangeTxns = [{
      originalId: 'E2',
      standardizedAsset: 'ETH',
      standardizedType: 'SELL',
      quantity: 1.05, // 5% difference (exceeds 0.01% tolerance)
      timestamp: new Date('2024-03-01T10:00:00Z') // Exact same time
    }];

    const result = MatchingService.reconcileAsset(userTxns, exchangeTxns, config);

    expect(result.matched).toHaveLength(0);
    expect(result.conflicting).toHaveLength(1);
    expect(result.conflicting[0].reason).toContain('Quantity differs');
  });

  it('should leave transactions unmatched if outside the time tolerance', () => {
    const userTxns = [{
      originalId: 'U3',
      standardizedAsset: 'SOL',
      standardizedType: 'BUY',
      quantity: 10,
      timestamp: new Date('2024-03-01T10:00:00Z')
    }];

    const exchangeTxns = [{
      originalId: 'E3',
      standardizedAsset: 'SOL',
      standardizedType: 'BUY',
      quantity: 10,
      timestamp: new Date('2024-03-01T10:10:00Z') // 10 mins apart (exceeds 5 min window)
    }];

    const result = MatchingService.reconcileAsset(userTxns, exchangeTxns, config);

    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedUser).toHaveLength(1);
    expect(result.unmatchedExchange).toHaveLength(1);
  });

  it('should consume exchange transactions 1-to-1 (prevent double matching)', () => {
    const userTxns = [
      { originalId: 'U4', standardizedType: 'BUY', quantity: 1, timestamp: new Date('2024-03-01T10:00:00Z') },
      { originalId: 'U5', standardizedType: 'BUY', quantity: 1, timestamp: new Date('2024-03-01T10:00:10Z') } // Duplicate on user side
    ];

    const exchangeTxns = [
      { originalId: 'E4', standardizedType: 'BUY', quantity: 1, timestamp: new Date('2024-03-01T10:00:05Z') } // Only one on exchange side
    ];

    const result = MatchingService.reconcileAsset(userTxns, exchangeTxns, config);

    expect(result.matched).toHaveLength(1); // U4 matches E4
    expect(result.unmatchedUser).toHaveLength(1); // U5 has no pair left
    expect(result.unmatchedUser[0].userTxn.originalId).toBe('U5');
  });
});