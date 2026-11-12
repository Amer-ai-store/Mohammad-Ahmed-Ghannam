import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/network/erp_historical_report.dart';
import 'package:jawafa_erp_ai/src/ui/erp_historical_comparison_view.dart';

import 'historical_report_fixture.dart';

class FakeReader implements ErpHistoricalReportReader {
  bool fail = false;
  bool includeTrend = false;
  int count = 0;
  String? requestedDate;
  String? requestedBranch;
  String? requestedItem;

  @override
  Future<ErpHistoricalComparison> readHistoricalComparison({
    required String date, required String branchId,
    String? itemCode, String? familyCode, String? supplierCode,
  }) async {
    count++;
    requestedDate = date;
    requestedBranch = branchId;
    requestedItem = itemCode;
    if (fail) throw const ErpHistoricalReportError('NO_AUTH');
    return ErpHistoricalComparison.parse(
      syntheticHistoricalReport(missingOlderYear:true,
        includeDailySeries:includeTrend),
      requestedDay:date,
    );
  }
}

void main() {
  Widget page(ErpHistoricalReportReader? reader) => MaterialApp(
    home: Scaffold(
      body: SingleChildScrollView(child: ErpHistoricalComparisonView(
        reader: reader, initialDay:'2026-10-02',
      )),
    ),
  );

  testWidgets('without a configured OIDC gateway no report can be queried',
      (tester) async {
    await tester.pumpWidget(page(null));
    expect(find.byKey(const Key('erp_historical_compare_panel')),
      findsOneWidget);
    expect(find.byKey(const Key('erp_history_no_session')),
      findsOneWidget);
    expect(find.byKey(const Key('erp_history_refresh')), findsNothing);
    expect(find.byKey(const Key('erp_history_year_2026')), findsNothing);
  });

  testWidgets('authorized reader shows 2026/2025/2024 daily vs MTD separately',
      (tester) async {
    final fake = FakeReader();
    await tester.pumpWidget(page(fake));
    await tester.enterText(find.byKey(const Key('erp_history_branch')), 'BR-A');
    await tester.enterText(find.byKey(const Key('erp_history_item')), 'SKU-A');
    await tester.ensureVisible(find.byKey(const Key('erp_history_refresh')));
    await tester.tap(find.byKey(const Key('erp_history_refresh')));
    await tester.pumpAndSettle();
    expect(fake.count,1);
    expect(fake.requestedDate,'2026-10-02');
    expect(fake.requestedBranch,'BR-A');
    expect(fake.requestedItem,'SKU-A');
    expect(find.byKey(const Key('erp_history_year_2026')), findsOneWidget);
    expect(find.byKey(const Key('erp_history_year_2025')), findsOneWidget);
    expect(find.byKey(const Key('erp_history_year_2024')), findsOneWidget);
    expect(find.textContaining('250 فلس'), findsWidgets);
    expect(find.textContaining('550 فلس'), findsWidgets);
    expect(find.textContaining('غير مثبت الاكتمال'), findsWidgets);
    expect(find.textContaining('100.00%'), findsWidgets);
    expect(find.byKey(const Key('erp_history_no_posted_events')),
      findsWidgets);
  });

  testWidgets('failed authorization does not render any financial data',
      (tester) async {
    final fake = FakeReader()..fail = true;
    await tester.pumpWidget(page(fake));
    await tester.enterText(find.byKey(const Key('erp_history_branch')), 'BR-A');
    await tester.ensureVisible(find.byKey(const Key('erp_history_refresh')));
    await tester.tap(find.byKey(const Key('erp_history_refresh')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('erp_history_error')), findsOneWidget);
    expect(find.byKey(const Key('erp_history_year_2026')), findsNothing);
    expect(find.textContaining('SENSITIVE_PRIVATE_DATABASE_ROW'),
      findsNothing);
  });

  testWidgets('daily three-year sales trend displays missing days without fabricated zeros',
      (tester) async {
    final fake = FakeReader()..includeTrend = true;
    await tester.pumpWidget(page(fake));
    await tester.enterText(find.byKey(const Key('erp_history_branch')), 'BR-A');
    await tester.ensureVisible(find.byKey(const Key('erp_history_refresh')));
    await tester.tap(find.byKey(const Key('erp_history_refresh')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('erp_history_month_trend')),findsOneWidget);
    expect(find.byKey(const Key('erp_history_trend_day_01')),findsOneWidget);
    expect(find.byKey(const Key('erp_history_trend_day_02')),findsOneWidget);
    expect(find.textContaining('المقارنة حسب يوم الشهر'),findsOneWidget);
    expect(find.text('غير متوفر'),findsWidgets);
    expect(find.byType(LinearProgressIndicator),findsWidgets);
    expect(find.textContaining('غير مثبت الاكتمال'),findsWidgets);
  });

}
