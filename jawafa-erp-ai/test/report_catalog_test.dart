import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/ui/erp_report_catalog_view.dart';
import 'package:jawafa_erp_ai/src/ui/erp_visual_system.dart';

void main() {
  test('owner report reference has 43 fields and explicitly missing proof', () {
    expect(ownerReportCandidates.length, 1);
    final report = ownerReportCandidates.single;
    expect(report.id, 'MONTHLY_ITEM_MOVEMENT');
    expect(report.department, ErpDepartment.procurementInventory);
    expect(report.sourceColumns.length, 43);
    expect(report.sourceColumns.first, 'MonthYear');
    expect(report.sourceColumns.last, 'Volume_Desc');
    expect(report.sourceColumns, isNot(contains('Main_Barcode')));
    expect(report.evidence, ErpReportEvidence.importedUnattested);
    expect(report.knownGaps, isNotEmpty);
  });

  testWidgets('report catalog does not present owner uploaded data as live',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildErpTheme(),
      home: const Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          body: SingleChildScrollView(
            child: ErpReportCatalogView(),
          ),
        ),
      ),
    ));
    expect(find.byKey(const Key('erp_reports_catalog')), findsOneWidget);
    expect(find.textContaining('النسبة 90% غير مقاسة'), findsOneWidget);
    expect(find.byKey(const Key('erp_report_MONTHLY_ITEM_MOVEMENT')),
        findsOneWidget);
    await tester.tap(find.byKey(const Key('erp_report_MONTHLY_ITEM_MOVEMENT')));
    await tester.pumpAndSettle();
    expect(find.textContaining('الحقول المرصودة (43)'), findsOneWidget);
    expect(find.byKey(const Key('erp_report_not_live')), findsOneWidget);
    final printButton = tester.widget<OutlinedButton>(
      find.widgetWithText(OutlinedButton, 'طباعة — غير مفعلة'));
    final exportButton = tester.widget<OutlinedButton>(
      find.widgetWithText(OutlinedButton, 'تصدير — غير مفعل'));
    expect(printButton.onPressed, isNull);
    expect(exportButton.onPressed, isNull);
  });

  testWidgets('report search filters without inventing report data',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
      theme: buildErpTheme(),
      home: const Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(body: SingleChildScrollView(
          child: ErpReportCatalogView())),
      ),
    ));
    await tester.enterText(
      find.byKey(const Key('erp_reports_search')), 'تقرير غير موجود');
    await tester.pumpAndSettle();
    expect(find.textContaining('لا توجد تقارير موثقة'), findsOneWidget);
    expect(find.byKey(const Key('erp_report_MONTHLY_ITEM_MOVEMENT')),
        findsNothing);
  });
}
