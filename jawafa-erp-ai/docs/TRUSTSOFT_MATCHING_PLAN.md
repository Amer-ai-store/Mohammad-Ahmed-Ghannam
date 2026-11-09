# TrustSoft parity work register — independent functional reimplementation

**Canonical target:** >= 90% weighted, verified workflows from a complete, frozen reference feature catalog; additional AI/security improvements weighted >= 50% of that catalog. Current parity = **UNMEASURED**.

## Evidence classification
- `DISCOVERED`: source objects and behavior named; no verified links.
- `ANALYZED`: schema joins, sample documents, event ordering, calculations reviewed.
- `SPECIFIED`: functional mapping with tests and authorized signoff.
- `BUILT`: independent new ERP code exists.
- `TESTED`: all required tests pass with synthetic or anonymized test fixtures.
- `MATCHED`: independently compared against approved TrustSoft original behavior on controlled samples.
- `ACCEPTED`: functional, accounting and security gates approved with versioned evidence.

## First reference cycle: Cheque lifecycle (P0)

Candidate source tables and attributes from **2026-11-09 export headers**, not vendor documentation:

| Table | Key candidate | Possible use | State |
|---|---|---|---|
| dbo.ARPDocuments | CheqId / DocumentNo / TransNo | cheque master, due date, status, return/deposit/bank flags | discovered |
| dbo.CheqMovement | CheqId / SeqId | cheque status events with dates and reasons | discovered |
| dbo.ARPPayMaster | Trans_No / VoucherNo / AccountNo | pay/receipt voucher and approvals | discovered |
| dbo.ARPJournal_GL | JournalNo / OriginalTransNo | AR/AP journal posting | discovered |
| dbo.ARPFrom_gl, dbo.ARPTo_GL | JournalNo / EntryOrder | credit/debit details; sign to be verified | discovered |
| dbo.Journal_GL, dbo.From_gl, dbo.To_GL | JournalNo | general ledger and cross vouchers | discovered |
| dbo.AccBanks | BankID | bank names/settings | discovered |

**Next source checks:** CheqId matching across documents/events; status code dictionary from actual event sequences; cheque cancellations/returns; versioned snapshots; date and approval semantics; pay voucher to GL linkage; account number/currency and check versus bank-original proof. Never infer fraud from an unmatched row in exported data.

**Implementation starting point:** `lib/src/domain/cheque.dart` is a PROTOTYPE state machine. It must not be presented as exact TrustSoft behavior until the status vocabulary, permission transitions, audit timestamps and bank proof are independently compared.

## Other core modules
Procurement, inventory, sales/POS, AR/AP, general ledger, tax, branches, contracts/investments, **human resources/personnel (شؤون الموظفين)**, **permissions and system settings (الصلاحيات والإعدادات)**, user/security roles, audit and statutory reports. Their weights and total denominator will be agreed only after feature discovery. A row-count or 1024-table count never becomes 90% parity.

## Distinct roles in the project

- **Analysis team:** extracts approved, immutable schema evidence privately.
- **Implementation:** builds ERP behavior independently with synthetic fixtures.
- **QA/security:** validates least-privilege controls and unauthorized-write rejection.
- **Financial owner:** approves parity of real accounting rules and reports.

No source SQL credentials or sensitive customer/financial records go into GitHub or CI logs.


## Mandatory reference modules added by the owner (2026-11-09)

The following are **core TrustSoft parity areas**, not optional enhancements or part of the separately scoped JAWAFA ONE maintenance effort.

### Human resources / personnel — شؤون الموظفين

Inventory the actual authorized TrustSoft screens, forms, settings, database tables, key/foreign-key relations, stored procedures, states, reports, and user actions before claiming equivalence. Candidate areas to verify (not yet established as actual TrustSoft functionality) include employee master records, contracts, departments, attendance, shifts, leave, payroll, allowances/deductions, advances, termination, and payroll-to-GL linkages. Record each discovered function with its source-table mapping, input/output rules, edge cases, permissions, and independently reproducible behavioral comparison.

### Permissions and system settings — الصلاحيات والإعدادات

Inventory actual TrustSoft users, roles, per-screen permissions, per-action authorization, branch/company scope, segregation-of-duties requirements, audit history, and configuration/constant dictionaries. Candidate settings to verify (not yet established) include document-number sequences, approval policies, tax rules, warehouses, POS device integration, printer/barcode and other peripheral configuration, inventory units, and financial posting controls. Denied access, invalid transitions and unauthorized configuration changes must be verified in negative tests, not inferred from visible menus.

### Parity acceptance contract for both areas

- `DISCOVERED` = named objects or candidate functions only; `MATCHED` requires side-by-side comparison to approved real TrustSoft behavior with versioned, reproducible evidence.
- Freeze a complete weighted feature inventory and denominator covering both areas; omissions must reduce coverage, not disappear from the denominator.
- For each feature, map reference UI → business rule/constants → source schema/relations → new independent ERP implementation → positive/negative tests → reviewer acceptance.
- A table export, menu stub, mock screen, or passing synthetic unit test **does not** count as 90% functional parity.
- No TrustSoft/Jawafa_DB financial or administrative originals are modified; no vendor source code is copied without authorization.
