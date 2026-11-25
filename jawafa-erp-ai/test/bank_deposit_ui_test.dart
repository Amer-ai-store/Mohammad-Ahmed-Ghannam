import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/domain/erp_offline_worksheets.dart';
import 'package:jawafa_erp_ai/src/ui/bank_deposit_worksheet.dart';

void main() {
  testWidgets('bank deposit UI uses Arabic numerals and clears stale result',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: SingleChildScrollView(
        child: BankDepositWorksheetView(
          shift: PosWorksheetResult(95000, 92000))))));
    await tester.enterText(find.byKey(const Key('pos_retained_cash')), '١٠');
    await tester.enterText(find.byKey(const Key('pos_declared_deposit')), '٨٢');
    final btn = find.byKey(const Key('pos_reconcile_deposit'));
    await tester.ensureVisible(btn);
    await tester.tap(btn);
    await tester.pump();
    expect(find.byKey(const Key('pos_expected_deposit')), findsOneWidget);
    expect(find.textContaining('82.000'), findsWidgets);
    expect(find.textContaining('سند إيداع وكشف بنك مستقل'), findsOneWidget);
    await tester.enterText(find.byKey(const Key('pos_declared_deposit')), '٨١');
    await tester.pump();
    expect(find.byKey(const Key('pos_expected_deposit')), findsNothing);
  });
}
