/// Client-only, volatile analysis worksheets. No SQL, HTTP, storage or posting.
/// Money uses integer Jordanian fils; quantities use thousandth units.
class WorksheetValidation implements Exception {
  final String code;
  const WorksheetValidation(this.code);
  @override
  String toString() => 'WorksheetValidation($code)';
}

// Accept Arabic/Eastern-Arabic numeral keyboards without allowing grouping marks.
// Arabic decimal separator U+066B is a decimal point, never a thousands mark.
String _normalizeDecimalNumerals(String value) {
  final output = StringBuffer();
  for (final code in value.trim().runes) {
    if (code >= 0x0660 && code <= 0x0669) {
      output.writeCharCode(0x30 + code - 0x0660);
    } else if (code >= 0x06F0 && code <= 0x06F9) {
      output.writeCharCode(0x30 + code - 0x06F0);
    } else if (code == 0x066B) {
      output.write('.');
    } else {
      output.writeCharCode(code);
    }
  }
  return output.toString();
}

int parseNonNegativeMilli(String value) {
  final s = _normalizeDecimalNumerals(value);
  if (!RegExp(r'^(0|[1-9]\d*)(\.\d{1,3})?$').hasMatch(s)) {
    throw const WorksheetValidation('INVALID_NONNEGATIVE_DECIMAL');
  }
  final parts = s.split('.');
  final whole = int.tryParse(parts.first);
  if (whole == null || whole > 100000000000) {
    throw const WorksheetValidation('VALUE_OUT_OF_RANGE');
  }
  final fraction = parts.length == 1 ? '000' : parts[1].padRight(3, '0');
  return whole * 1000 + int.parse(fraction);
}

String formatMilli(int value) {
  final sign = value < 0 ? '-' : '';
  final absolute = value.abs();
  return sign + (absolute ~/ 1000).toString() + '.' +
      (absolute % 1000).toString().padLeft(3, '0');
}

/// Manual quantities only. This is NOT a verified stock balance.
class InventoryWorksheetResult {
  final int expectedMilli;
  final int countedMilli;
  final int varianceMilli;
  const InventoryWorksheetResult(this.expectedMilli, this.countedMilli)
      : varianceMilli = countedMilli - expectedMilli;
  bool get hasNegativeExpected => expectedMilli < 0;
}

InventoryWorksheetResult reconcileInventory({
  required int opening,
  required int receipts,
  required int sales,
  required int returnIn,
  required int withdrawals,
  required int counted,
}) {
  if ([opening, receipts, sales, returnIn, withdrawals, counted]
      .any((v) => v < 0)) {
    throw const WorksheetValidation('NEGATIVE_INPUT');
  }
  final expected = opening + receipts + returnIn - sales - withdrawals;
  return InventoryWorksheetResult(expected, counted);
}

/// Gross sales include cash, Visa and CliQ. Refunds/payouts are cash-only.
class PosWorksheetResult {
  final int expectedCashFils;
  final int countedCashFils;
  const PosWorksheetResult(this.expectedCashFils, this.countedCashFils);
  int get differenceFils => countedCashFils - expectedCashFils;
}

PosWorksheetResult reconcilePos({
  required int openingFloat,
  required int grossSales,
  required int visa,
  required int cliq,
  required int cashRefunds,
  required int cashPayouts,
  required int countedCash,
}) {
  if ([openingFloat, grossSales, visa, cliq, cashRefunds,
    cashPayouts, countedCash].any((v) => v < 0)) {
    throw const WorksheetValidation('NEGATIVE_INPUT');
  }
  if (visa + cliq > grossSales) {
    throw const WorksheetValidation('NONCASH_EXCEEDS_GROSS');
  }
  final expected = openingFloat + grossSales - visa - cliq
      - cashRefunds - cashPayouts;
  if (expected < 0) {
    throw const WorksheetValidation('EXPECTED_CASH_NEGATIVE');
  }
  return PosWorksheetResult(expected, countedCash);
}

/// Completeness, NOT identity attribution or document authenticity.
class AuditWorksheetResult {
  final List<String> missingFields;
  const AuditWorksheetResult(this.missingFields);
  bool get completeForReview => missingFields.isEmpty;
}

// Reject invalid local calendar dates and normalized overflow timestamps.
bool _validZonedEventTime(String value) {
  final match = RegExp(
    r'^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$',
    caseSensitive: false,
  ).firstMatch(value);
  if (match == null || DateTime.tryParse(value) == null) return false;
  final year = int.parse(match.group(1)!);
  final month = int.parse(match.group(2)!);
  final day = int.parse(match.group(3)!);
  final date = DateTime.utc(year, month, day);
  return date.year == year && date.month == month && date.day == day;
}

AuditWorksheetResult checkAuditCompleteness({
  required String username,
  required String device,
  required String reference,
  required String eventTime,
  required String independentEvidence,
}) {
  final values = <String, String>{
    'username': username,
    'device': device,
    'reference': reference,
    'event_time': eventTime,
    'independent_evidence': independentEvidence,
  };
  final missing = values.entries
      .where((item) => item.value.trim().isEmpty)
      .map((item) => item.key)
      .toList(growable: false);
  final time = eventTime.trim();
  if (time.isNotEmpty && !_validZonedEventTime(time)) {
    return AuditWorksheetResult([...missing, 'valid_zoned_event_time']);
  }
  return AuditWorksheetResult(missing);
}
