import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/ui/erp_report_catalog_view.dart';

void main() {
  testWidgets('monthly movement owns a dedicated non-live report page',
      (tester) async {
    final report = ownerReportCandidates.singleWhere(
      (item) => item.id == 'MONTHLY_ITEM_MOVEMENT');
    await tester.pumpWidget(MaterialApp(
      home: ErpReportDetailScreen(report: report),
    ));
    expect(find.byKey(const Key('erp_report_detail_screen_MONTHLY_ITEM_MOVEMENT')),
      findsOneWidget);
    expect(find.byKey(const Key('erp_report_detail_no_live_data')),
      findsOneWidget);
    expect(find.textContaining('43 | مفتاحا'), findsOneWidget);
    expect(find.textContaining('حقول دون ربط: 37'), findsOneWidget);
    expect(find.textContaining('حقول معتمدة: 0'), findsOneWidget);
    expect(report.sourceColumns.length, 43);
    expect(ErpReportDetailScreen.candidateFields.length, 6);
    expect(report.sourceColumns.first, 'MonthYear');
    expect(report.sourceColumns.last, 'Volume_Desc');
  });

  testWidgets('reference page gates live filters, printing and exporting',
      (tester) async {
    final report = ownerReportCandidates.first;
    await tester.pumpWidget(MaterialApp(
      home: ErpReportDetailScreen(report: report),
    ));
    final list = find.byType(Scrollable).first;
    final run = find.text('تشغيل التقرير — غير متاح');
    await tester.scrollUntilVisible(run, 240, scrollable: list);
    expect(tester.widget<OutlinedButton>(
      find.ancestor(of: run, matching: find.byType(OutlinedButton))),
      isA<OutlinedButton>().having((b) => b.onPressed, 'onPressed', null));
    final export = find.text('تصدير CSV — غير متاح');
    expect(tester.widget<OutlinedButton>(
      find.ancestor(of: export, matching: find.byType(OutlinedButton)))
        .onPressed, isNull);
    final print = find.text('طباعة — غير متاحة');
    expect(tester.widget<OutlinedButton>(
      find.ancestor(of: print, matching: find.byType(OutlinedButton)))
        .onPressed, isNull);
  });

  testWidgets('all source fields are represented and marked unapproved',
      (tester) async {
    final report = ownerReportCandidates.first;
    await tester.pumpWidget(MaterialApp(
      home: ErpReportDetailScreen(report: report),
    ));
    final list = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.byKey(const Key('erp_report_field_43')),
      350, scrollable: list, maxScrolls: 45,
    );
    expect(find.textContaining('43. Volume_Desc'), findsOneWidget);
    expect(find.textContaining('غير مربوط — يحتاج تعريف مصدر ودلالة'),
      findsWidgets);
    expect(find.textContaining('لا تُعتمد'), findsNothing);
  });
}
