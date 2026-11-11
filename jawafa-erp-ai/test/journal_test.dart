import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/domain/journal.dart';

void main() {
  test('balanced double-entry voucher uses integer fils', () {
    final result = JournalPolicy.validate(const [
      JournalLine(accountCode: '111', debitFils: 1250250),
      JournalLine(accountCode: '211', creditFils: 1250250),
    ]);
    expect(result.valid, true);
    expect(result.code, 'BALANCED_DRAFT_ONLY');
    expect(result.debitTotalFils, 1250250);
  });
  test('unbalanced journal cannot pass', () {
    final result = JournalPolicy.validate(const [
      JournalLine(accountCode: '111', debitFils: 1001),
      JournalLine(accountCode: '211', creditFils: 1000),
    ]);
    expect(result.valid, false);
    expect(result.code, 'UNBALANCED_JOURNAL');
  });
  test('negative values, empty account and both-sided entries cannot pass', () {
    expect(JournalPolicy.validate(const [
      JournalLine(accountCode: '', debitFils: 1000),
      JournalLine(accountCode: '211', creditFils: 1000),
    ]).code, 'ACCOUNT_REQUIRED');
    expect(JournalPolicy.validate(const [
      JournalLine(accountCode: 'a', debitFils: -1000),
      JournalLine(accountCode: 'b', creditFils: 1000),
    ]).code, 'INVALID_DEBIT_CREDIT_LINE');
    expect(JournalPolicy.validate(const [
      JournalLine(accountCode: 'a', debitFils: 1000, creditFils: 1000),
      JournalLine(accountCode: 'b', creditFils: 1000),
    ]).code, 'INVALID_DEBIT_CREDIT_LINE');
    expect(JournalPolicy.validate(const []).code, 'JOURNAL_NEEDS_TWO_LINES');
  });
}
