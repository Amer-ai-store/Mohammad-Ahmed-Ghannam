import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/domain/erp_offline_worksheets.dart';
import 'package:jawafa_erp_ai/src/ui/erp_offline_workspaces.dart';

void main() {
  group('fixed-point decimal inputs', () {
    test('parses Jordanian fils and stock thousandths exactly', () {
      expect(parseNonNegativeMilli('12.345'), 12345);
      expect(parseNonNegativeMilli('0.010'), 10);
      expect(parseNonNegativeMilli('3'), 3000);
      expect(formatMilli(-12345), '-12.345');
      expect(formatMilli(1000), '1.000');
    });

    test('rejects negative, NaN, malformed and excessive precision', () {
      for (final invalid in ['-1', 'NaN', '1.2345', '1,234', '', '.5', '01']) {
        expect(() => parseNonNegativeMilli(invalid),
            throwsA(isA<WorksheetValidation>()), reason: invalid);
      }
    });
  });

  group('inventory worksheet', () {
    test('expected quantity and physical variance are deterministic', () {
      final r = reconcileInventory(
        opening: 100000, receipts: 25000, sales: 30000,
        returnIn: 5000, withdrawals: 10000, counted: 88000,
      );
      expect(r.expectedMilli, 90000);
      expect(r.varianceMilli, -2000);
      expect(r.hasNegativeExpected, isFalse);
    });

    test('flags theoretical negative without treating it as real loss', () {
      final r = reconcileInventory(
        opening: 0, receipts: 0, sales: 1000, returnIn: 0,
        withdrawals: 0, counted: 0,
      );
      expect(r.hasNegativeExpected, isTrue);
    });

    test('refuses negative entered quantities', () {
      expect(() => reconcileInventory(
        opening: -1, receipts: 0, sales: 0, returnIn: 0,
        withdrawals: 0, counted: 0,
      ), throwsA(isA<WorksheetValidation>()));
    });
  });

  group('POS shift worksheet', () {
    test('removes Visa and CliQ once and reconciles counted cash', () {
      final r = reconcilePos(
        openingFloat: 30000, grossSales: 120000,
        visa: 25000, cliq: 15000, cashRefunds: 5000,
        cashPayouts: 10000, countedCash: 95000,
      );
      // 30 + 120 - 25 - 15 - 5 - 10 = 95 dinars.
      expect(r.expectedCashFils, 95000);
      expect(r.differenceFils, 0);
    });

    test('detects shortage precisely in fils', () {
      final r = reconcilePos(
        openingFloat: 0, grossSales: 1001, visa: 0, cliq: 0,
        cashRefunds: 0, cashPayouts: 0, countedCash: 1000,
      );
      expect(r.differenceFils, -1);
    });

    test('blocks non-cash payments larger than total sales', () {
      expect(() => reconcilePos(
        openingFloat: 0, grossSales: 1000, visa: 900, cliq: 200,
        cashRefunds: 0, cashPayouts: 0, countedCash: 0,
      ), throwsA(isA<WorksheetValidation>()));
    });

    test('blocks negative expected physical cash', () {
      expect(() => reconcilePos(
        openingFloat: 0, grossSales: 1000, visa: 0, cliq: 0,
        cashRefunds: 2000, cashPayouts: 0, countedCash: 0,
      ), throwsA(isA<WorksheetValidation>()));
    });
  });

  group('audit completeness (no identity attribution)', () {
    test('requires independent reference and device', () {
      final r = checkAuditCompleteness(
        username: 'finance', device: '', reference: 'A-1',
        eventTime: '2026-11-14T12:00:00+03:00',
        independentEvidence: '',
      );
      expect(r.completeForReview, isFalse);
      expect(r.missingFields, containsAll(['device','independent_evidence']));
    });

    test('rejects timestamp lacking timezone', () {
      final r = checkAuditCompleteness(
        username: 'system', device: 'terminal-01', reference: 'A-1',
        eventTime: '2026-11-14T12:00:00',
        independentEvidence: 'signed document',
      );
      expect(r.missingFields, contains('valid_zoned_event_time'));
    });

    test('complete fields do not imply authenticity', () {
      final r = checkAuditCompleteness(
        username: 'system', device: 'terminal-01', reference: 'A-1',
        eventTime: '2026-11-14T12:00:00Z',
        independentEvidence: 'independent source ID',
      );
      expect(r.completeForReview, isTrue);
    });
  });

  testWidgets('offline workspaces visibly separate results from live systems',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(
      body: SingleChildScrollView(child: InventoryWorksheetView()),
    )));
    expect(find.textContaining('ليست رصيدًا معتمدًا'), findsOneWidget);
    expect(find.byKey(const Key('inventory_calculate')), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('inventory_calculate')));
    await tester.tap(find.byKey(const Key('inventory_calculate')));
    await tester.pump();
    expect(find.byKey(const Key('inventory_error')), findsOneWidget);
    expect(find.byKey(const Key('inventory_expected')), findsNothing);
  });

  testWidgets('POS and audit require user action before output', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Scaffold(
      body: SingleChildScrollView(child: PosShiftWorksheetView()),
    )));
    expect(find.byKey(const Key('pos_calculate')), findsOneWidget);
    expect(find.byKey(const Key('pos_expected')), findsNothing);
    await tester.pumpWidget(const MaterialApp(home: Scaffold(
      body: SingleChildScrollView(child: AuditEvidenceWorksheetView()),
    )));
    expect(find.byKey(const Key('audit_evaluate')), findsOneWidget);
    expect(find.byKey(const Key('audit_result')), findsNothing);
  });
}
