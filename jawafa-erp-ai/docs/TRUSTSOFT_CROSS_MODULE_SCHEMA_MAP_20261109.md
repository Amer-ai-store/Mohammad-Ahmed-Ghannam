# JAWAFA ERP AI — TrustSoft reference schema map for core departments
**Evidence date:** 2026-11-09. **Source:** authorized, private 20261109-0100 export inventory and the HEADER LINE ONLY for selected source CSVs. Report-list *metadata counts* are also aggregated without publishing any employee/customer/finance values. Original SQL Server database is unchanged.

**Reference inventory SHA256:** `0e8adab1b15bbc33e198085c46d0da8a6b1fc5103e706cab95533b4bed798118`.

**Scope:** Distinguish verified table/column presence from inferred foreign keys, application screens, processing rules and stored procedures. Live SQL catalogue access is unavailable through the approved reader identity; name matches are candidates, **not verified joins**. This source analysis serves only the independent JAWAFA ERP AI; no JAWAFA ONE or central dashboard work.

## 1. المحاسبة: candidate journal/posting chain

| Source table | Export columns of interest | Evidence state |
|---|---|---|
| `dbo.Journal_GL` | `JournalNo`, `JournalDate`, `ReceiptNo`, `ReceiptType`, `post`, `JournalType`, `TransferNo` | Header found |
| `dbo.From_gl` | `JournalNo`, `amount`, `famount` | Header found |
| `dbo.To_GL` | `JournalNo`, `Amount`, `famount` | Header found |
| `dbo.ARPDocuments` | `CheqId`, `TransNo`, `DueDate`, `InDeposit`, `PaidDate` | Header found |
| `dbo.CheqMovement` | `CheqId`, `SeqId`, `MoveDate`, `TransNo` | Header found |

**Candidate relations:** Journal header `Journal_GL.JournalNo` to two ledger-side tables; cheque master `ARPDocuments.CheqId` to events `CheqMovement.CheqId`. Sign conventions, key uniqueness, partial cancellation and reversals require original behavior tests. No new ERP real posting is approved yet.

## 2. المشتريات والمخزون: candidate reference chain

| Source table | Export columns of interest | Evidence state |
|---|---|---|
| `dbo.Families` | `FamCode`, `ItemMainAcc`, `ItemSubAcc` | Header found |
| `dbo.Items` | `ItemCode`, `FamCode`, `IsTax`, `BuyUnit`, `LastUpdateDate`, `lastuserUpdate` | Header found |
| `dbo.Receipt` | `RecNo`, `SuppNo`, `RecDate`, `Posted`, `PostToAcc`, `MainAcc`, `SubAcc`, `TaxChangedByUser`, `FirstApproval`, `SecondApproval`, `ThirdApproval` | Header found |
| `dbo.InvPurchaseVouchersTransactionHistory` | `ReceiptNo`, `TransNo`, `TransDate`, `TransTime`, `RecLineNo` | Header found |
| `dbo.MonthlyMovementSummaryReport` | `ItemCode`, `Family_Code`, `Supplier_Code`, `Receipt_Qty`, `Stock_Net_Qty` | Header found |

**Candidate relations:** `Items.FamCode` to `Families.FamCode`, receipt to voucher history via `RecNo` vs `ReceiptNo`, and item to monthly movement via `ItemCode`. `Items.LastUpdateDate` and `lastuserUpdate` indicate *current* update metadata, **not proof that complete before/after history exists**. The historical evidence chain must be independently reconstructed from source documents and logs.

## 3. المبيعات ونقاط البيع: candidate reference chain

| Source table | Export columns of interest | Evidence state |
|---|---|---|
| `dbo.InvoiceSales` | `InvoiceNo`, `InvoiceDate`, `Posted`, `POSNo`, `PostToAcc`, `Invoice_Journal_No`, `OpenForUpdate` | Header found |
| `dbo.ItemLineInvoSales` | `InvoiceNo`, `ItemCode`, `UnitPrice`, `TaxValue`, `SeqNo` | Header found |
| `dbo.Pos_Close_Cash_Payment_Details` | `CashNo`, `SeqNo`, `Payment_Id` | Header found |
| `dbo.MPOSRelationUserAndFunction` | `UserNo`, `FunctionNo` | Header found |

**Candidate relations:** Sales invoice header/line by `InvoiceNo`; sales-to-ledger by `Invoice_Journal_No` compared to `Journal_GL.JournalNo`; POS cashier rights by separate MPOS tables, **not general corporate role screens**, as mandated by the owner. Device workflows may use an independent kiosk shell sharing authenticated ERP APIs.

**IMPORTANT DATA-SCOPE LIMITATION:** The 2026-11-09 export reports `InvoiceSales` and `ItemLineInvoSales` as FULL with 0 rows; this does **not** prove that production sales are absent or deleted. Review actual TrustSoft active invoicing subsystem, export scope, data quality and SQL table use before proceeding.

## 4. تقرير وعدد التقارير: source-backed distinction

`dbo.List_Report` contains `User_Id`, `FORM_No`, `CTRNAME`, `ReportNo`, `ReportName`, `ReportNameE`. The export contains **3,846 report-configuration rows**, but the selected snapshot has only **9 distinct ReportNo values** and **8 distinct FORM_No values**. It likely stores user/form preferences; **3,846 rows are NOT 3,846 distinct business reports**, and 9 visible report numbers do not establish the full TrustSoft report universe.

`dbo.Report_Condition` has `ReportNo`, `Form_No` and filter-range attributes; the observed export contains 0 rows. This is only a snapshot claim, not evidence the report engine lacks filters. The owner's estimate of 300–400 reports remains a *scope hypothesis* until UI/menu definitions, report templates or authorized application metadata are inventoried individually.

## 5. Reference extract quality — counts MUST NOT become production claims

| Table | v5 export mode | Export rows | Caveat |
|---|---|---:|---|
| `dbo.Journal_GL` | FULL | 40,648 | Counts only; no transaction values read |
| `dbo.From_gl` | FULL | 356,868 | Counts only; no sign reconciliation performed |
| `dbo.To_GL` | FULL | 97,899 | Counts only |
| `dbo.Receipt` | FULL | 19,107 | Counts only |
| `dbo.Items` | DELTA | 243 | Inventory metadata lists a different underlying row count; export delta ≠ full table |
| `dbo.Families` | FULL | 847 | Counts only |
| `dbo.List_Report` | FULL | 3,846 | User/form configuration rows, not unique report count |
| `dbo.InvoiceSales` | FULL | 0 | Needs table-use verification before any conclusion |

All counts are export metadata, **not current real-time database evidence**, nor a comparison with past snapshots.

## 6. Next engineering/QA gates

1. Obtain authorized read-only SQL catalogue metadata: data types, PK/FK, unique constraints, stored module *metadata* and screen/role binding.
2. Freeze versioned TrustSoft screen/function/report catalogue across accounting, combined procurement+inventory, POS/sales, HR, and shared admin; the five *user-interface groups* are not evidence that subfeatures exist.
3. Independently test each suspected join and direction, source posting state machine, report filters and exceptions using controlled test data.
4. Build matching behavior in the **new ERP** and verify both positive/negative flows against TrustSoft; never copy confidential/vendor source code.
5. Count parity only from independently accepted weighted workflows with evidence hashes. Current parity remains **UNMEASURED**.
