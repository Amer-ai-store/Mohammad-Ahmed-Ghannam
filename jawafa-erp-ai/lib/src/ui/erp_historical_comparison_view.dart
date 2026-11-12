import 'package:flutter/material.dart';

import '../network/erp_historical_report.dart';
import 'erp_visual_system.dart';

/// Read-only, independently calculated new-ERP comparison.
/// Never suggests that synthetic tests prove actual TrustSoft parity.
class ErpHistoricalComparisonView extends StatefulWidget {
  final ErpHistoricalReportReader? reader;
  final String? initialDay;
  const ErpHistoricalComparisonView({
    super.key, this.reader, this.initialDay,
  });

  @override
  State<ErpHistoricalComparisonView> createState() =>
      _ErpHistoricalComparisonViewState();
}

class _ErpHistoricalComparisonViewState
    extends State<ErpHistoricalComparisonView> {
  late final TextEditingController day;
  final branch = TextEditingController();
  final item = TextEditingController();
  final family = TextEditingController();
  final supplier = TextEditingController();
  bool busy = false;
  ErpHistoricalComparison? result;
  String? errorCode;
  String? requestedDay;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final defaultDay = now.year.toString().padLeft(4, '0') + '-' +
        now.month.toString().padLeft(2, '0') + '-' +
        now.day.toString().padLeft(2, '0');
    day = TextEditingController(text: widget.initialDay ?? defaultDay);
  }

  @override
  void dispose() {
    day.dispose();
    branch.dispose();
    item.dispose();
    family.dispose();
    supplier.dispose();
    super.dispose();
  }

  String? _optional(TextEditingController value) {
    final text = value.text.trim();
    return text.isEmpty ? null : text;
  }

  Future<void> load() async {
    if (busy || widget.reader == null) return;
    final date = day.text.trim();
    final branchId = branch.text.trim();
    setState(() {
      busy = true;
      result = null;
      requestedDay = null;
      errorCode = null;
    });
    try {
      final response = await widget.reader!.readHistoricalComparison(
        date: date, branchId: branchId,
        itemCode: _optional(item),
        familyCode: _optional(family),
        supplierCode: _optional(supplier),
      );
      if (!mounted) return;
      setState(() {
        result = response;
        requestedDay = date;
      });
    } catch (_) {
      if (!mounted) return;
      // Never echo HTTP response bodies, access tokens or financial rows.
      setState(() => errorCode = 'REPORT_UNAVAILABLE_OR_ACCESS_DENIED');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String amount(int? value, {String unit = 'فلس'}) {
    if (value == null) return 'غير متوفر';
    return value.toString() + ' ' + unit;
  }

  String percent(int? basisPoints) {
    if (basisPoints == null) return 'غير قابل للحساب';
    final absolute = basisPoints.abs();
    final whole = absolute ~/ 100;
    final decimals = (absolute % 100).toString().padLeft(2, '0');
    final prefix = basisPoints < 0 ? '-' : '+';
    return prefix + whole.toString() + '.' + decimals + '%';
  }

  Widget periodRow(ErpReportPeriod period, {required String label}) {
    final totals = period.totals;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
        if (totals == null)
          const Text('لا توجد حركات مرحلة في المصدر — لا يعني صفرًا',
            key: Key('erp_history_no_posted_events'),
            style: TextStyle(color: ErpPalette.amber)),
        if (totals != null) ...[
          Text('المبيعات قبل الضريبة: ' +
            amount(totals['sales_before_tax_fils'])),
          Text('تكلفة المبيعات: ' +
            amount(totals['sales_cost_fils'])),
          Text('هامش الربح المحسوب من الأحداث: ' +
            amount(totals['sales_profit_fils'])),
          Text('كمية المبيعات: ' +
            amount(totals['sales_qty_milli'], unit: 'ألف جزء وحدة')),
        ],
      ],
    );
  }

  int largestObservedTrendSale(ErpHistoricalComparison comparison) {
    var maximum = 1;
    for (final year in comparison.years) {
      for (final point in year.dailySeries) {
        final value = point.observation.totals?['sales_before_tax_fils'];
        if (value != null && value.abs() > maximum) maximum = value.abs();
      }
    }
    return maximum;
  }

  /// A missing observation is a dash, never a zero-sized "zero sales" bar.
  Widget historicalTrend(ErpHistoricalComparison comparison) {
    final years = comparison.years;
    if (years.any((year) => year.dailySeries.isEmpty)) {
      return const SizedBox.shrink();
    }
    final maximum = largestObservedTrendSale(comparison);
    return Column(
      key: const Key('erp_history_month_trend'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('اتجاه المبيعات اليومية قبل الضريبة — ثلاث سنوات',
          style: TextStyle(fontWeight: FontWeight.bold,
            color: ErpPalette.green)),
        const Text('المقارنة حسب يوم الشهر؛ الحركات غير المتوفرة'
          ' لا تُعرض على أنها مبيعات صفرية.',
          style: TextStyle(color: ErpPalette.amber)),
        const SizedBox(height: 8),
        for (var index = 0; index < years[0].dailySeries.length; index++) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              key: Key('erp_history_trend_day_' +
                (index + 1).toString().padLeft(2, '0')),
              children: [
                SizedBox(width: 30, child: Text(
                  (index + 1).toString().padLeft(2, '0'))),
                for (final year in years)
                  Expanded(child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(year.year.toString(),
                          style: const TextStyle(fontSize: 10,
                            color: ErpPalette.muted)),
                        if (year.dailySeries[index]
                            .observation.totals?['sales_before_tax_fils']
                            case final int sales) ...[
                          LinearProgressIndicator(
                            value: (sales.abs() / maximum)
                              .clamp(0.0, 1.0).toDouble(),
                            color: sales < 0
                                ? ErpPalette.amber : ErpPalette.green,
                            backgroundColor: ErpPalette.raised,
                            minHeight: 6,
                          ),
                          Text(amount(sales),
                            style: const TextStyle(fontSize: 10)),
                        ] else
                          const Text('غير متوفر',
                            style: TextStyle(fontSize: 10,
                              color: ErpPalette.amber)),
                      ],
                    ),
                  )),
              ],
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final response = result;
    return ErpPanel(
      child: Column(
        key: const Key('erp_historical_compare_panel'),
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('مقارنة اليوم والتراكم مع السنتين السابقتين',
            style: TextStyle(fontWeight: FontWeight.w800,
              fontSize: 17, color: ErpPalette.green)),
          const SizedBox(height: 8),
          const Text(
            'حساب مستقل من أحداث ERP الجديدة، غير مطابق أو معتمد '
            'مع TrustSoft. غياب الحركات لا يثبت أن قيمتها صفر.',
            style: TextStyle(color: ErpPalette.muted)),
          const SizedBox(height: 10),
          if (widget.reader == null) ...[
            const Text(
              'غير متصل: يلزم تسجيل دخول OIDC فعلي، '
              'واتصال HTTPS خاص، وصلاحية قراءة على الفرع.',
              key: Key('erp_history_no_session'),
              style: TextStyle(color: ErpPalette.amber)),
          ] else ...[
            TextField(
              key: const Key('erp_history_day'),
              controller: day,
              enabled: !busy,
              decoration: const InputDecoration(
                labelText: 'اليوم (YYYY-MM-DD)')),
            const SizedBox(height: 8),
            TextField(
              key: const Key('erp_history_branch'),
              controller: branch,
              enabled: !busy,
              decoration: const InputDecoration(
                labelText: 'رمز الفرع المصرح به')),
            const SizedBox(height: 8),
            TextField(
              key: const Key('erp_history_item'),
              controller: item,
              enabled: !busy,
              decoration: const InputDecoration(
                labelText: 'رمز الصنف (اختياري)')),
            const SizedBox(height: 8),
            TextField(
              key: const Key('erp_history_family'),
              controller: family,
              enabled: !busy,
              decoration: const InputDecoration(
                labelText: 'العائلة (اختياري)')),
            const SizedBox(height: 8),
            TextField(
              key: const Key('erp_history_supplier'),
              controller: supplier,
              enabled: !busy,
              decoration: const InputDecoration(
                labelText: 'المورد (اختياري)')),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              key: const Key('erp_history_refresh'),
              onPressed: busy ? null : load,
              icon: const Icon(Icons.query_stats),
              label: const Text('قراءة المقارنة بصلاحية المستخدم'),
            ),
            if (busy)
              const LinearProgressIndicator(key: Key('erp_history_loading')),
            if (errorCode != null)
              const Text('تعذرت القراءة أو الصلاحية غير متاحة. '
                'لم يتم تحميل قيم مالية.',
                key: Key('erp_history_error'),
                style: TextStyle(color: ErpPalette.amber)),
          ],
          if (response != null) ...[
            const SizedBox(height: 14),
            Text('الفترة المقروءة: ' + (requestedDay ?? ''),
              key: const Key('erp_history_loaded_day')),
            const Text('اكتمال المصدر غير مثبت؛ هذه ليست '
              'مطابقة محاسبية أو ضريبية معتمدة.',
              style: TextStyle(color: ErpPalette.amber)),
            for (final year in response.years) ...[
              const SizedBox(height: 10),
              ErpPanel(
                child: Column(
                  key: Key('erp_history_year_' + year.year.toString()),
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(year.year.toString(),
                      style: const TextStyle(fontSize: 18,
                        color: ErpPalette.green)),
                    periodRow(year.daily,
                      label: 'نفس اليوم: ' + year.date),
                    const Divider(),
                    periodRow(year.monthToDate,
                      label: 'من بداية الشهر إلى اليوم'),
                    const Text('مصدر أحداث غير مثبت الاكتمال',
                      style: TextStyle(color: ErpPalette.amber)),
                  ],
                ),
              ),
            ],
            historicalTrend(response),
            for (final change in response.comparisons) ...[
              const SizedBox(height: 8),
              Text('مقارنة مع ' + change.againstYear.toString(),
                style: const TextStyle(fontWeight: FontWeight.bold)),
              Text('تغير مبيعات اليوم: ' +
                percent(change.daily['sales_before_tax_fils'])),
              Text('تغير المبيعات التراكمية: ' +
                percent(change.monthToDate['sales_before_tax_fils'])),
            ],
          ],
        ],
      ),
    );
  }
}
