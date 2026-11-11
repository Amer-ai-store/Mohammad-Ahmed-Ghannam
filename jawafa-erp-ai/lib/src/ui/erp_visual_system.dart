import 'package:flutter/material.dart';

/// Approved JAWAFA ERP AI design language — visual-only client components.
/// No dashboard values, permissions or AI responses are invented here.
abstract final class ErpPalette {
  static const background = Color(0xFF071627);
  static const surface = Color(0xFF10243D);
  static const raised = Color(0xFF17324F);
  static const border = Color(0xFF235477);
  static const cyan = Color(0xFF20C9FF);
  static const blue = Color(0xFF137DFF);
  static const muted = Color(0xFFABC3D9);
  static const white = Color(0xFFF4F9FF);
  static const green = Color(0xFF2CE3A0);
  static const amber = Color(0xFFFFD376);
}

ThemeData buildErpTheme() {
  const base = ColorScheme.dark(
    primary: ErpPalette.cyan,
    onPrimary: ErpPalette.background,
    secondary: ErpPalette.blue,
    surface: ErpPalette.surface,
    onSurface: ErpPalette.white,
    error: Color(0xFFFF777B),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: base,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: ErpPalette.background,
    cardColor: ErpPalette.surface,
    dividerColor: ErpPalette.border,
    appBarTheme: const AppBarTheme(
      backgroundColor: ErpPalette.background,
      foregroundColor: ErpPalette.white,
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: ErpPalette.raised,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: ErpPalette.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: ErpPalette.border),
      ),
    ),
  );
}

enum ErpDepartment { accounting, procurementInventory, sales, hr, shared }

class ErpDepartmentSpec {
  final String name;
  final String agent;
  final IconData icon;
  final Color accent;
  final List<String> plannedWorkflows;
  const ErpDepartmentSpec({
    required this.name,
    required this.agent,
    required this.icon,
    required this.accent,
    required this.plannedWorkflows,
  });
}

const erpDepartmentSpecs = <ErpDepartment, ErpDepartmentSpec>{
  ErpDepartment.accounting: ErpDepartmentSpec(
    name: 'المحاسبة',
    agent: 'المدير المالي',
    icon: Icons.account_balance_outlined,
    accent: ErpPalette.cyan,
    plannedWorkflows: [
      'سندات القيد', 'سندات القبض والصرف', 'الشيكات والبنوك',
      'ترحيل الفواتير', 'ترحيل المخزون', 'ترحيل الموظفين',
      'التقارير المالية', 'إعدادات المحاسبة',
    ],
  ),
  ErpDepartment.procurementInventory: ErpDepartmentSpec(
    name: 'المشتريات والمخزون',
    agent: 'مدير المشتريات ومراقبة المواد',
    icon: Icons.inventory_2_outlined,
    accent: ErpPalette.green,
    plannedWorkflows: [
      'العائلات والأصناف', 'طلبات وفواتير الشراء', 'مردودات المشتريات',
      'سندات الإدخال والإخراج', 'الجرد وحركات المخزون',
      'سجل المادة وتاريخ التعديلات', 'تقارير الموردين', 'إعدادات المشتريات والمخزون',
    ],
  ),
  ErpDepartment.sales: ErpDepartmentSpec(
    name: 'المبيعات ونقاط البيع',
    agent: 'مدير المبيعات والتطوير',
    icon: Icons.point_of_sale_outlined,
    accent: Color(0xFF7AA6FF),
    plannedWorkflows: [
      'نقاط البيع POS', 'فواتير ومردودات المبيعات', 'حركات المبيعات',
      'تقارير ضريبة المبيعات', 'صلاحيات الكاشير والصندوق',
      'تسوية الوردية', 'إعدادات المبيعات',
    ],
  ),
  ErpDepartment.hr: ErpDepartmentSpec(
    name: 'شؤون الموظفين',
    agent: 'مدير شؤون الموظفين',
    icon: Icons.badge_outlined,
    accent: Color(0xFFBC97FF),
    plannedWorkflows: [
      'ملفات الموظفين', 'الحضور والبصمة', 'الرواتب والأجور',
      'الضمان والخصومات', 'الإجازات السنوية', 'القروض والسلف',
      'تقارير الموظفين', 'إعدادات شؤون الموظفين',
    ],
  ),
  ErpDepartment.shared: ErpDepartmentSpec(
    name: 'الصلاحيات والمعلومات المشتركة',
    agent: 'وكيل إدارة الأنظمة',
    icon: Icons.admin_panel_settings_outlined,
    accent: ErpPalette.amber,
    plannedWorkflows: [
      'صلاحيات المستخدمين والمجموعات', 'تغيير كلمة المرور',
      'تعريف الفروع وربطها', 'تعريف الضرائب',
      'الإعدادات والثوابت', 'الأجهزة الطرفية والطابعات',
      'سجل التدقيق',
    ],
  ),
};

class ErpPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  const ErpPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [ErpPalette.surface, ErpPalette.raised],
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ErpPalette.border),
      ),
      child: child,
    );
  }
}

class ErpNonLiveBadge extends StatelessWidget {
  const ErpNonLiveBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFF382E25),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: ErpPalette.amber.withValues(alpha: 0.5)),
      ),
      child: const Text('تجريبي · غير متصل',
        style: TextStyle(fontSize: 11, color: ErpPalette.amber)),
    );
  }
}

class ErpAgentTile extends StatelessWidget {
  final String manager;
  const ErpAgentTile({super.key, required this.manager});

  @override
  Widget build(BuildContext context) {
    return ErpPanel(
      child: Row(
        children: [
          const Icon(Icons.auto_awesome, color: ErpPalette.cyan),
          const SizedBox(width: 10),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('وكيل الذكاء الاصطناعي: $manager',
                style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              const Text('مخصص للوحدة · API لم يُفعّل إنتاجيًا',
                style: TextStyle(fontSize: 12, color: ErpPalette.muted)),
            ],
          )),
          const ErpNonLiveBadge(),
        ],
      ),
    );
  }
}

class ErpDepartmentLanding extends StatelessWidget {
  final ErpDepartment department;
  const ErpDepartmentLanding({super.key, required this.department});

  @override
  Widget build(BuildContext context) {
    final spec = erpDepartmentSpecs[department]!;
    return Column(
      key: Key('landing_${department.name}'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(spec.icon, color: spec.accent, size: 28),
          const SizedBox(width: 10),
          Expanded(child: Text(spec.name,
            style: Theme.of(context).textTheme.headlineSmall)),
        ]),
        const SizedBox(height: 8),
        const Text('هيكل الواجهات معتمد · تنفيذ الوظائف ومطابقتها مع TrustSoft قيد الدراسة',
          style: TextStyle(color: ErpPalette.muted)),
        const SizedBox(height: 16),
        ErpAgentTile(manager: spec.agent),
        const SizedBox(height: 16),
        Text('الوظائف المدرجة في هذا القسم',
          style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final item in spec.plannedWorkflows)
              SizedBox(
                width: 220,
                child: ErpPanel(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.layers_outlined, color: spec.accent),
                      const SizedBox(height: 10),
                      Text(item, style: const TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 6),
                      const Text('قيد المطابقة والتطوير',
                        style: TextStyle(fontSize: 11, color: ErpPalette.muted)),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class ErpOverviewDashboard extends StatelessWidget {
  final ValueChanged<ErpDepartment> onDepartmentSelected;
  const ErpOverviewDashboard({
    super.key, required this.onDepartmentSelected,
  });

  @override
  Widget build(BuildContext context) {
    const metrics = [
      ('المبيعات اليوم', Icons.point_of_sale_outlined),
      ('المشتريات اليوم', Icons.shopping_cart_outlined),
      ('المخزون', Icons.inventory_2_outlined),
      ('الشيكات والمستحقات', Icons.account_balance_wallet_outlined),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('لوحة القيادة الرئيسية',
          style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 6),
        const Text('نظام إدارة موارد المؤسسات الذكي · النسخة التجريبية',
          style: TextStyle(color: ErpPalette.muted)),
        const SizedBox(height: 16),
        Wrap(spacing: 10, runSpacing: 10, children: [
          for (final (label, icon) in metrics)
            SizedBox(
              width: 205,
              child: ErpPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, color: ErpPalette.cyan),
                    const SizedBox(height: 8),
                    Text(label),
                    const SizedBox(height: 5),
                    const Text('لا توجد بيانات حية',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: ErpPalette.muted,
                      )),
                  ],
                ),
              ),
            ),
        ]),
        const SizedBox(height: 18),
        ErpAgentTile(manager: 'مساعد النظام المركزي — غير مفعّل'),
        const SizedBox(height: 18),
        Text('المجموعات الرئيسية',
          style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 10),
        Wrap(spacing: 12, runSpacing: 12, children: [
          for (final entry in erpDepartmentSpecs.entries)
            SizedBox(
              width: 260,
              child: InkWell(
                key: Key('department_card_${entry.key.name}'),
                borderRadius: BorderRadius.circular(16),
                onTap: () => onDepartmentSelected(entry.key),
                child: ErpPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(entry.value.icon, color: entry.value.accent),
                      const SizedBox(height: 10),
                      Text(entry.value.name,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      Text(entry.value.agent,
                        style: const TextStyle(
                          fontSize: 12, color: ErpPalette.muted)),
                    ],
                  ),
                ),
              ),
            ),
        ]),
      ],
    );
  }
}
