import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/domain/erp_offline_worksheets.dart';

void main() {
  test('deposit uses counted not theoretical cash', () {
    const shift = PosWorksheetResult(95000, 92000);
    final actual = reconcileBankDeposit(
      shift: shift, retainedCash: 10000, declaredDeposit: 81999);
    expect(shift.differenceFils, -3000);
    expect(actual.expectedDepositFils, 82000);
    expect(actual.depositVarianceFils, -1);
  });
}
