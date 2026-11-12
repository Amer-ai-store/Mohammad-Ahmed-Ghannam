/// Strict, read-only models for an independent new-ERP historical report.
/// Never treat these amounts as certified TrustSoft equivalents.
const reportFields = <String>[
  'purchase_qty_milli', 'sales_qty_milli', 'stock_delta_qty_milli',
  'purchases_before_tax_fils', 'purchase_tax_fils',
  'sales_before_tax_fils', 'sales_tax_fils',
  'sales_cost_fils', 'sales_profit_fils',
];
const growthFields = <String>[
  'sales_before_tax_fils', 'sales_cost_fils', 'sales_profit_fils',
  'sales_qty_milli', 'purchases_before_tax_fils',
  'purchase_qty_milli', 'stock_delta_qty_milli',
];

class ErpHistoricalReportError implements Exception {
  final String code;
  const ErpHistoricalReportError(this.code);
  @override
  String toString() => 'ErpHistoricalReportError($code)';
}

Map<String, dynamic> _object(dynamic value) {
  if (value is! Map) {
    throw const ErpHistoricalReportError('INVALID_RESPONSE');
  }
  try {
    return Map<String, dynamic>.from(value);
  } catch (_) {
    throw const ErpHistoricalReportError('INVALID_RESPONSE');
  }
}

bool validReportDay(String day) {
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(day)) return false;
  final value = DateTime.tryParse(day + 'T00:00:00Z');
  return value != null &&
      value.toIso8601String().substring(0, 10) == day;
}

class ErpReportPeriod {
  final String availability;
  final Map<String, int>? totals;
  final int? daysWithPostedEvents;
  const ErpReportPeriod._(
    this.availability, this.totals, this.daysWithPostedEvents,
  );

  factory ErpReportPeriod.parse(dynamic value) {
    final json = _object(value);
    final status = json['availability'];
    if (status != 'HAS_POSTED_EVENTS_UNATTESTED' &&
        status != 'NO_POSTED_EVENTS_FOUND') {
      throw const ErpHistoricalReportError('INVALID_COVERAGE');
    }
    final values = json['totals'];
    if ((status == 'NO_POSTED_EVENTS_FOUND') != (values == null)) {
      throw const ErpHistoricalReportError('INVALID_COVERAGE');
    }
    Map<String, int>? sums;
    if (values != null) {
      final fields = _object(values);
      if (reportFields.any((name) => fields[name] is! int)) {
        throw const ErpHistoricalReportError('INVALID_TOTALS');
      }
      sums = Map.unmodifiable({
        for (final name in reportFields) name: fields[name] as int,
      });
    }
    final days = json['daysWithPostedEvents'];
    if (days != null && (days is! int || days < 0 || days > 31)) {
      throw const ErpHistoricalReportError('INVALID_COVERAGE');
    }
    return ErpReportPeriod._(status as String, sums, days as int?);
  }
}

/// One independently observed month-day. Absence is null, never zero.
class ErpHistoricalTrendDay {
  final int dayOfMonth;
  final String date;
  final ErpReportPeriod observation;
  const ErpHistoricalTrendDay._(
    this.dayOfMonth, this.date, this.observation,
  );

  factory ErpHistoricalTrendDay.parse(dynamic raw) {
    final json = _object(raw);
    final day = json['dayOfMonth'];
    final date = json['date'];
    if (day is! int || day < 1 || day > 31 ||
        date is! String || !validReportDay(date) ||
        int.parse(date.substring(8, 10)) != day) {
      throw const ErpHistoricalReportError('INVALID_TREND_DATE');
    }
    return ErpHistoricalTrendDay._(
      day, date, ErpReportPeriod.parse(json),
    );
  }
}

class ErpHistoricalYear {
  final int year;
  final String date;
  final String sourceCoverage;
  final ErpReportPeriod daily;
  final ErpReportPeriod monthToDate;
  final List<ErpHistoricalTrendDay> dailySeries;
  const ErpHistoricalYear._(
    this.year, this.date, this.sourceCoverage, this.daily, this.monthToDate,
    this.dailySeries,
  );

  factory ErpHistoricalYear.parse(dynamic value) {
    final json = _object(value);
    final year = json['year'];
    final day = json['date'];
    if (year is! int || year < 2002 || year > 9999 ||
        day is! String || !validReportDay(day) ||
        int.parse(day.substring(0, 4)) != year ||
        json['sourceCoverage'] != 'UNATTESTED') {
      throw const ErpHistoricalReportError('INVALID_COVERAGE');
    }
    final daily = ErpReportPeriod.parse(json['daily']);
    final monthly = ErpReportPeriod.parse(json['monthToDate']);
    final rawSeries = json['dailySeries'];
    // Older V1 fixtures can omit the optional trend. If included, every
    // day must be present and last-day totals must match the daily summary.
    final series = rawSeries == null
        ? <ErpHistoricalTrendDay>[]
        : rawSeries is List
            ? rawSeries.map(ErpHistoricalTrendDay.parse).toList(growable: false)
            : throw const ErpHistoricalReportError('INVALID_TREND');
    if (rawSeries != null) {
      final lastDay = int.parse(day.substring(8, 10));
      if (series.length != lastDay) {
        throw const ErpHistoricalReportError('INVALID_TREND_LENGTH');
      }
      for (var index = 0; index < series.length; index++) {
        if (series[index].date != day.substring(0, 8) +
              (index + 1).toString().padLeft(2, '0')) {
          throw const ErpHistoricalReportError('INVALID_TREND_ORDER');
        }
      }
      final last = series.last.observation;
      final current = daily.totals;
      if (last.availability != daily.availability ||
          (current == null) != (last.totals == null) ||
          (current != null && reportFields.any((k) =>
            current[k] != last.totals![k]))) {
        throw const ErpHistoricalReportError('INVALID_TREND_SUMMARY');
      }
    }
    return ErpHistoricalYear._(
      year, day, 'UNATTESTED', daily, monthly,
      List.unmodifiable(series),
    );
  }
}

class ErpHistoricalRates {
  final int againstYear;
  final Map<String, int?> daily;
  final Map<String, int?> monthToDate;
  const ErpHistoricalRates._(
    this.againstYear, this.daily, this.monthToDate,
  );

  factory ErpHistoricalRates.parse(dynamic value) {
    final json = _object(value);
    final year = json['againstYear'];
    if (year is! int ||
        json['percentageUnit'] != 'BASIS_POINTS_100_EQUALS_1_PERCENT') {
      throw const ErpHistoricalReportError('INVALID_RATES');
    }
    Map<String, int?> parseRates(dynamic raw) {
      final values = _object(raw);
      if (growthFields.any((name) => !values.containsKey(name) ||
          (values[name] != null && values[name] is! int))) {
        throw const ErpHistoricalReportError('INVALID_RATES');
      }
      return Map.unmodifiable({
        for (final name in growthFields) name: values[name] as int?,
      });
    }
    return ErpHistoricalRates._(
      year, parseRates(json['daily']), parseRates(json['monthToDate']),
    );
  }
}

class ErpHistoricalComparison {
  final List<ErpHistoricalYear> years;
  final List<ErpHistoricalRates> comparisons;
  const ErpHistoricalComparison._(this.years, this.comparisons);

  factory ErpHistoricalComparison.parse(Map<String, dynamic> json,
      {required String requestedDay}) {
    if (json['report'] != 'INDEPENDENT_NEW_ERP_HISTORICAL_DAILY_AND_MTD_V1' ||
        json['referenceStatus'] != 'NOT_MATCHED_WITH_TRUSTSOFT' ||
        json['sourceCompletenessIndependentlyVerified'] != false ||
        json['formulasIndependentlyApproved'] != false ||
        json['functionalParityPercent'] != null ||
        json['years'] is! List || json['comparisons'] is! List) {
      throw const ErpHistoricalReportError('INVALID_RESPONSE');
    }
    final years = (json['years'] as List)
        .map(ErpHistoricalYear.parse).toList(growable: false);
    final comparisons = (json['comparisons'] as List)
        .map(ErpHistoricalRates.parse).toList(growable: false);
    if (years.length != 3 || comparisons.length != 2 ||
        years[0].date != requestedDay ||
        years[1].year != years[0].year - 1 ||
        years[2].year != years[0].year - 2 ||
        comparisons[0].againstYear != years[1].year ||
        comparisons[1].againstYear != years[2].year) {
      throw const ErpHistoricalReportError('INVALID_SEQUENCE');
    }
    return ErpHistoricalComparison._(
      List.unmodifiable(years), List.unmodifiable(comparisons),
    );
  }
}

/// An injected, authenticated reader. Tests can substitute an offline fake.
abstract interface class ErpHistoricalReportReader {
  Future<ErpHistoricalComparison> readHistoricalComparison({
    required String date,
    required String branchId,
    String? itemCode,
    String? familyCode,
    String? supplierCode,
  });
}
