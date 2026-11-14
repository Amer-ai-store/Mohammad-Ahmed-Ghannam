import 'package:flutter_test/flutter_test.dart';
import 'package:jawafa_erp_ai/src/domain/cheque.dart';

void main() {
  ChequeRecord make() => ChequeRecord(
    id: 'demo-1',
    direction: ChequeDirection.received,
    createdBy: 'maker',
    amountFils: 1000500,
  );
  ChequeCommand command(ChequeAction action, int id, {
    String actor = 'accountant',
    String? approver = 'supervisor',
    ErpRole role = ErpRole.accountant,
    ErpRole? approverRole = ErpRole.supervisor,
    String reason = 'مراجعة مستقلة تجريبية',
  }) => ChequeCommand(
    eventId: 'EV-$id',
    action: action,
    actorId: actor,
    actorRole: role,
    approverId: approver,
    approverRole: approverRole,
    at: DateTime.utc(2026, 11, 9, 1, id),
    reason: reason,
  );

  test('positive amount in fils and exact JOD formatting', () {
    expect(displayFils(1234567), '1234.567 JOD');
    expect(displayFils(-8), '-0.008 JOD');
    expect(() => ChequeRecord(id: 'c', direction: ChequeDirection.issued,
      createdBy: 'a', amountFils: 0), throwsArgumentError);
  });

  test('received cheque has immutable draft -> registered -> deposited -> cleared trail', () {
    final first = make();
    final registered = ChequePolicy.apply(first, command(ChequeAction.register, 1));
    final deposited = ChequePolicy.apply(registered, command(ChequeAction.deposit, 2));
    final cleared = ChequePolicy.apply(deposited, command(ChequeAction.clear, 3));
    expect(first.state, ChequeState.draft);
    expect(registered.events.length, 1);
    expect(cleared.state, ChequeState.cleared);
    expect(cleared.events.length, 3);
    expect(cleared.amountFils, first.amountFils);
    expect(() => cleared.events.clear(), throwsUnsupportedError);
    expect(ChequePolicy.available(cleared), isEmpty);
  });

  test('issued cheques require delivery, not bank deposit', () {
    final c = ChequeRecord(id: 'demo-out', direction: ChequeDirection.issued,
      createdBy: 'maker', amountFils: 50000);
    final registered = ChequePolicy.apply(c, command(ChequeAction.register, 1));
    expect(() => ChequePolicy.apply(registered, command(ChequeAction.deposit, 2)),
      throwsA(isA<ChequeRuleException>()));
    final delivered = ChequePolicy.apply(registered, command(ChequeAction.deliver, 2));
    expect(ChequePolicy.apply(delivered, command(ChequeAction.clear, 3)).state,
      ChequeState.cleared);
  });

  test('maker-checker, read-only auditor and duplicate events fail closed', () {
    final registered = ChequePolicy.apply(make(), command(ChequeAction.register, 1));
    expect(() => ChequePolicy.apply(registered, command(ChequeAction.deposit, 2,
      approver: 'accountant')), throwsA(isA<ChequeRuleException>()));
    expect(() => ChequePolicy.apply(registered, command(ChequeAction.deposit, 2,
      approver: 'maker')), throwsA(isA<ChequeRuleException>()));
    expect(() => ChequePolicy.apply(registered, command(ChequeAction.deposit, 2,
      role: ErpRole.auditor)), throwsA(isA<ChequeRuleException>()));
    expect(() => ChequePolicy.apply(registered, command(ChequeAction.register, 1)),
      throwsA(isA<ChequeRuleException>()));
    expect(() => ChequePolicy.apply(registered, command(ChequeAction.clear, 2)),
      throwsA(isA<ChequeRuleException>()));
  });

  test('missing reason and stale audit event timestamps are rejected', () {
    final registered = ChequePolicy.apply(make(), command(ChequeAction.register, 2));
    expect(() => ChequePolicy.apply(registered,
      command(ChequeAction.cancel, 3, reason: 'x')),
      throwsA(isA<ChequeRuleException>()));
    expect(() => ChequePolicy.apply(registered, command(ChequeAction.deposit, 1)),
      throwsA(isA<ChequeRuleException>()));
  });
}
