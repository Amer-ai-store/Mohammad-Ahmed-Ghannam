/// Exact-value double-entry journal validation in integer fils.
class JournalLine {
  final String accountCode;
  final int debitFils;
  final int creditFils;
  const JournalLine({
    required this.accountCode,
    this.debitFils = 0,
    this.creditFils = 0,
  });
}

class JournalValidation {
  final bool valid;
  final String code;
  final int debitTotalFils;
  final int creditTotalFils;

  const JournalValidation({
    required this.valid,
    required this.code,
    required this.debitTotalFils,
    required this.creditTotalFils,
  });
}

class JournalPolicy {
  static JournalValidation validate(List<JournalLine> lines) {
    final debit = lines.fold<int>(0, (value, line) => value + line.debitFils);
    final credit = lines.fold<int>(0, (value, line) => value + line.creditFils);
    JournalValidation result(bool pass, String code) => JournalValidation(
      valid: pass, code: code, debitTotalFils: debit, creditTotalFils: credit,
    );

    if (lines.length < 2) return result(false, 'JOURNAL_NEEDS_TWO_LINES');
    for (final line in lines) {
      if (line.accountCode.trim().isEmpty) {
        return result(false, 'ACCOUNT_REQUIRED');
      }
      if (line.debitFils < 0 || line.creditFils < 0 ||
          (line.debitFils == 0 && line.creditFils == 0) ||
          (line.debitFils > 0 && line.creditFils > 0)) {
        return result(false, 'INVALID_DEBIT_CREDIT_LINE');
      }
    }
    if (debit != credit) return result(false, 'UNBALANCED_JOURNAL');
    if (debit == 0) return result(false, 'EMPTY_JOURNAL');
    return result(true, 'BALANCED_DRAFT_ONLY');
  }
}
