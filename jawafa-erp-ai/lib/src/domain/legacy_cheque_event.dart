/// Source-event DESCRIPTION classifier for authorized TrustSoft export review.
///
/// These categories are NOT cheque states; the original free text may contain
/// cheque numbers and other private facts. Never echo raw event text into
/// GitHub, a telemetry payload, a public UI, or an AI prompt.
enum LegacyChequeEventKind {
  paidOutgoingDescription,
  dueDateEditedDescription,
  paidDescription,
  depositDescription,
  deletionDescription,
  unknownDescription,
}

class LegacyChequeEventClassifier {
  static LegacyChequeEventKind classify(String rawDescription) {
    final value = rawDescription.trim().toLowerCase();
    if (value == 'paid outcome cheque') {
      return LegacyChequeEventKind.paidOutgoingDescription;
    }
    if (value == 'update due date') {
      return LegacyChequeEventKind.dueDateEditedDescription;
    }
    if (value == 'paid cheque') {
      return LegacyChequeEventKind.paidDescription;
    }
    if (value == 'cheque in deposit') {
      return LegacyChequeEventKind.depositDescription;
    }
    if (value.startsWith('delete outcome cheque no.')) {
      return LegacyChequeEventKind.deletionDescription;
    }
    return LegacyChequeEventKind.unknownDescription;
  }

  static String publicLabel(LegacyChequeEventKind kind) => switch (kind) {
    LegacyChequeEventKind.paidOutgoingDescription => 'وصف صرف شيك صادر',
    LegacyChequeEventKind.dueDateEditedDescription => 'وصف تعديل تاريخ استحقاق',
    LegacyChequeEventKind.paidDescription => 'وصف صرف شيك',
    LegacyChequeEventKind.depositDescription => 'وصف إيداع شيك',
    LegacyChequeEventKind.deletionDescription => 'وصف حذف شيك — يحتاج اعتمادًا وأثرًا تاريخيًا',
    LegacyChequeEventKind.unknownDescription => 'وصف غير مصنّف — يحتاج مراجعة',
  };

  /// Public rollups only: never preserve raw strings or document identifiers.
  static Map<LegacyChequeEventKind, int> aggregateDescriptions(
    Iterable<String> descriptions,
  ) {
    final result = <LegacyChequeEventKind, int>{};
    for (final raw in descriptions) {
      final category = classify(raw);
      result[category] = (result[category] ?? 0) + 1;
    }
    return Map.unmodifiable(result);
  }
}
