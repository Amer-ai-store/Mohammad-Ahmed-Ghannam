/// Review manual voucher-number continuity without interpreting an
/// absent serial as deletion, fraud, monetary loss, or an accounting error.
/// All input is transient and typed by the operator (never imported from SQL).
class SequenceReviewValidation implements Exception {
  final String code;
  const SequenceReviewValidation(this.code);
  @override
  String toString() => 'SequenceReviewValidation($code)';
}

class DocumentSequenceReview {
  final int lowerBound;
  final int upperBound;
  final int uniqueCount;
  final List<int> missingNumbers;
  final List<int> duplicateNumbers;

  const DocumentSequenceReview({
    required this.lowerBound,
    required this.upperBound,
    required this.uniqueCount,
    required this.missingNumbers,
    required this.duplicateNumbers,
  });

  int get expectedSerialCount => upperBound - lowerBound + 1;
  bool get needsSourceReview =>
      missingNumbers.isNotEmpty || duplicateNumbers.isNotEmpty;
}

/// Comma separated positive decimal serials, not arbitrary account numbers.
/// Input range is capped because actual cancellation/branch/year series
/// cannot be inferred from a list of unverified serial values.
DocumentSequenceReview reviewDocumentSequence(String raw) {
  final source = raw.trim();
  if (source.isEmpty) throw const SequenceReviewValidation('EMPTY_SEQUENCE');
  if (source.length > 6000) {
    throw const SequenceReviewValidation('SEQUENCE_TEXT_TOO_LONG');
  }
  final tokens = source.split(',');
  if (tokens.length > 1000) {
    throw const SequenceReviewValidation('TOO_MANY_SERIALS');
  }
  final counts = <int, int>{};
  for (final token in tokens) {
    final text = token.trim();
    if (!RegExp(r'^[1-9][0-9]{0,8}$').hasMatch(text)) {
      throw const SequenceReviewValidation('INVALID_SERIAL');
    }
    final number = int.parse(text);
    counts[number] = (counts[number] ?? 0) + 1;
  }
  final sorted = counts.keys.toList()..sort();
  final lower = sorted.first;
  final upper = sorted.last;
  if (upper - lower > 5000) {
    throw const SequenceReviewValidation('SERIAL_RANGE_TOO_WIDE');
  }
  final missing = <int>[];
  for (int number = lower; number <= upper; number++) {
    if (!counts.containsKey(number)) missing.add(number);
  }
  final duplicate = sorted.where((value) => counts[value]! > 1).toList();
  return DocumentSequenceReview(
    lowerBound: lower,
    upperBound: upper,
    uniqueCount: sorted.length,
    missingNumbers: List.unmodifiable(missing),
    duplicateNumbers: List.unmodifiable(duplicate),
  );
}
