# JAWAFA ERP AI — OWNER APPROVED DESIGN / INFORMATION ARCHITECTURE
**Owner approval:** 2026-11-09, in ChatGPT project conversation. **Design reference:** generated dark-navy/blue/cyan image mockup `a_detailed_promotional_ui_ux_design_mockup_collage.png`, SHA256 `249b73f60fa8721400d457f2ce35f5bbbbf0f6d386a735b0dcde11b42dc1de27` (original reference held in conversation assets; **image bytes are not committed to this repository**).

**Decision:** retain the approved cohesive look on Windows EXE, Android APK, and iOS; responsive RTL Arabic UX with deep blue backgrounds, electric-blue/cyan focus, compact data tables, nested module navigation, non-fabricated KPI placeholders, AI notices, role-scoped modules, and central search. The concept illustration is not production proof; live values are never fabricated.

## Five required primary departments (owner-approved hierarchy)

**1. المحاسبة — Accounting (the FIRST primary department), AI role: المدير المالي.** General ledger, journal entries, payment/receipt vouchers, cheques and banks, financial reports, accounts, accounting-specific settings, invoice-posting control, inventory-posting control, employee/payroll-posting control, approval/unposting/reversal workflows, and other screens discovered in TrustSoft. Purchasing, sales, and payroll post into general ledger only through approved, auditable APIs. Existing cheque and journal demos remain prototypes and must not pretend to post.

**2. المشتريات والمخزون — Procurement + Inventory (ONE combined department), AI role: مدير المشتريات ومراقبة المواد.** Item family/classifications, item master and definitions, vendors, purchase orders and purchase invoices, purchase returns, receiving/inbound vouchers, issue/outbound vouchers, transfers, stocktake, inventory change history, item ledger, amended item records, vendor statements, monthly movements, stock reports, scoped settings. User expects hundreds of reference reports (300–400 stated as an estimate, NOT yet an inventoried/verified catalog). Source-table, UI and report parity must be measured individually.

**3. المبيعات — Sales & Development, AI role: مدير المبيعات والتطوير.** Sales/POS, cash register and cashier shift, sales invoices and returns, discounts, tax reporting, sales movements/analytics, sales-specific settings and hardware. **Cashier/point-of-sale permissions are managed inside Sales/POS and NOT mixed with company-wide permission screens.** Sales shares domain services with procurement/inventory and accounting via controlled documented contracts.

**4. شؤون الموظفين — HR, AI role: مدير شؤون الموظفين.** Staff profiles, biometric device and camera attendance ONLY under lawful consent/authorization/security requirements, clock-in/out, shifts, payroll, social security, deductions, annual leave, employee loans/advances, HR reporting/settings, and controlled payroll to GL.

**5. الصلاحيات والمعلومات المشتركة والإعدادات — Permissions, Common Information & Settings.** Enterprise permissions by department, screen/action/branch/company, role-management history, user self-service password change, branch definition and branch linking, tax definitions, shared constants, device/peripheral settings, company-wide configuration and audit. Exclude cashier access rules from this primary group, which belong to Sales/POS domain.

## UI contract and behavior

- Five **main tabs/groups**, not eleven unrelated modules. Every primary department has a clearly indicated *own settings* area and *own AI agent* slot (nonfunctional until connected to a real authenticated API).
- Existing functional demo navigation (`cheques`, `journal`, `procurement`, `personnel`, `permissions`, `settings`) remains reachable during transition, never silently removed.
- Windows: wide left/right RTL-aware nested sidebar, large tables and report filtering. Phones: 5 compact department cards, drawer or bottom navigation, limited KPI summaries, finger-friendly actions. iOS and Android share Flutter business logic but native safe areas and scaling apply.
- Display badge `تجريبي · غير متصل` when data or agent is not live. No fake financial KPI values from a promotional illustration should be displayed as real.
- Search/filter and report tiles start as correctly marked design placeholders; a visible tile **does not count as implemented or TrustSoft-matched**.
- Every sensitive action must be server-authorized, actor-attributed and audit logged. AI agents may advise and draft; no silent financial posting, configuration change, rights escalation or biometric capture.

## External POS & inventory-counting decision

Keep POS and stocktake logically **inside** the corresponding main ERP department and same module/report architecture. Enable a **separate device-optimized runtime/app only when warranted** (offline tills, printers, barcode scanners, fingerprint peripherals and connection resilience), backed by the same authenticated ERP API and tenant/branch rules; no direct database writes from devices. This is an architectural choice, **not** a claim that those apps already work.

## TrustSoft 90% parity acceptance

Preserve all actual TrustSoft features, submenus, roles, device integrations, business constants, reports and background jobs in a versioned owner-approved weighted catalog. Require mapping: reference screen/function/underlying table keys → reference observed behavior → new ERP code → positive/negative tests → independent comparison. The mandatory accounting, combined procurement+inventory, sales/POS, HR, enterprise settings/permissions and peripheral areas may never be silently dropped to inflate a score. **Current weighted parity: UNMEASURED**.

## Current delivery state

This is an **approved DESIGN TARGET**, not a working final ERP or approved live integration. Prototype screens and CI artifacts are separate evidence. No modification to TrustSoft/Jawafa_DB or the historical financial/numeric records is authorized by this design adoption.
