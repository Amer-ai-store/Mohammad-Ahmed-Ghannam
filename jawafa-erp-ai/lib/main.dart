import 'package:flutter/material.dart';

import 'src/domain/cheque.dart';
import 'src/domain/journal.dart';

void main() => runApp(const JawafaErpApp());

class JawafaErpApp extends StatelessWidget {
  const JawafaErpApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'JAWAFA ERP AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF157B67),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF4F8F6),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF103C38),
          foregroundColor: Colors.white,
        ),
      ),
      home: const Directionality(
        textDirection: TextDirection.rtl,
        child: ErpShell(),
      ),
    );
  }
}

enum ErpArea {
  overview,
  cheques,
  journal,
  procurement,
  inventory,
  pointOfSale,
  audit,
  reports,
}

const areaLabels = <ErpArea, String>{
  ErpArea.overview: 'الرئيسية',
  ErpArea.cheques: 'الشيكات والبنوك',
  ErpArea.journal: 'الأستاذ العام',
  ErpArea.procurement: 'المشتريات',
  ErpArea.inventory: 'المخزون',
  ErpArea.pointOfSale: 'المبيعات ونقاط البيع',
  ErpArea.audit: 'سجل التدقيق',
  ErpArea.reports: 'التقارير',
};
const areaIcons = <ErpArea, IconData>{
  ErpArea.overview: Icons.dashboard_outlined,
  ErpArea.cheques: Icons.account_balance_wallet_outlined,
  ErpArea.journal: Icons.account_balance_outlined,
  ErpArea.procurement: Icons.shopping_cart_outlined,
  ErpArea.inventory: Icons.inventory_2_outlined,
  ErpArea.pointOfSale: Icons.point_of_sale_outlined,
  ErpArea.audit: Icons.verified_user_outlined,
  ErpArea.reports: Icons.bar_chart_outlined,
};

class ErpShell extends StatefulWidget {
  const ErpShell({super.key});
  @override
  State<ErpShell> createState() => _ErpShellState();
}

class _ErpShellState extends State<ErpShell> {
  ErpArea selected = ErpArea.overview;

  void select(ErpArea area, {bool closeDrawer = false}) {
    setState(() => selected = area);
    if (closeDrawer) Navigator.maybePop(context);
  }

  Widget navEntries({required bool mobile}) {
    return ListView(
      children: [
        const SizedBox(height: 24),
        const ListTile(
          leading: Icon(Icons.shield_outlined, color: Color(0xFF157B67)),
          title: Text('JAWAFA ERP AI', style: TextStyle(fontWeight: FontWeight.bold)),
          subtitle: Text('نظام مستقل · نسخة تأسيسية'),
        ),
        const Divider(),
        for (final entry in areaLabels.entries)
          ListTile(
            key: Key('menu_${entry.key.name}'),
            selected: selected == entry.key,
            selectedTileColor: const Color(0xFFE3F3EB),
            leading: Icon(areaIcons[entry.key]),
            title: Text(entry.value),
            onTap: () => select(entry.key, closeDrawer: mobile),
          ),
        const Divider(),
        const Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'دراسة TrustSoft بالقراءة فقط. لا اتصال مالي أو بنكي حي.',
            style: TextStyle(color: Color(0xFF6A7471), fontSize: 12),
          ),
        ),
      ],
    );
  }

  Widget currentContent() {
    switch (selected) {
      case ErpArea.overview:
        return const OverviewView();
      case ErpArea.cheques:
        return const ChequeDemoView();
      case ErpArea.journal:
        return const JournalDemoView();
      case ErpArea.procurement:
        return const PendingModuleView(
          title: 'دورة المشتريات',
          details: 'المورد ← أمر الشراء ← الاستلام ← الفاتورة ← المردود ← الترحيل.',
        );
      case ErpArea.inventory:
        return const PendingModuleView(
          title: 'المخزون',
          details: 'الأصناف والوحدات والتكلفة وحركة المخزون والتحويل والجرد.',
        );
      case ErpArea.pointOfSale:
        return const PendingModuleView(
          title: 'المبيعات ونقاط البيع',
          details: 'الفواتير والخصومات والإلغاء والمردود والصناديق والضريبة.',
        );
      case ErpArea.audit:
        return const PendingModuleView(
          title: 'التدقيق والرقابة',
          details: 'سجل أحداث غير قابل للتعديل، وفصل الصلاحيات وأدلة قبل/بعد.',
        );
      case ErpArea.reports:
        return const PendingModuleView(
          title: 'التقارير المحاسبية والتشغيلية',
          details: 'الميزان، الأستاذ، التدفق النقدي، الموردون، المخزون والشيكات.',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, size) {
      final wide = size.maxWidth >= 780;
      return Scaffold(
        appBar: AppBar(
          title: Text('JAWAFA ERP AI • ${areaLabels[selected]}'),
          actions: const [
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: Center(child: Text('FOUNDATION · 0.1', style: TextStyle(fontSize: 11))),
            ),
          ],
        ),
        drawer: wide ? null : Drawer(child: navEntries(mobile: true)),
        body: Row(
          children: [
            if (wide)
              SizedBox(
                width: 250,
                child: Material(
                  color: Colors.white,
                  child: navEntries(mobile: false),
                ),
              ),
            Expanded(
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: ListView(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF2D8),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'نسخة تجريبية مستقلة: جميع الأرقام والعمليات المعروضة محاكاة محلية. لا يتم إنشاء قيود مالية فعلية ولا ربط Jawafa_DB.',
                          key: Key('demo_banner'),
                        ),
                      ),
                      const SizedBox(height: 18),
                      currentContent(),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    });
  }
}

class OverviewView extends StatelessWidget {
  const OverviewView({super.key});

  @override
  Widget build(BuildContext context) {
    const features = [
      ('دورة الشيكات', 'نموذج حالات محلي مع فصل الاعتماد', true),
      ('القيود', 'قواعد توازن دقيقة بالفلسات', true),
      ('المشتريات', 'قيد تحليل الجداول والدورات', false),
      ('المخزون', 'قيد تحليل الجداول والدورات', false),
      ('المبيعات', 'قيد تحليل الجداول والدورات', false),
      ('الذكاء الاصطناعي', 'لن يُسمح بالترحيل الآلي دون اعتماد', false),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('نظام جوافة المحاسبي الجديد', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 6),
        const Text('بناء مستقل ومتعدد المنصات — يعمل على Windows وAndroid وiOS بعد التحقق من البناء.'),
        const SizedBox(height: 18),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final item in features)
              SizedBox(
                width: 285,
                child: Card(
                  color: Colors.white,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(item.$3 ? Icons.science_outlined : Icons.pending_actions,
                          color: item.$3 ? const Color(0xFF157B67) : Colors.orange),
                        const SizedBox(height: 12),
                        Text(item.$1, style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        Text(item.$2),
                        const SizedBox(height: 12),
                        Text(item.$3 ? 'اختبار أولي متاح' : 'غير منفذ بعد',
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

String chequeStateArabic(ChequeState state) => switch (state) {
  ChequeState.draft => 'مسودة',
  ChequeState.registered => 'مسجل',
  ChequeState.deposited => 'مودع',
  ChequeState.delivered => 'مسلم',
  ChequeState.cleared => 'مصروف',
  ChequeState.returned => 'مرتجع',
  ChequeState.cancelled => 'ملغى',
};

String chequeActionArabic(ChequeAction action) => switch (action) {
  ChequeAction.register => 'تسجيل',
  ChequeAction.deposit => 'إيداع',
  ChequeAction.deliver => 'تسليم',
  ChequeAction.clear => 'صرف',
  ChequeAction.returnCheque => 'إرجاع',
  ChequeAction.cancel => 'إلغاء',
};

class ChequeDemoView extends StatefulWidget {
  const ChequeDemoView({super.key});
  @override
  State<ChequeDemoView> createState() => _ChequeDemoViewState();
}

class _ChequeDemoViewState extends State<ChequeDemoView> {
  ChequeRecord cheque = ChequeRecord(
    id: 'DEMO-CH-001',
    direction: ChequeDirection.received,
    createdBy: 'demo-maker',
    amountFils: 1250000,
  );
  String? message;

  void simulate(ChequeAction action) {
    try {
      final eventCount = cheque.events.length + 1;
      final event = ChequeCommand(
        eventId: 'DEMO-EVENT-$eventCount',
        action: action,
        actorId: 'demo-accountant',
        actorRole: ErpRole.accountant,
        approverId: action == ChequeAction.register ? null : 'demo-supervisor',
        approverRole: action == ChequeAction.register ? null : ErpRole.supervisor,
        at: DateTime.now().toUtc().add(Duration(seconds: eventCount)),
        reason: 'محاكاة مستقلة دون مستند مالي حقيقي',
      );
      setState(() {
        cheque = ChequePolicy.apply(cheque, event);
        message = 'تم الانتقال داخل المحاكاة فقط، دون حفظ.';
      });
    } on ChequeRuleException catch (error) {
      setState(() => message = 'مرفوض: ${error.code}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final actions = ChequePolicy.available(cheque);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('دورة الشيكات — محاكاة', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('مرجع اصطناعي: ${cheque.id}'),
              Text('القيمة التجريبية: ${displayFils(cheque.amountFils)}'),
              Text('الحالة: ${chequeStateArabic(cheque.state)}', key: const Key('cheque_state')),
              const SizedBox(height: 12),
              Wrap(spacing: 8, children: [
                for (final action in actions)
                  OutlinedButton(
                    key: Key('cheque_action_${action.name}'),
                    onPressed: () => simulate(action),
                    child: Text(chequeActionArabic(action)),
                  ),
              ]),
              if (message != null) Text(message!, key: const Key('cheque_message')),
            ]),
          ),
        ),
        const SizedBox(height: 12),
        Text('سجل الأحداث داخل الذاكرة', style: Theme.of(context).textTheme.titleMedium),
        if (cheque.events.isEmpty) const Text('لا توجد أحداث بعد.'),
        for (final event in cheque.events)
          ListTile(
            title: Text('${chequeStateArabic(event.before)} → ${chequeStateArabic(event.after)}'),
            subtitle: Text('${event.actorId} · ${event.eventId} · ${event.at.toIso8601String()}'),
            trailing: const Icon(Icons.history),
          ),
      ],
    );
  }
}

class JournalDemoView extends StatefulWidget {
  const JournalDemoView({super.key});
  @override
  State<JournalDemoView> createState() => _JournalDemoViewState();
}

class _JournalDemoViewState extends State<JournalDemoView> {
  JournalValidation? result;
  void verify() {
    setState(() => result = JournalPolicy.validate(const [
      JournalLine(accountCode: '101-demo', debitFils: 1000200),
      JournalLine(accountCode: '201-demo', creditFils: 1000200),
    ]));
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('الأستاذ العام — فحص مسودة', style: Theme.of(context).textTheme.headlineSmall),
      const Text('يفحص توازن القيد بالفلسات دون الترحيل إلى أي قاعدة بيانات.'),
      const SizedBox(height: 12),
      FilledButton(onPressed: verify, child: const Text('اختبار توازن قيد اصطناعي')),
      if (result != null)
        Text(
          result!.valid ? 'القيد التجريبي متوازن · غير مرحل' : 'مرفوض: ${result!.code}',
          key: const Key('journal_result'),
        ),
    ]);
  }
}

class PendingModuleView extends StatelessWidget {
  final String title;
  final String details;
  const PendingModuleView({super.key, required this.title, required this.details});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(details),
          const SizedBox(height: 12),
          const Text('حالة التنفيذ: قيد الدراسة — لا توجد معاملات أو تقارير حية.'),
        ]),
      ),
    );
  }
}
