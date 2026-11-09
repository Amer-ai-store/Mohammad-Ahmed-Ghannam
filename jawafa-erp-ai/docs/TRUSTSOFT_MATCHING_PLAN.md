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
Procurement, inventory, sales/POS, AR/AP, general ledger, tax, branches, contracts/investments, user/security roles, audit and statutory reports. Their weights and total denominator will be agreed only after feature discovery. A row-count or 1024-table count never becomes 90% parity.

## Distinct roles in the project

- **Analysis team:** extracts approved, immutable schema evidence privately.
- **Implementation:** builds ERP behavior independently with synthetic fixtures.
- **QA/security:** validates least-privilege controls and unauthorized-write rejection.
- **Financial owner:** approves parity of real accounting rules and reports.

No source SQL credentials or sensitive customer/financial records go into GitHub or CI logs.
