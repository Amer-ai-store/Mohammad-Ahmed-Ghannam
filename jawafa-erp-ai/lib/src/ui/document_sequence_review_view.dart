import 'package:flutter/material.dart';

import '../domain/document_sequence_review.dart';
import 'erp_visual_system.dart';

/// In-memory manual-only sequence review; never identifies a person or
/// concludes that a missing serial represents a deleted voucher.
class DocumentSequenceReviewView extends StatefulWidget {
  const DocumentSequenceReviewView({super.key});

  @override
  State<DocumentSequenceReviewView> createState() =>
      _DocumentSequenceReviewViewState();
}

class _DocumentSequenceReviewViewState
    extends State<DocumentSequenceReviewView> {
  final serials = TextEditingController();
  DocumentSequenceReview? result;
  String? error;

  @override
  void dispose() {
    serials.dispose();
    super.dispose();
  }

  void analyze() {
    try {
      final next = reviewDocumentSequence(serials.text);
      setState(() {
        result = next;
        error = null;
      });
    } on SequenceReviewValidation catch (e) {
      setState(() {
        result = null;
        error = e.code;
      });
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 16),
    child: ErpPanel(child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('فحص تسلسل أرقام السندات — يدوي',
          style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        const Text('أدخل سلسلة واحدة من أرقام السندات الصحيحة '
          'مفصولة بفاصلة لاتينية، من السنة والفرع والنوع نفسيهما فقط. '
          'لا تضع أسماء أو مبالغ أو بيانات خاصة.'),
        const SizedBox(height: 8),
        TextField(
          key: const Key('audit_sequence_input'),
          controller: serials,
          keyboardType: TextInputType.text,
          maxLines: 2,
          onChanged: (_) => setState(() {
            result = null;
            error = null;
          }),
          decoration: const InputDecoration(
            labelText: 'الأرقام (مثال: 101,102,104,104)',
          ),
        ),
        const SizedBox(height: 10),
        FilledButton(
          key: const Key('audit_sequence_analyze'),
          onPressed: analyze,
          child: const Text('راجع الفجوات والتكرار'),
        ),
        if (error != null)
          Text('تعذر الفحص: $error',
            key: const Key('audit_sequence_error')),
        if (result != null) ...[
          Text('عدد السندات الفريدة في القائمة: ${result!.uniqueCount}',
            key: const Key('audit_sequence_unique')),
          Text('أرقام غير واردة ضمن المجال: '
              '${result!.missingNumbers.join(', ')}',
            key: const Key('audit_sequence_missing')),
          Text('أرقام مكررة في الإدخال: '
              '${result!.duplicateNumbers.join(', ')}',
            key: const Key('audit_sequence_duplicates')),
          const SizedBox(height: 8),
          const Text('غياب رقم أو تكراره في هذه القائمة اليدوية '
            'ليس دليل حذف أو مخالفة أو خسارة. يلزم كشف المصدر '
            'وسجل الإلغاء والترحيل، مع التحقق من السنة والفرع '
            'ونوع السند والبيانات الأصلية قبل الحكم.'),
        ],
      ],
    )),
  );
}
