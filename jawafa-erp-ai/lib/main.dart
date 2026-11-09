import 'package:flutter/material.dart';

import 'src/domain/cheque.dart';
import 'src/domain/journal.dart';
import 'src/network/erp_gateway_client.dart';

void main() => runApp(const JawafaErpApp());

class JawafaErpApp extends StatelessWidget {
  final ErpGatewayClient? gateway;
  const JawafaErpApp({super.key, this.gateway});

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
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: ErpShell(gateway: gateway),
      ),
    );
  }
}

enum ErpArea {
  overview,
  cheques,
  journal,
  procurement,
  personnel,
  permissions,
  settings,
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
  ErpArea.personnel: 'شؤون الموظفين',
  ErpArea.permissions: 'الصلاحيات',
  ErpArea.settings: 'الإعدادات',
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
  ErpArea.personnel: Icons.badge_outlined,
  ErpArea.permissions: Icons.admin_panel_settings_outlined,
  ErpArea.settings: Icons.settings_outlined,
  ErpArea.inventory: Icons.inventory_2_outlined,
  ErpArea.pointOfSale: Icons.point_of_sale_outlined,
  ErpArea.audit: Icons.verified_user_outlined,
  ErpArea.reports: Icons.bar_chart_outlined,
};

class ErpShell extends StatefulWidget {
  final ErpGatewayClient? gateway;
  const ErpShell({super.key, this.gateway});
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
        return ChequeDemoView(gateway: widget.gateway);
      case ErpArea.journal:
        return const JournalDemoView();
      case ErpArea.procurement:
        return ProcurementDraftView(gateway: widget.gateway);
      case ErpArea.personnel:
        return ErpReferenceReadOnlyView(gateway: widget.gateway, scope: 'personnel');
      case ErpArea.permissions:
        return ErpReferenceReadOnlyView(gateway: widget.gateway, scope: 'permissions');
      case ErpArea.settings:
        return ErpReferenceReadOnlyView(gateway: widget.gateway, scope: 'settings');
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
  final ErpGatewayClient? gateway;
  const ChequeDemoView({super.key, this.gateway});
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
  List<ErpRemoteCheque>? serverCheques;
  String? serverError;
  bool loadingServer = false;

  Future<void> loadServerCheques() async {
    final gateway = widget.gateway;
    if (gateway == null) return;
    setState(() {
      loadingServer = true;
      serverError = null;
    });
    try {
      final records = await gateway.readCheques();
      if (!mounted) return;
      setState(() => serverCheques = records);
    } on ErpGatewayError catch (error) {
      if (!mounted) return;
      setState(() => serverError = error.code);
    } finally {
      if (mounted) setState(() => loadingServer = false);
    }
  }

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
        if (widget.gateway == null)
          const Text(
            'اتصال API غير مفعل: يلزم مزود هوية معتمد وخادم ERP مستقل. المحاكاة أدناه لا تحفظ بيانات.',
            key: Key('gateway_not_configured'),
          )
        else ...[
          OutlinedButton.icon(
            key: const Key('gateway_read_cheques'),
            onPressed: loadingServer ? null : loadServerCheques,
            icon: const Icon(Icons.cloud_download_outlined),
            label: const Text('قراءة شيكات الشركة من API (بدون تعديل)'),
          ),
          if (loadingServer) const LinearProgressIndicator(),
          if (serverError != null)
            Text('تعذرت القراءة: $serverError', key: const Key('gateway_error')),
          if (serverCheques != null) ...[
            Text('نتائج قراءة API: ${serverCheques!.length}'),
            for (final record in serverCheques!)
              ListTile(
                title: Text(record.reference),
                subtitle: Text('${record.state} · ${record.amountFils} فلس'),
                trailing: const Icon(Icons.lock_outline),
              ),
          ],
        ],
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

class ProcurementDraftView extends StatefulWidget {
  final ErpGatewayClient? gateway;
  const ProcurementDraftView({super.key, this.gateway});

  @override
  State<ProcurementDraftView> createState() => _ProcurementDraftViewState();
}

class _ProcurementDraftViewState extends State<ProcurementDraftView> {
  bool loading = false;
  String? errorCode;
  List<ErpRemotePurchaseInvoice>? purchaseInvoices;

  Future<void> refreshReadOnly() async {
    final gateway = widget.gateway;
    if (gateway == null || loading) return;
    setState(() {
      loading = true;
      errorCode = null;
    });
    try {
      final result = await gateway.readPurchaseInvoices();
      if (!mounted) return;
      setState(() => purchaseInvoices = result);
    } on ErpGatewayError catch (error) {
      if (!mounted) return;
      setState(() => errorCode = error.code);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('الموردون وفواتير المشتريات',
            style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        const Text(
          'فحص مسودات الفواتير ومطابقة إجمالي البنود والضريبة. '
          'تُمنع الفواتير المكررة للمورد نفسه في قاعدة ERP الجديدة. '
          'هذا القسم للقراءة فقط، ولا يرحّل قيودًا.',
        ),
        const SizedBox(height: 14),
        if (widget.gateway == null)
          const Text(
            'API غير متصل: يلزم اعتماد تسجيل الدخول وخادم ERP مستقل.',
            key: Key('procurement_unconfigured'),
          )
        else ...[
          OutlinedButton.icon(
            key: const Key('procurement_refresh'),
            onPressed: loading ? null : refreshReadOnly,
            icon: const Icon(Icons.refresh_outlined),
            label: const Text('قراءة مسودات فواتير المشتريات'),
          ),
          if (loading) const LinearProgressIndicator(),
          if (errorCode != null)
            Text('تعذرت القراءة: $errorCode',
                key: const Key('procurement_api_error')),
          if (purchaseInvoices != null) ...[
            Text('عدد المسودات المعروضة: ${purchaseInvoices!.length}'),
            for (final invoice in purchaseInvoices!)
              Card(
                child: ListTile(
                  title: Text('فاتورة: ${invoice.originalNumber}'),
                  subtitle: Text(
                    'القيمة: ${invoice.totalFils} فلس · '
                    'الضريبة: ${invoice.taxFils} فلس · '
                    'البنود: ${invoice.lineCount}',
                  ),
                  trailing: Text(invoice.linesMatchTotal
                      ? 'المجموع مطابق'
                      : 'تحتاج تدقيقًا'),
                ),
              ),
          ],
        ],
      ],
    );
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


// This is an intentionally narrow, read-only reference shell. Not a full HR,
// payroll, attendance, user-management or TrustSoft-equivalent workflow.
class ErpReferenceReadOnlyView extends StatefulWidget {
  final ErpGatewayClient? gateway;
  final String scope;
  const ErpReferenceReadOnlyView({
    super.key, required this.gateway, required this.scope,
  });

  @override
  State<ErpReferenceReadOnlyView> createState() =>
      _ErpReferenceReadOnlyViewState();
}

class _ErpReferenceReadOnlyViewState extends State<ErpReferenceReadOnlyView> {
  List<Map<String, dynamic>>? rows;
  String? error;
  bool loading = false;

  String get title => switch (widget.scope) {
    'personnel' => 'شؤون الموظفين',
    'permissions' => 'الصلاحيات',
    'settings' => 'الإعدادات',
    _ => 'وحدة غير معروفة',
  };

  Future<void> load() async {
    final gateway = widget.gateway;
    if (gateway == null || loading) return;
    setState(() { loading = true; error = null; });
    try {
      final Future<List<Map<String, dynamic>>> request;
      switch (widget.scope) {
        case 'personnel':
          request = gateway.readPersonnel();
        case 'permissions':
          request = gateway.readPermissions();
        case 'settings':
          request = gateway.readSettings();
        default:
          throw const ErpGatewayError('INVALID_SCOPE');
      }
      final result = await request;
      if (mounted) setState(() => rows = result);
    } on ErpGatewayError catch (e) {
      if (mounted) setState(() => error = e.code);
    } catch (_) {
      if (mounted) setState(() => error = 'API_UNAVAILABLE');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 12),
        const Text(
          'نموذج قراءة فقط؛ مطابقة وظائف TrustSoft لم تُعتمد بعد. '
          'لا يوجد تعديل أو إضافة أو حذف أو رواتب فعلية.',
        ),
        const SizedBox(height: 12),
        if (widget.gateway == null)
          Text(
            'API غير مفعل: يلزم تسجيل دخول موثق وخادم ERP مستقل.',
            key: Key('reference_unconfigured_${widget.scope}'),
          )
        else ...[
          OutlinedButton.icon(
            key: Key('reference_refresh_${widget.scope}'),
            onPressed: loading ? null : load,
            icon: const Icon(Icons.refresh),
            label: const Text('قراءة البيانات المسموح بها'),
          ),
          if (loading) const LinearProgressIndicator(),
          if (error != null) Text(
            'تعذرت القراءة: $error',
            key: Key('reference_error_${widget.scope}'),
          ),
          if (rows != null) ...[
            Text('عدد السجلات الظاهرة: ${rows!.length}'),
            for (final row in rows!)
              ListTile(
                title: Text(widget.scope == 'personnel'
                  ? '${row['employee_code']}: ${row['display_name']}'
                  : widget.scope == 'settings'
                    ? '${row['setting_key']}: ${row['setting_value']}'
                    : '${row['erp_role']}: ${row['resource']}'),
                subtitle: Text(widget.scope == 'personnel'
                  ? '${row['department_code']} · ${row['employment_status']}'
                  : widget.scope == 'settings'
                    ? 'النسخة ${row['revision_no']}'
                    : '${row['action']} · ${row['allowed']}'),
              ),
          ],
        ],
      ],
    );
  }
}
