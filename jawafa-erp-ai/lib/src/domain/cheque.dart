/// Independent ERP prototype domain: events are append-only values in memory.
/// Real financial posting requires a separate authenticated transaction service.
enum ChequeDirection { received, issued }
enum ChequeState { draft, registered, deposited, delivered, cleared, returned, cancelled }
enum ChequeAction { register, deposit, deliver, clear, returnCheque, cancel }
enum ErpRole { clerk, accountant, supervisor, auditor }

class ChequeEvent {
  final String eventId;
  final ChequeState before;
  final ChequeState after;
  final String actorId;
  final String? approverId;
  final DateTime at;
  final String reason;

  const ChequeEvent({
    required this.eventId,
    required this.before,
    required this.after,
    required this.actorId,
    required this.approverId,
    required this.at,
    required this.reason,
  });
}

class ChequeRecord {
  final String id;
  final ChequeDirection direction;
  final String createdBy;
  /// Jordanian fils, exactly 1000 fils = 1 JOD. No floating point amounts.
  final int amountFils;
  final ChequeState state;
  final List<ChequeEvent> events;

  ChequeRecord({
    required this.id,
    required this.direction,
    required this.createdBy,
    required this.amountFils,
    this.state = ChequeState.draft,
    List<ChequeEvent> events = const [],
  }) : events = List.unmodifiable(events) {
    if (id.trim().isEmpty || createdBy.trim().isEmpty || amountFils <= 0) {
      throw ArgumentError('INVALID_CHEQUE_SOURCE');
    }
  }

  ChequeRecord _next(ChequeEvent event) => ChequeRecord(
    id: id,
    direction: direction,
    createdBy: createdBy,
    amountFils: amountFils,
    state: event.after,
    events: [...events, event],
  );
}

class ChequeCommand {
  final String eventId;
  final ChequeAction action;
  final String actorId;
  final ErpRole actorRole;
  final String? approverId;
  final ErpRole? approverRole;
  final String reason;
  final DateTime at;

  const ChequeCommand({
    required this.eventId,
    required this.action,
    required this.actorId,
    required this.actorRole,
    required this.at,
    this.approverId,
    this.approverRole,
    this.reason = '',
  });
}

class ChequeRuleException implements Exception {
  final String code;
  const ChequeRuleException(this.code);
  @override
  String toString() => 'ChequeRuleException($code)';
}

/// Approved direction-dependent state graph for the PROTOTYPE.
/// TrustSoft state-machine equivalence is NOT YET VERIFIED.
class ChequePolicy {
  static ChequeRecord apply(ChequeRecord current, ChequeCommand command) {
    if (command.eventId.trim().isEmpty || command.actorId.trim().isEmpty) {
      throw const ChequeRuleException('EMPTY_IDENTITY_OR_EVENT_ID');
    }
    if (!command.at.isUtc) {
      throw const ChequeRuleException('UTC_EVENT_TIME_REQUIRED');
    }
    if (current.events.any((e) => e.eventId == command.eventId)) {
      throw const ChequeRuleException('DUPLICATE_EVENT_ID');
    }
    if (current.events.isNotEmpty &&
        !command.at.isAfter(current.events.last.at)) {
      throw const ChequeRuleException('NON_MONOTONIC_EVENT_TIME');
    }
    if (command.actorRole == ErpRole.auditor) {
      throw const ChequeRuleException('AUDITOR_IS_READ_ONLY');
    }

    final next = _transition(current.direction, current.state, command.action);
    if (next == null) {
      throw const ChequeRuleException('TRANSITION_FORBIDDEN');
    }

    final sensitive = command.action != ChequeAction.register;
    if (sensitive) {
      if (command.actorRole != ErpRole.accountant &&
          command.actorRole != ErpRole.supervisor) {
        throw const ChequeRuleException('ACCOUNTING_ROLE_REQUIRED');
      }
      if (command.approverRole != ErpRole.supervisor ||
          command.approverId == null ||
          command.approverId!.trim().isEmpty ||
          command.approverId == command.actorId ||
          command.approverId == current.createdBy) {
        throw const ChequeRuleException('INDEPENDENT_APPROVAL_REQUIRED');
      }
    }
    if ((command.action == ChequeAction.returnCheque ||
         command.action == ChequeAction.cancel) &&
         command.reason.trim().length < 8) {
      throw const ChequeRuleException('EXPLANATION_REQUIRED');
    }
    return current._next(ChequeEvent(
      eventId: command.eventId,
      before: current.state,
      after: next,
      actorId: command.actorId,
      approverId: sensitive ? command.approverId : null,
      at: command.at,
      reason: command.reason.trim(),
    ));
  }

  static ChequeState? _transition(
    ChequeDirection direction, ChequeState from, ChequeAction action,
  ) {
    if (from == ChequeState.draft && action == ChequeAction.register) {
      return ChequeState.registered;
    }
    if ((from == ChequeState.draft || from == ChequeState.registered) &&
        action == ChequeAction.cancel) {
      return ChequeState.cancelled;
    }
    if (from == ChequeState.registered && direction == ChequeDirection.received &&
        action == ChequeAction.deposit) {
      return ChequeState.deposited;
    }
    if (from == ChequeState.registered && direction == ChequeDirection.issued &&
        action == ChequeAction.deliver) {
      return ChequeState.delivered;
    }
    if (((direction == ChequeDirection.received && from == ChequeState.deposited) ||
         (direction == ChequeDirection.issued && from == ChequeState.delivered))) {
      if (action == ChequeAction.clear) return ChequeState.cleared;
      if (action == ChequeAction.returnCheque) return ChequeState.returned;
    }
    return null;
  }

  static List<ChequeAction> available(ChequeRecord cheque) {
    return ChequeAction.values.where(
      (action) => _transition(cheque.direction, cheque.state, action) != null,
    ).toList(growable: false);
  }
}

String displayFils(int amountFils) {
  final sign = amountFils < 0 ? '-' : '';
  final abs = amountFils.abs();
  final dinars = abs ~/ 1000;
  final fils = (abs % 1000).toString().padLeft(3, '0');
  return '$sign$dinars.$fils JOD';
}
