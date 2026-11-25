import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/ui/document_sequence_review_view.dart';

void main() {
  testWidgets('manual sequence audit shows bounded gaps and no fraud verdict',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: Scaffold(body: SingleChildScrollView(
        child: DocumentSequenceReviewView()))));
    await tester.enterText(
      find.byKey(const Key('audit_sequence_input')),
      '101,102,104,104',
    );
    final button = find.byKey(const Key('audit_sequence_analyze'));
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump();
    expect(find.byKey(const Key('audit_sequence_missing')), findsOneWidget);
    expect(find.textContaining('103'), findsWidgets);
    expect(find.textContaining('أرقام مكررة في الإدخال: 104'), findsOneWidget);
    expect(find.textContaining('ليس دليل حذف'), findsOneWidget);
    await tester.enterText(
      find.byKey(const Key('audit_sequence_input')),
      '1,2,3',
    );
    await tester.pump();
    expect(find.byKey(const Key('audit_sequence_missing')), findsNothing);
  });
}
