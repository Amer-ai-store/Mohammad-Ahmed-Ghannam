import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/domain/document_sequence_review.dart';

void main() {
  group('independent voucher sequence review', () {
    test('reports gaps and duplicate serials without claiming deletion', () {
      final r = reviewDocumentSequence('101,102,104,104,106');
      expect(r.lowerBound, 101);
      expect(r.upperBound, 106);
      expect(r.uniqueCount, 4);
      expect(r.missingNumbers, [103,105]);
      expect(r.duplicateNumbers, [104]);
      expect(r.needsSourceReview, isTrue);
    });

    test('accepts a continuous sequence without false gaps', () {
      final r = reviewDocumentSequence('3,2,1');
      expect(r.missingNumbers, isEmpty);
      expect(r.duplicateNumbers, isEmpty);
      expect(r.needsSourceReview, isFalse);
    });

    test('rejects hostile, malformed or oversized input', () {
      for (final bad in [
        '',
        '-1,2',
        '0001,2',
        '1,2,3;DROP',
        '1,20000',
        '1,1.5',
      ]) {
        expect(() => reviewDocumentSequence(bad),
            throwsA(isA<SequenceReviewValidation>()),
            reason: bad);
      }
    });
  });
}
