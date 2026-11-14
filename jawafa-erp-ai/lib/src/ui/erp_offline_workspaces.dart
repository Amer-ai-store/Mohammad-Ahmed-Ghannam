import 'package:flutter/material.dart';

import '../domain/erp_offline_worksheets.dart';
import 'erp_visual_system.dart';

/// All three forms are volatile: no local disk, network, database or exports.
class _ManualField extends StatelessWidget {
  final String fieldKey;
  final String label;
  final TextEditingController controller;
  final bool numeric;
  const _ManualField({
    required this.fieldKey,
    required this.label,
    required this.controller,
    this.numeric = true,
  });

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: TextField(
      key: Key(fieldKey),
      controller: controller,
      keyboardType: numeric
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      decoration: InputDecoration(labelText: label),
    ),
  );
}

class InventoryWorksheetView extends StatefulWidget {
  const InventoryWorksheetView({super.key});
  @override
  State<InventoryWorksheetView> createState() => _InventoryWorksheetViewState();
}

class _InventoryWorksheetViewState extends State<InventoryWorksheetView> {
  final fields = <String, TextEditingController>{
    for (final name in [
      'opening', 'receipts', 'sales', 'returnIn', 'withdrawals', 'counted',
    ]) name: TextEditingController(),
  };
  InventoryWorksheetResult? result;
  String? error;

  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void calculate() {
    try {
      final values = fields.map((key, value) =>
          MapEntry(key, parseNonNegativeMilli(value.text)));
      final checked = reconcileInventory(
        opening: values['opening']!,
        receipts: values['receipts']!,
        sales: values['sales']!,
        returnIn: values['returnIn']!,
        withdrawals: values['withdrawals']!,
        counted: values['counted']!,
      );
      setState(() { result = checked; error = null; });
    } on WorksheetValidation catch (e) {
      setState(() { result = null; error = e.code; });
    }
  }

  @override
  Widget build(BuildContext context) {
    const labels = <String, String>{
      'opening': 'الرصيد الافتتاحي (كمية)',
      'receipts': 'الوارد',
      'sales': 'المبيعات الخارجة',
      'returnIn': 'المردودات الداخلة',
      'withdrawals': 'السحب أو التالف الخارج',
      'counted': 'الكمية المجرودة فعليًا',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('ورقة مطابقة المخزون — محلية',
          style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        const Text('أدخل بيانات صنف واحد من مستنداتك للتحقق الحسابي. '
          'المدخلات لا تُحفظ ولا تُرسل، والنتيجة ليست رصيدًا معتمدًا.'),
        const SizedBox(height: 12),
        ErpPanel(child: Column(children: [
          for (final entry in labels.entries)
            _ManualField(
              fieldKey: 'inventory_' + entry.key,
              label: entry.value,
              controller: fields[entry.key]!,
            ),
          FilledButton(
            key: const Key('inventory_calculate'),
            onPressed: calculate,
            child: const Text('احسب فرق الجرد محليًا'),
          ),
        ])),
        if (error != null)
          Text('تعذّر الحساب: ' + error!,
            key: const Key('inventory_error')),
        if (result != null)
          ErpPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('الكمية النظرية: ' + formatMilli(result!.expectedMilli),
                  key: const Key('inventory_expected')),
                Text('فرق الجرد (الفعلي − النظري): ' +
                  formatMilli(result!.varianceMilli),
                  key: const Key('inventory_variance')),
                if (result!.hasNegativeExpected)
                  const Text('تنبيه: الرصيد النظري سالب؛ راجع المدخلات والمستندات.'),
              ],
            ),
          ),
      ],
    );
  }
}

class PosShiftWorksheetView extends StatefulWidget {
  const PosShiftWorksheetView({super.key});
  @override
  State<PosShiftWorksheetView> createState() => _PosShiftWorksheetViewState();
}

class _PosShiftWorksheetViewState extends State<PosShiftWorksheetView> {
  final fields = <String, TextEditingController>{
    for (final name in [
      'openingFloat', 'grossSales', 'visa', 'cliq',
      'cashRefunds', 'cashPayouts', 'countedCash',
    ]) name: TextEditingController(),
  };
  PosWorksheetResult? result;
  String? error;

  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void calculate() {
    try {
      final values = fields.map((key, value) =>
          MapEntry(key, parseNonNegativeMilli(value.text)));
      final checked = reconcilePos(
        openingFloat: values['openingFloat']!,
        grossSales: values['grossSales']!,
        visa: values['visa']!,
        cliq: values['cliq']!,
        cashRefunds: values['cashRefunds']!,
        cashPayouts: values['cashPayouts']!,
        countedCash: values['countedCash']!,
      );
      setState(() { result = checked; error = null; });
    } on WorksheetValidation catch (e) {
      setState(() { result = null; error = e.code; });
    }
  }

  @override
  Widget build(BuildContext context) {
    const labels = <String, String>{
      'openingFloat': 'عهدة بداية الوردية (د.أ)',
      'grossSales': 'إجمالي مبيعات الوردية بكل وسائل الدفع (د.أ)',
      'visa': 'مدفوعات فيزا المشمولة بالإجمالي (د.أ)',
      'cliq': 'مدفوعات كليك المشمولة بالإجمالي (د.أ)',
      'cashRefunds': 'مردودات مدفوعة نقدًا (د.أ)',
      'cashPayouts': 'مصروفات مدفوعة من الصندوق (د.أ)',
      'countedCash': 'النقد المعدود عند الإقفال (د.أ)',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('تسوية وردية نقاط البيع — محلية',
          style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        const Text('الإجمالي يشمل نقدًا وفيزا وكليك. لا تخصم وسائل الدفع '
          'الإلكترونية مرة ثانية من المبيعات النقدية الصافية. '
          'أدخل الأرقام بنفس وحدة الدينار حتى ثلاثة منازل.'),
        const SizedBox(height: 12),
        ErpPanel(child: Column(children: [
          for (final entry in labels.entries)
            _ManualField(
              fieldKey: 'pos_' + entry.key,
              label: entry.value,
              controller: fields[entry.key]!,
            ),
          FilledButton(
            key: const Key('pos_calculate'),
            onPressed: calculate,
            child: const Text('احسب فرق الصندوق محليًا'),
          ),
        ])),
        if (error != null)
          Text('المدخلات غير متسقة: ' + error!,
            key: const Key('pos_error')),
        if (result != null)
          ErpPanel(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('النقد المتوقع: ' + formatMilli(result!.expectedCashFils) + ' د.أ',
                key: const Key('pos_expected')),
              Text('الزيادة أو النقص (المعدود − المتوقع): ' +
                formatMilli(result!.differenceFils) + ' د.أ',
                key: const Key('pos_difference')),
              const Text('هذه نتيجة حسابية للمدخلات وليست إيداعًا بنكيًا مثبتًا.'),
            ],
          )),
      ],
    );
  }
}

class AuditEvidenceWorksheetView extends StatefulWidget {
  const AuditEvidenceWorksheetView({super.key});
  @override
  State<AuditEvidenceWorksheetView> createState() => _AuditEvidenceWorksheetViewState();
}

class _AuditEvidenceWorksheetViewState extends State<AuditEvidenceWorksheetView> {
  final fields = <String, TextEditingController>{
    for (final name in [
      'username', 'device', 'reference', 'eventTime', 'independentEvidence',
    ]) name: TextEditingController(),
  };
  AuditWorksheetResult? result;

  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void evaluate() {
    setState(() {
      result = checkAuditCompleteness(
        username: fields['username']!.text,
        device: fields['device']!.text,
        reference: fields['reference']!.text,
        eventTime: fields['eventTime']!.text,
        independentEvidence: fields['independentEvidence']!.text,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    const labels = <String, String>{
      'username': 'المستخدم الظاهر في السجل',
      'device': 'معرف الجهاز',
      'reference': 'رقم السند أو القيد',
      'eventTime': 'وقت العملية مع المنطقة الزمنية (ISO 8601)',
      'independentEvidence': 'مرجع دليل مستقل متاح للتحقق',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('فحص اكتمال أدلة التدقيق — محلي',
          style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        const Text('هذا فحص اكتمال حقول فقط، لا يتحقق من صحة المستند '
          'ولا ينسب العملية إلى شخص. اسم المستخدم وحده ليس إثبات هوية. '
          'لا تدخل أسرارًا أو بيانات مالية شخصية في هذا النموذج.'),
        const SizedBox(height: 12),
        ErpPanel(child: Column(children: [
          for (final entry in labels.entries)
            _ManualField(
              fieldKey: 'audit_' + entry.key,
              label: entry.value,
              controller: fields[entry.key]!,
              numeric: false,
            ),
          FilledButton(
            key: const Key('audit_evaluate'),
            onPressed: evaluate,
            child: const Text('افحص اكتمال الحقول'),
          ),
        ])),
        if (result != null)
          ErpPanel(child: Text(
            result!.completeForReview
                ? 'الحقول موجودة مبدئيًا؛ مصداقية الأدلة وهوية المنفذ لم تثبت.'
                : 'حقول مفقودة أو وقت غير صالح: ' +
                    result!.missingFields.join(', '),
            key: const Key('audit_result'),
          )),
      ],
    );
  }
}
