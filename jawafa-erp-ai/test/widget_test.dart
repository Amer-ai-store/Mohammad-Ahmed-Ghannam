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

  testWidgets('journal validation gives a test-only balanced verdict', (tester) async {
    await tester.pumpWidget(const JawafaErpApp());
    await tester.tap(find.byKey(const Key('menu_journal')));
    await tester.pump();
    await tester.tap(find.text('اختبار توازن قيد اصطناعي'));
    await tester.pump();
    expect(find.byKey(const Key('journal_result')), findsOneWidget);
    expect(find.textContaining('متوازن'), findsOneWidget);
  });
}
