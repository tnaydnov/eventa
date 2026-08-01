export const RELIABILITY_ALERT_THRESHOLDS = {
  highPollingSharePct: 5,
  disconnectSpike24h: 20,
  smsMinSamples24h: 20,
  smsFailurePct24h: 10,
  smsMinSamples7d: 50,
  smsFailurePct7d: 8,
  highRetryBacklogCount: 20,
  apiMinRequests24h: 20,
  apiErrorRatePct24h: 5,
  apiP95LatencyMs24h: 1500,
} as const;
