import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/main.dart';
import 'package:jawafa_erp_ai/src/ui/erp_visual_system.dart';

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
    await tester.ensureVisible(
      find.byKey(const Key('group_procurementInventory')));
    await tester.tap(find.byKey(const Key('group_procurementInventory')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('menu_procurement')));
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

  testWidgets('approved dark ERP dashboard has five owner-required departments',
      (tester) async {
    await tester.pumpWidget(const JawafaErpApp());
    expect(find.byKey(const Key('erp_desktop_nav')), findsOneWidget);
    expect(find.byKey(const Key('erp_module_search')), findsOneWidget);
    expect(find.byKey(const Key('central_dashboard_link')), findsOneWidget);
    expect(centralDashboardUrl, 'https://amer-ai-store.github.io/Mohammad-Ahmed-Ghannam/index.html#erp-app');
    expect(find.text('لا توجد بيانات حية'), findsNWidgets(4));
    // The desktop menu is scrollable/lazily built. Verify the full
    // owner-approved catalog directly, and test one rendered navigation group.
    expect(ErpDepartment.values.length, 5);
    expect(erpDepartmentSpecs.keys.toList(), ErpDepartment.values);
    expect(erpDepartmentSpecs[ErpDepartment.accounting]!.name, 'المحاسبة');
    expect(erpDepartmentSpecs[ErpDepartment.procurementInventory]!.name,
        'المشتريات والمخزون');
    expect(find.byKey(const Key('group_accounting')), findsOneWidget);
  });

  testWidgets('department overview preserves accounting and HR workflows',
      (tester) async {
    await tester.pumpWidget(const JawafaErpApp());
    await tester.ensureVisible(find.byKey(const Key('group_accounting')));
    await tester.ensureVisible(find.byKey(const Key('menu_department_accounting')));
    await tester.tap(find.byKey(const Key('menu_department_accounting')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('landing_accounting')), findsOneWidget);
    expect(find.text('المدير المالي'), findsWidgets);
    expect(find.text('سندات القبض والصرف'), findsOneWidget);
    expect(find.text('ترحيل الموظفين'), findsOneWidget);
  });

  testWidgets('mobile navigation displays exactly five responsive ERP sections',
      (tester) async {
    tester.view.physicalSize = const Size(390, 780);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    await tester.pumpWidget(const JawafaErpApp());
    expect(find.byKey(const Key('erp_mobile_departments')), findsOneWidget);
    await tester.tap(find.text('الموظفون'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('landing_hr')), findsOneWidget);
    expect(find.textContaining('مدير شؤون الموظفين'), findsWidgets);
  });

}
