import 'package:flutter/material.dart';

import '../network/erp_historical_report.dart';
import 'erp_historical_comparison_view.dart';

import 'erp_visual_system.dart';

/// Metadata-only report registry. A visible report is NOT a verified TrustSoft
/// implementation and never confers database, printing or posting privileges.
enum ErpReportEvidence { discovered, importedUnattested, matched, accepted }

class ErpReportDefinition {
  final String id;
  final String title;
  final ErpDepartment department;
  final ErpReportEvidence evidence;
  final String referenceInfo;
  final List<String> sourceColumns;
  final List<String> knownGaps;

  const ErpReportDefinition({
    required this.id,
    required this.title,
    required this.department,
    required this.evidence,
    required this.referenceInfo,
    required this.sourceColumns,
    required this.knownGaps,
  });
}

// Only publicly safe schema metadata is kept in app source. No item codes,
// original finance amounts, supplier names or employee details are bundled.
const ownerReportCandidates = <ErpReportDefinition>[
  ErpReportDefinition(
    id: 'MONTHLY_ITEM_MOVEMENT',
    title: 'تقرير الحركات الشهرية للأصناف',
    department: ErpDepartment.procurementInventory,
    evidence: ErpReportEvidence.importedUnattested,
    referenceInfo:
      'ملف TXT محوّل إلى CSV. شاشة TrustSoft 135/136 مرشحة وغير مثبتة.',
    sourceColumns: <String>[
      'MonthYear', 'ItemCode', 'Item_Name',
      'Net_Sales_Before_Tax', 'Net_Sales_After_Tax',
      'Net_Purchase_Before_Tax', 'Net_Purchase_After_Tax',
      'Sales_Cost', 'Net_Sales_Cost', 'Net_Profit',
      'Profit_Markup_Per', 'Net_Profit_Markup_Per',
      'Net_Profit_Margin_Per', 'Profit_Margin_Per',
      'Sales_Qty', 'Receipt_Qty', 'Receipt_Value',
      'Withdrawals_Qty', 'Withdrawals_Value',
      'Stock_Net_Qty', 'Stock_Net_Value',
      'Total_Damage_Qty', 'Total_Damage_Cost',
      'Damage_from_Sales_Before_Tax_Per',
      'Damage_from_Net_Profit_Per', 'Damage_from_Sales_Cost_Per',
      'Dept_Withdrawals_Qty', 'Dept_Withdrawals_Cost',
      'Net_Purchase_Qty', 'Cost_Damage', 'Qty_Damage',
      'Cost_Installation Damage', 'Qty_Installation Damage',
      'Cost_Maintenance Damage', 'Qty_Maintenance Damage',
      'Family_Code', 'Family_Desc',
      'Supplier_Code', 'Supplier_Desc',
      'Class_Desc', 'Type_Desc', 'Country_Desc', 'Volume_Desc',
    ],
    knownGaps: <String>[
      '44 حقلًا مرجعيًا؛ 43 حقلًا في TXT، والمرشح الغائب Main_Barcode',
      'ثلاثة أعمدة تكلفة، منها Cost_Damage، مهيأة بنص ,0.000 وتحتاج تفسيرًا',
      'لا توجد مطابقة مستقلة لمعادلات الربح والتكاليف والضرائب',
      'لا يوجد ربط API مرخص ولا مقارنة مخرجات TrustSoft الحية',
    ],
  ),
];

class ErpReportCatalogView extends StatefulWidget {
  final ErpHistoricalReportReader? historicalReader;
  const ErpReportCatalogView({super.key, this.historicalReader});

  @override
  State<ErpReportCatalogView> createState() =>
      _ErpReportCatalogViewState();
}

class _ErpReportCatalogViewState extends State<ErpReportCatalogView> {
  String query = '';
  ErpDepartment? department;

  @override
  Widget build(BuildContext context) {
    final filtered = ownerReportCandidates.where((r) {
      final departmentMatches = department == null || r.department == department;
      final textMatches = query.isEmpty ||
          r.title.contains(query) ||
          r.id.toLowerCase().contains(query.toLowerCase());
      return departmentMatches && textMatches;
    }).toList();

    return Column(
      key: const Key('erp_reports_catalog'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('فهرس تقارير النظام', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        const Text(
          'كل تقرير له صفحة عرض مستقلة عند إثبات تعريفه ووظائفه. '
          'الفهرس المرجعي الكامل لم يُعتمد بعد؛ النسبة 90% غير مقاسة.',
          style: TextStyle(color: ErpPalette.muted),
        ),
        const SizedBox(height: 12),
        const ErpNonLiveBadge(),
        const SizedBox(height: 14),
        ErpHistoricalComparisonView(reader: widget.historicalReader),
        const SizedBox(height: 14),
        TextField(
          key: const Key('erp_reports_search'),
          onChanged: (value) => setState(() => query = value.trim()),
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            labelText: 'ابحث عن تقرير',
          ),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<ErpDepartment?>(
          key: const Key('erp_reports_department'),
          initialValue: department,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'المجموعة الرئيسية'),
          items: [
            const DropdownMenuItem<ErpDepartment?>(
              value: null, child: Text('كل الأقسام'),
            ),
            for (final entry in erpDepartmentSpecs.entries)
              DropdownMenuItem<ErpDepartment?>(
                value: entry.key, child: Text(entry.value.name),
              ),
          ],
          onChanged: (value) => setState(() => department = value),
        ),
        const SizedBox(height: 16),
        if (filtered.isEmpty)
          const ErpPanel(child: Text(
            'لا توجد تقارير موثقة ضمن هذه المعايير بعد. '
            'عدم الظهور لا يعني غياب التقرير من TrustSoft.',
          )),
        for (final report in filtered) ...[
          ErpPanel(
            child: ExpansionTile(
              key: Key('erp_report_${report.id}'),
              tilePadding: EdgeInsets.zero,
              leading: const Icon(Icons.description_outlined,
                color: ErpPalette.cyan),
              title: Text(report.title),
              subtitle: Text(report.referenceInfo,
                style: const TextStyle(color: ErpPalette.muted)),
              children: [
                const Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Text('الحالة: استيراد مرجع من المالك — لم تُثبت المطابقة',
                    style: TextStyle(color: ErpPalette.amber)),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: OutlinedButton.icon(
                    key: Key('erp_report_detail_open_${report.id}'),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ErpReportDetailScreen(report: report),
                      ),
                    ),
                    icon: const Icon(Icons.open_in_new),
                    label: const Text('فتح صفحة التقرير المخصصة — مرجع فقط'),
                  ),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Text('الحقول المرصودة (${report.sourceColumns.length})'),
                ),
                const SizedBox(height: 6),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final field in report.sourceColumns)
                    Chip(label: Text(field, style: const TextStyle(fontSize: 11))),
                ]),
                const SizedBox(height: 12),
                for (final gap in report.knownGaps)
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.error_outline,
                      color: ErpPalette.amber),
                    title: Text(gap),
                  ),
                const SizedBox(height: 12),
                const Text(
                  'لا توجد بيانات حية محملة. يلزم API موثق وصلاحية قراءة '
                  'ومطابقة الفلاتر قبل تمكين الطباعة أو التصدير.',
                  key: Key('erp_report_not_live'),
                ),
                const SizedBox(height: 8),
                const Row(children: [
                  OutlinedButton(
                    onPressed: null,
                    child: Text('طباعة — غير مفعلة'),
                  ),
                  SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: null,
                    child: Text('تصدير — غير مفعل'),
                  ),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}


/// The owner report has its OWN screen, rather than being only a catalog tile.
/// This deliberately does not authorize querying, printing, posting or exporting.
class ErpReportDetailScreen extends StatelessWidget {
  final ErpReportDefinition report;
  const ErpReportDetailScreen({super.key, required this.report});

  static const candidateFields = <String, String>{
    'MonthYear': 'day — مفتاح تاريخ مرشح',
    'ItemCode': 'item_code — مفتاح صنف مرشح',
    'Sales_Qty': 'sales_qty_milli — فرضية ×1000',
    'Net_Sales_Before_Tax': 'sales_before_tax_fils — فرضية ×1000',
    'Net_Sales_Cost': 'sales_cost_fils — فرضية ×1000',
    'Net_Profit': 'sales_profit_fils — فرضية ×1000',
  };

  @override
  Widget build(BuildContext context) {
    final all = report.sourceColumns;
    final numericProposals = all.where((f) =>
      candidateFields.containsKey(f) &&
      f != 'MonthYear' && f != 'ItemCode').length;
    final unmapped = all.length - candidateFields.length;
    return Scaffold(
      key: Key('erp_report_detail_screen_${report.id}'),
      appBar: AppBar(title: Text(report.title)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('صفحة التقرير المخصصة',
            style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const ErpNonLiveBadge(),
          const SizedBox(height: 12),
          const ErpPanel(
            child: Text(
              'شاشة مرجعية لفهرسة حقول تقرير المالك فقط. '
              'لا توجد بيانات ERP فعلية، ولا صلاحية SQL مثبتة، '
              'ولا مقارنة مع TrustSoft مقبولة. لا يجوز استعمال '
              'هذه الشاشة كإثبات تحقق نسبة 90%.',
              key: Key('erp_report_detail_no_live_data'),
            ),
          ),
          const SizedBox(height: 12),
          Text('الحقول المسجلة: ${all.length} | '
              'مفتاحا ربط مرشحان: 2 | '
              'مقارنات رقمية مرشحة: $numericProposals | '
              'حقول دون ربط: $unmapped | '
              'حقول معتمدة: 0',
              key: const Key('erp_report_field_counts')),
          const SizedBox(height: 16),
          Text('مرشحات التشغيل — معطلة حتى المصادقة والربط',
            style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final label in ['تاريخ البداية', 'تاريخ النهاية',
            'الصنف', 'المورد', 'العائلة']) ...[
            TextField(
              enabled: false,
              decoration: InputDecoration(labelText: label),
            ),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 8),
          const Wrap(spacing: 8, runSpacing: 8, children: [
            OutlinedButton(
              onPressed: null, child: Text('تشغيل التقرير — غير متاح')),
            OutlinedButton(
              onPressed: null, child: Text('تصدير CSV — غير متاح')),
            OutlinedButton(
              onPressed: null, child: Text('طباعة — غير متاحة')),
          ]),
          const SizedBox(height: 16),
          Text('فهرس حقول المرجع وحالة الربط',
            style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          const Text('كل ربط هنا فرضية فنية، لا مطابقة مالية أو ضريبية معتمدة.',
            style: TextStyle(color: ErpPalette.muted)),
          for (var index = 0; index < all.length; index++)
            ListTile(
              key: Key('erp_report_field_${index + 1}'),
              contentPadding: EdgeInsets.zero,
              title: Text('${index + 1}. ${all[index]}'),
              subtitle: Text(candidateFields[all[index]] ==
                  null ? 'غير مربوط — يحتاج تعريف مصدر ودلالة'
                  : '${candidateFields[all[index]]} — غير معتمد'),
              trailing: const Icon(Icons.pending_outlined,
                color: ErpPalette.amber),
            ),
          const SizedBox(height: 12),
          const Text('الخلية الـ44 الفارغة في TXT محفوظة كبنية مصدر. '
            'الجدول المرجعي الآخر يختلف ويتضمن Main_Barcode؛ '
            'لم تُعتمد مطابقة المخططين.'),
          const SizedBox(height: 12),
          for (final gap in report.knownGaps)
            ListTile(
              leading: const Icon(Icons.warning_amber_outlined,
                color: ErpPalette.amber),
              title: Text(gap),
            ),
        ],
      ),
    );
  }
}
