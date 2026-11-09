import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/main.dart';

void main() {
  testWidgets('independent ERP shell declares DEMO limitations', (tester) async {
    await tester.pumpWidget(const JawafaErpApp());
    expect(find.text('JAWAFA ERP AI'), findsWidgets);
    expect(find.byKey(const Key('demo_banner')), findsOneWidget);
    expect(find.textContaining('لا يتم إنشاء قيود مالية فعلية'), findsOneWidget);
  });

  testWidgets('cheque state machine UI functions without persistence', (tester) async {
    await tester.pumpWidget(const JawafaErpApp());
    await tester.tap(find.byKey(const Key('menu_cheques')));
    await tester.pump();
    expect(find.textContaining('DEMO-CH-001'), findsOneWidget);
    await tester.tap(find.byKey(const Key('cheque_action_register')));
    await tester.pump();
    expect(find.byKey(const Key('cheque_state')), findsOneWidget);
    expect(find.text('الحالة: مسجل'), findsOneWidget);
    expect(find.textContaining('دون حفظ'), findsOneWidget);
  });

  testWidgets('procurement tab is read-only and clearly unconfigured without login',
      (tester) async {
    await tester.pumpWidget(const JawafaErpApp());
    await tester.tap(find.byKey(const Key('menu_procurement')));
    await tester.pump();
    expect(find.byKey(const Key('procurement_unconfigured')), findsOneWidget);
    expect(find.textContaining('لا يرحّل قيودًا'), findsOneWidget);
    expect(find.byKey(const Key('procurement_refresh')), findsNothing);
  });

  testWidgets('journal validation gives a test-only balanced verdict', (tester) async {
    await tester.pumpWidget(const JawafaErpApp());
    await tester.tap(find.byKey(const Key('menu_journal')));
    await tester.pump();
    await tester.tap(find.text('اختبار توازن قيد اصطناعي'));
    await tester.pump();
    expect(find.byKey(const Key('journal_result')), findsOneWidget);
    expect(find.textContaining('متوازن'), findsOneWidget);
  });
  for (final scope in ['personnel','permissions','settings']) {
    testWidgets('reference $scope is read-only and requires configured identity',
        (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: ErpReferenceReadOnlyView(gateway: null, scope: scope),
        ),
      ));
      expect(find.byKey(Key('reference_unconfigured_$scope')), findsOneWidget);
      expect(find.textContaining('مطابقة وظائف TrustSoft لم تُعتمد'), findsOneWidget);
      expect(find.byKey(Key('reference_refresh_$scope')), findsNothing);
    });
  }

}
