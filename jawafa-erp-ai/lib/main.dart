import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'src/domain/cheque.dart';
import 'src/domain/journal.dart';
import 'src/network/erp_gateway_client.dart';
import 'src/ui/erp_visual_system.dart';
import 'src/ui/erp_report_catalog_view.dart';

// Keep canonical production navigation as default. Pre-release QA can compile
// an SSO-protected dashboard URL with --dart-define=CENTRAL_DASHBOARD_URL=...
// No authentication tokens, financial rows or tenant identifiers are appended.
const centralDashboardUrl = String.fromEnvironment(
  'CENTRAL_DASHBOARD_URL',
  defaultValue: 'https://amer-ai-store.github.io/Mohammad-Ahmed-Ghannam/index.html#erp-app',
);

/// Fail closed for non-HTTPS, foreign, query-bearing or credential-bearing links.
/// This is URL allowlisting, NOT evidence of preview authentication or owner E2E.
Uri? approvedCentralDashboardUri(String raw) {
  final uri = Uri.tryParse(raw);
  if (uri == null ||
      uri.scheme != 'https' ||
      !uri.hasAuthority ||
      uri.userInfo.isNotEmpty ||
      uri.hasQuery ||
      uri.port != 443 ||
      uri.fragment != 'erp-app') {
    return null;
  }
  final canonical =
      uri.host == 'amer-ai-store.github.io' &&
      uri.path == '/Mohammad-Ahmed-Ghannam/index.html';
  final previewHost =
      uri.host == 'jawafa-erp-dashboard-preview.vercel.app' ||
      (uri.host.startsWith('jawafa-erp-dashboard-preview-') &&
          uri.host.endsWith('-a-1857.vercel.app'));
  final protectedPreview = previewHost &&
      (uri.path.isEmpty || uri.path == '/' || uri.path == '/index.html');
  return (canonical || protectedPreview) ? uri : null;
}

void main() => runApp(const JawafaErpApp());

class JawafaErpApp extends StatelessWidget {
  final ErpGatewayClient? gateway;
  const JawafaErpApp({super.key, this.gateway});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'JAWAFA ERP AI',
      debugShowCheckedModeBanner: false,
      theme: buildErpTheme(),
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
  ErpDepartment? activeDepartment;

  static const departmentPages = <ErpDepartment, List<ErpArea>>{
    ErpDepartment.accounting: [ErpArea.journal, ErpArea.cheques, ErpArea.reports],
    ErpDepartment.procurementInventory: [ErpArea.procurement, ErpArea.inventory, ErpArea.reports],
    ErpDepartment.sales: [ErpArea.pointOfSale],
    ErpDepartment.hr: [ErpArea.personnel],
    ErpDepartment.shared: [
      ErpArea.permissions, ErpArea.settings, ErpArea.audit,
    ],
  };

  void select(ErpArea area, {bool closeDrawer = false}) {
    setState(() {
      selected = area;
      activeDepartment = null;
    });
    if (closeDrawer) Navigator.maybePop(context);
  }

  void selectDepartment(ErpDepartment department, {bool closeDrawer = false}) {
    setState(() {
      activeDepartment = department;
      selected = ErpArea.overview;
    });
    if (closeDrawer) Navigator.maybePop(context);
  }

  Future<void> openCentralDashboard() async {
    // Public navigation only; never send tokens, financial data or tenant identifiers.
    final uri = approvedCentralDashboardUri(centralDashboardUrl);
    if (uri == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('رابط لوحة القيادة غير معتمد؛ لم يتم فتحه.'),
      ));
      return;
    }
    bool opened = false;
    try {
      opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      opened = false;
    }
    if (!opened) {
      await Clipboard.setData(const ClipboardData(text: centralDashboardUrl));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('تعذّر فتح لوحة القيادة؛ تم نسخ رابطها.'),
      ));
    }
  }

  void searchDepartments() {
    showSearch<void>(
      context: context,
      delegate: ErpDepartmentSearch(onSelected: (department) {
        selectDepartment(department);
      }),
    );
  }

  Widget navEntries({required bool mobile}) {
    return ListView(
      key: Key(mobile ? 'erp_mobile_nav' : 'erp_desktop_nav'),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(15, 20, 15, 16),
          child: ErpPanel(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              const Icon(Icons.shopping_basket_outlined,
                color: ErpPalette.green, size: 32),
              const SizedBox(width: 10),
              const Expanded(child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('JAWAFA ERP AI', style:
                    TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  Text('نظام موارد المؤسسات الذكي',
                    style: TextStyle(fontSize: 11, color: ErpPalette.muted)),
                ],
              )),
            ]),
          ),
        ),
        ListTile(
          key: const Key('menu_overview'),
          leading: const Icon(Icons.dashboard_outlined,
            color: ErpPalette.cyan),
          selected: selected == ErpArea.overview && activeDepartment == null,
          title: const Text('لوحة القيادة'),
          onTap: () => select(ErpArea.overview, closeDrawer: mobile),
        ),
        const Divider(),
        for (final department in ErpDepartment.values)
          ExpansionTile(
            key: Key('group_${department.name}'),
            initiallyExpanded: department == ErpDepartment.accounting,
            leading: Icon(erpDepartmentSpecs[department]!.icon,
              color: erpDepartmentSpecs[department]!.accent),
            tilePadding: const EdgeInsets.symmetric(horizontal: 16),
            title: Text(erpDepartmentSpecs[department]!.name,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            subtitle: Text(erpDepartmentSpecs[department]!.agent,
              style: const TextStyle(color: ErpPalette.muted, fontSize: 10)),
            onExpansionChanged: (expanded) {
              if (expanded) {
                setState(() {
                  activeDepartment = department;
                  selected = ErpArea.overview;
                });
              }
            },
            children: [
              ListTile(
                key: Key('menu_department_${department.name}'),
                contentPadding: const EdgeInsetsDirectional.only(start: 28, end: 12),
                dense: true,
                leading: const Icon(Icons.grid_view_outlined, size: 18),
                title: const Text('نظرة عامة للقسم'),
                onTap: () => selectDepartment(department, closeDrawer: mobile),
              ),
              for (final area in departmentPages[department]!)
                ListTile(
                  key: Key('menu_${area.name}'),
                  dense: true,
                  selected: selected == area && activeDepartment == null,
                  selectedTileColor: ErpPalette.raised,
                  contentPadding:
                    const EdgeInsetsDirectional.only(start: 28, end: 12),
                  leading: Icon(areaIcons[area], size: 19),
                  title: Text(areaLabels[area]!,
                    style: const TextStyle(fontSize: 12)),
                  onTap: () => select(area, closeDrawer: mobile),
                ),
              const SizedBox(height: 6),
            ],
          ),
        const Divider(),
        const Padding(
          padding: EdgeInsets.all(14),
          child: Text(
            'شاشات TrustSoft قيد الدراسة · لا اتصال مالي إنتاجي.',
            style: TextStyle(fontSize: 11, color: ErpPalette.muted),
          ),
        ),
      ],
    );
  }

  Widget currentContent() {
    if (activeDepartment != null) {
      return ErpDepartmentLanding(department: activeDepartment!);
    }
    switch (selected) {
      case ErpArea.overview:
        return ErpOverviewDashboard(onDepartmentSelected: selectDepartment);
      case ErpArea.cheques:
        return ChequeDemoView(gateway: widget.gateway);
      case ErpArea.journal:
        return const JournalDemoView();
      case ErpArea.procurement:
        return ProcurementDraftView(gateway: widget.gateway);
      case ErpArea.personnel:
        return ErpReferenceReadOnlyView(
          gateway: widget.gateway, scope: 'personnel');
      case ErpArea.permissions:
        return ErpReferenceReadOnlyView(
          gateway: widget.gateway, scope: 'permissions');
      case ErpArea.settings:
        return ErpReferenceReadOnlyView(
          gateway: widget.gateway, scope: 'settings');
      case ErpArea.inventory:
        return const PendingModuleView(
          title: 'المخزون',
          details: 'الأصناف والوحدات والتكلفة وحركة المخزون والتحويل والجرد.',
        );
      case ErpArea.pointOfSale:
        return const PendingModuleView(
          title: 'المبيعات ونقاط البيع',
          details: 'الفواتير والخصومات والإلغاء والمردود والصناديق والضريبة، '
            'بما فيها صلاحيات الكاشير الخاصة بهذا القسم.',
        );
      case ErpArea.audit:
        return const PendingModuleView(
          title: 'التدقيق والرقابة',
          details: 'سجل أحداث غير قابل للتعديل وفصل الصلاحيات وأدلة قبل/بعد.',
        );
      case ErpArea.reports:
        return ErpReportCatalogView(historicalReader: widget.gateway);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, size) {
      final wide = size.maxWidth >= 780;
      final title = activeDepartment == null
          ? areaLabels[selected]!
          : erpDepartmentSpecs[activeDepartment]!.name;
      return Scaffold(
        appBar: AppBar(
          title: Text('JAWAFA ERP AI • $title',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          actions: [
            IconButton(
              key: const Key('central_dashboard_link'),
              onPressed: () { openCentralDashboard(); },
              icon: const Icon(Icons.open_in_new),
              tooltip: 'فتح لوحة القيادة المركزية',
            ),
            IconButton(
              key: const Key('erp_module_search'),
              onPressed: searchDepartments,
              icon: const Icon(Icons.search),
              tooltip: 'البحث عن مجموعة',
            ),
            const Padding(
              padding: EdgeInsetsDirectional.only(end: 12),
              child: Center(child: ErpNonLiveBadge()),
            ),
          ],
        ),
        drawer: wide ? null : Drawer(
          backgroundColor: ErpPalette.background,
          child: SafeArea(child: navEntries(mobile: true)),
        ),
        bottomNavigationBar: wide ? null : NavigationBar(
          key: const Key('erp_mobile_departments'),
          height: 70,
          backgroundColor: ErpPalette.surface,
          selectedIndex: activeDepartment?.index ?? 0,
          onDestinationSelected: (index) =>
              selectDepartment(ErpDepartment.values[index]),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: [
            for (final department in ErpDepartment.values)
              NavigationDestination(
                icon: Icon(erpDepartmentSpecs[department]!.icon),
                label: switch (department) {
                  ErpDepartment.accounting => 'المحاسبة',
                  ErpDepartment.procurementInventory => 'المشتريات',
                  ErpDepartment.sales => 'المبيعات',
                  ErpDepartment.hr => 'الموظفون',
                  ErpDepartment.shared => 'الإعدادات',
                },
              ),
          ],
        ),
        body: Row(
          children: [
            if (wide)
              SizedBox(
                width: 260,
                child: Material(
                  color: ErpPalette.background,
                  child: navEntries(mobile: false),
                ),
              ),
            Expanded(
              child: SafeArea(
                child: Padding(
                  padding: EdgeInsets.all(wide ? 20 : 12),
                  child: ListView(
                    children: [
                      ErpPanel(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                        child: const Row(children: [
                          Icon(Icons.info_outline,
                            color: ErpPalette.amber, size: 19),
                          SizedBox(width: 8),
                          Expanded(child: Text(
                            'نسخة تجريبية مستقلة: جميع الأرقام والعمليات '
                            'المعروضة محاكاة محلية. لا يتم إنشاء قيود مالية '
                            'فعلية ولا ربط Jawafa_DB.',
                            key: Key('demo_banner'),
                            style: TextStyle(fontSize: 11,
                              color: ErpPalette.muted),
                          )),
                        ]),
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

class ErpDepartmentSearch extends SearchDelegate<void> {
  final ValueChanged<ErpDepartment> onSelected;
  ErpDepartmentSearch({required this.onSelected})
    : super(searchFieldLabel: 'البحث في المجموعات الرئيسية');

  @override
  List<Widget> buildActions(BuildContext context) => [
    IconButton(
      onPressed: () { query = ''; },
      icon: const Icon(Icons.clear),
    ),
  ];

  @override
  Widget buildLeading(BuildContext context) => IconButton(
    icon: const Icon(Icons.arrow_back),
    onPressed: () => close(context, null),
  );

  @override
  Widget buildResults(BuildContext context) => buildSuggestions(context);

  @override
  Widget buildSuggestions(BuildContext context) {
    final items = erpDepartmentSpecs.entries.where((entry) =>
      entry.value.name.contains(query.trim()) ||
      entry.value.agent.contains(query.trim())).toList();
    return ListView(
      children: [
        for (final entry in items)
          ListTile(
            leading: Icon(entry.value.icon, color: entry.value.accent),
            title: Text(entry.value.name),
            subtitle: Text(entry.value.agent),
            onTap: () {
              close(context, null);
              onSelected(entry.key);
            },
          ),
        if (items.isEmpty)
          const ListTile(title: Text('لم يتم العثور على مجموعة مطابقة')),
      ],
    );
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
