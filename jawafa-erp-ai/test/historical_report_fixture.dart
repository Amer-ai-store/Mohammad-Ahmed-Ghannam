/// Synthetic-only API fixture. No owner transaction, supplier or token data.
Map<String, dynamic> syntheticHistoricalReport({
  bool missingOlderYear = false,
  bool includeDailySeries = false,
}) {
  const columns = [
    'purchase_qty_milli', 'sales_qty_milli', 'stock_delta_qty_milli',
    'purchases_before_tax_fils', 'purchase_tax_fils',
    'sales_before_tax_fils', 'sales_tax_fils',
    'sales_cost_fils', 'sales_profit_fils',
  ];
  const growth = [
    'sales_before_tax_fils', 'sales_cost_fils', 'sales_profit_fils',
    'sales_qty_milli', 'purchases_before_tax_fils',
    'purchase_qty_milli', 'stock_delta_qty_milli',
  ];
  Map<String, int> totals(int amount) => {
    for (final column in columns) column: amount,
  };
  Map<String, int?> change(int rate) => {
    for (final column in growth) column: rate,
  };
  Map<String, dynamic> period(int amount, {bool missing = false}) => {
    'availability': missing
        ? 'NO_POSTED_EVENTS_FOUND'
        : 'HAS_POSTED_EVENTS_UNATTESTED',
    'totals': missing ? null : totals(amount),
    'daysWithPostedEvents': missing ? 0 : 1,
  };
  return {
    'report': 'INDEPENDENT_NEW_ERP_HISTORICAL_DAILY_AND_MTD_V1',
    'referenceStatus': 'NOT_MATCHED_WITH_TRUSTSOFT',
    'sourceCompletenessIndependentlyVerified': false,
    'formulasIndependentlyApproved': false,
    'functionalParityPercent': null,
    'years': [
      for (var i = 0; i < 3; i++) {
        'year': 2026 - i,
        'date': (2026 - i).toString() + '-10-02',
        'sourceCoverage': 'UNATTESTED',
        'daily': period(250 - i * 70,
            missing: i == 2 && missingOlderYear),
        'monthToDate': period(550 - i * 100,
            missing: i == 2 && missingOlderYear),
        if (includeDailySeries)
          'dailySeries': [
            for (var dayNumber = 1; dayNumber <= 2; dayNumber++) {
              'dayOfMonth': dayNumber,
              'date': (2026 - i).toString() + '-10-' +
                  dayNumber.toString().padLeft(2, '0'),
              ...period(dayNumber == 1 ? 300 - i * 30 : 250 - i * 70,
                  missing: i == 2 && missingOlderYear),
            },
          ],
      },
    ],
    'comparisons': [
      for (var i = 0; i < 2; i++) {
        'againstYear': 2025 - i,
        'percentageUnit': 'BASIS_POINTS_100_EQUALS_1_PERCENT',
        'daily': change((i + 1) * 10000),
        'monthToDate': change((i + 1) * 5000),
      },
    ],
  };
}
