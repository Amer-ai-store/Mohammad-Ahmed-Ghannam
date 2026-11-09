import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/domain/legacy_cheque_event.dart';

void main() {
  test('the four common source descriptions are audit categories, not states', () {
    expect(
      LegacyChequeEventClassifier.classify('Paid Outcome Cheque'),
      LegacyChequeEventKind.paidOutgoingDescription,
    );
    expect(
      LegacyChequeEventClassifier.classify(' Update Due Date '),
      LegacyChequeEventKind.dueDateEditedDescription,
    );
    expect(
      LegacyChequeEventClassifier.classify('Paid Cheque'),
      LegacyChequeEventKind.paidDescription,
    );
    expect(
      LegacyChequeEventClassifier.classify('Cheque In Deposit'),
      LegacyChequeEventKind.depositDescription,
    );
  });

  test('deletion descriptions are redacted by classification', () {
    const raw = 'Delete Outcome Cheque No. TEST-100 Due 30/06/2025';
    final kind = LegacyChequeEventClassifier.classify(raw);
    final publicLabel = LegacyChequeEventClassifier.publicLabel(kind);
    expect(kind, LegacyChequeEventKind.deletionDescription);
    expect(publicLabel, contains('حذف'));
    expect(publicLabel, isNot(contains('TEST-100')));
    expect(publicLabel, isNot(contains('30/06/2025')));
    expect(LegacyChequeEventClassifier.classify('malformed'),
        LegacyChequeEventKind.unknownDescription);
  });

  test('aggregator retains only event class totals and no original details', () {
    const raw = [
      'Paid Outcome Cheque',
      'Paid Outcome Cheque',
      'Update Due Date',
      'Delete Outcome Cheque No. TEST-22',
    ];
    final byKind = LegacyChequeEventClassifier.aggregateDescriptions(raw);
    expect(byKind[LegacyChequeEventKind.paidOutgoingDescription], 2);
    expect(byKind[LegacyChequeEventKind.dueDateEditedDescription], 1);
    expect(byKind[LegacyChequeEventKind.deletionDescription], 1);
    expect(byKind.values.fold<int>(0, (a, b) => a + b), 4);
    expect(byKind.toString(), isNot(contains('TEST-22')));
    expect(() => byKind.clear(), throwsUnsupportedError);
  });

  test('source category counts reconcile to source movement total', () {
    // Aggregated baseline 2026-11-09; NOT a unit acceptance or 90% parity.
    final categories = <LegacyChequeEventKind, int>{
      LegacyChequeEventKind.paidOutgoingDescription: 8034,
      LegacyChequeEventKind.dueDateEditedDescription: 110,
      LegacyChequeEventKind.paidDescription: 85,
      LegacyChequeEventKind.depositDescription: 9,
      LegacyChequeEventKind.deletionDescription: 11,
    };
    expect(categories.values.reduce((a, b) => a + b), 8249);
  });
}
