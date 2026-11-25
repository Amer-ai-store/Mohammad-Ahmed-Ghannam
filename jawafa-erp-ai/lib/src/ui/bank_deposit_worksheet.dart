import 'package:flutter/material.dart';

import '../domain/erp_offline_worksheets.dart';
import 'erp_visual_system.dart';

/// Standalone, volatile bank-deposit comparison of the POS shift's physical
/// cash count. It never reads a real bank statement or persists an amount.
class BankDepositWorksheetView extends StatefulWidget {
  final PosWorksheetResult shift;
  const BankDepositWorksheetView({super.key, required this.shift});

  @override
  State<BankDepositWorksheetView> createState() =>
      _BankDepositWorksheetViewState();
}

class _BankDepositWorksheetViewState extends State<BankDepositWorksheetView> {
  final retainedCash = TextEditingController();
  final declaredDeposit = TextEditingController();
  DepositWorksheetResult? result;
  String? error;

  @override
  void dispose() {
    retainedCash.dispose();
    declaredDeposit.dispose();
    super.dispose();
  }

  void calculate() {
    try {
      final checked = reconcileBankDeposit(
        shift: widget.shift,
        retainedCash: parseNonNegativeMilli(retainedCash.text),
        declaredDeposit: parseNonNegativeMilli(declaredDeposit.text),
      );
      setState(() {
        result = checked;
        error = null;
      });
    } on WorksheetValidation catch (e) {
      setState(() {
        result = null;
        error = e.code;
      });
    }
  }

  Widget amountInput(String keyName, String label,
      TextEditingController controller) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: TextField(
      key: Key(keyName),
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      onChanged: (_) => setState(() {
        result = null;
        error = null;
      }),
      decoration: InputDecoration(labelText: label),
    ),
  );

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: ErpPanel(child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('مطابقة الإيداع البنكي — محلية',
          style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        const Text('الإيداع المتوقع = النقد المعدود فعليًا − العهدة '
          'المحتفظ بها. فرق الجرد المحسوب سابقًا يبقى منفصلًا. '
          'لا تثبت هذه الورقة أن البنك استلم الإيداع.'),
        const SizedBox(height: 12),
        amountInput('pos_retained_cash',
          'العهدة المحتفظ بها في الصندوق (د.أ)', retainedCash),
        amountInput('pos_declared_deposit',
          'الإيداع المصرح به (د.أ)', declaredDeposit),
        FilledButton(
          key: const Key('pos_reconcile_deposit'),
          onPressed: calculate,
          child: const Text('قارن الإيداع بالنقد المعدود'),
        ),
        if (error != null)
          Text('تعذرت المقارنة: $error',
            key: const Key('pos_deposit_error')),
        if (result != null) ...[
          Text('المتوقع إيداعه: '
            '${formatMilli(result!.expectedDepositFils)} د.أ',
            key: const Key('pos_expected_deposit')),
          Text('فرق الإيداع: '
            '${formatMilli(result!.depositVarianceFils)} د.أ',
            key: const Key('pos_deposit_variance')),
          const Text('تحتاج النتيجة إلى سند إيداع وكشف بنك مستقل؛ '
            'ولا تعد بحد ذاتها خسارة أو مخالفة مالية مثبتة.'),
        ],
      ],
    )),
  );
}
