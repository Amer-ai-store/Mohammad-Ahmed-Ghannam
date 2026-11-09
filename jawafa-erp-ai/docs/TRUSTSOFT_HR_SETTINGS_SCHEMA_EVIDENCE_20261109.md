# TrustSoft HR / permissions / settings — source export header evidence (2026-11-09)

**Classification:** DISCOVERED from a previously produced authorized local export.
**Not:** a direct SQL Server catalog read, verified foreign-key map, source-code
audit or functional equivalence certification.

Source inspected **read-only** on `JAWAFFASVR`:
`C:\Export\hourly-v5\20261109-0100\inventory_tables.csv`
and **only the header lines** of selected `data\dbo.*.csv` files.
Inventory SHA256:
`0e8adab1b15bbc33e198085c46d0da8a6b1fc5103e706cab95533b4bed798118`.

- Inventory: **1,024 entries**; this is an export inventory, not a live SQL
  count or a number of completed ERP functionalities.
- Broad case-insensitive filename discovery matched **279 candidates**
  to HR/authorization/configuration/peripheral keywords; results include
  unrelated inventory/branch templates and must be filtered.
- No source database rows, employee names, salaries, passwords, bank data,
  financial figures or settings VALUES were examined or copied.
- An integrated-authentication SQL metadata query failed because the Windows
  account `JAWAFFASVR\Administrator` is disabled. Do not use `sa` or
  bypass authentication; SQL key constraints and data types are **unverified**.

## Source table headers verified in the export

| TrustSoft export table | Header columns | Verified column names (examples only) |
|---|---:|---|
| `dbo.EmpPersonal` | 171 | `EmpId`, `DeptI`, `BranchId`, `DurationNo` |
| `dbo.EmpDept` | 43 | `DeptId`, `DepName`, `DepType`, `Active`, `SectionNo` |
| `dbo.EmpHistory` | 10 | `HistoryNo`, `EmpId`, `DeptNo`, `FromDate`, `ToDate`, `brno` |
| `dbo.EmpDurationHistory` | 6 | `EmpID`, `DurationNo`, `UpdateDate`, `Status` |
| `dbo.EmpInOutTrans` | 21 | `TransNo`, `EmpId`, `TransDate`, `TransTime`, `ShiftNo`, `ClockNo` |
| `dbo.TimeAttendance_Transactions` | 8 | `TransNo`, `EmpId`, `TransDate`, `TransTime`, `ClockNo` |
| `dbo.EmpVacations` | 35 | `EmpNo`, `VacationNo`, `StartDate`, `NoOfDays`, `DeptId` |
| `dbo.EmpLoans` | 14 | `LoanNo`, `EmpId`, `DeptId`, `LoanDate`, `LoanClosed` |
| `dbo.EmpSalaryCalculation` | 81 | `EmpId`, `DeptId`, `Branchid`, `MainSalary`, `NetSalary` |
| `dbo.EmpPref` | 222 | `VersionNo`, `VersionDate`, `EmpSocRate`, `CurrencyName` |
| `dbo.EmpOptions` | 111 | `OvertimePermission`, `LatePermission`, `WorkEndPermission`, `ClockDataDevider` |
| `dbo.USER` | 33 | `Uno`, `Una`, `active`, `AllBranches`, `LoginTime` |
| `dbo.User_Screens_Settings` | 11 | `User_Id`, `Screen_No`, `Column_Visible`, `Column_Order` |
| `dbo.UserVouchersBranches` | 3 | `UserNo`, `VoucherType`, `BranchNo` |
| `dbo.FunctionSecurity` | 2 | `Fno`, `Fna` |
| `dbo.GroupSysFuncStorTbl` | 3 | `nGroupNo`, `nFunctNo`, `nStoreNo` |
| `dbo.MPOSRelationUserAndFunction` | 2 | `UserNo`, `FunctionNo` |
| `dbo.Settings` | 49 | `PosNo`, `DeviceID`, `Slip_Printer`, `Barcode_Printer`, `ScaleType` |
| `dbo.Share_Settings` | 239 | `Save_Screens_Settings_By_User`, `Allow_Enter_Quantity_Greater_Than_Item_Internal_Orderd_Quantity` |
| `dbo.ShareGeneralSettings` | 17 | `NotAllowedUnpostingJournalVoucher`, `NotAllowedUnpostingPurchaseVoucher`, `NotAllowedUnpostingPosSalesVoucher` |
| `dbo.BarCodeSettings` | 200 | `printername`, `barcodeh`, `barcodew`, `showbarcode` |
| `dbo.POS_Print_Settings_Templates` | 120 | `TemplateNo`, `PrinterType`, `PrintNoneBarcodeItemCode` |

## Candidate relations — NOT YET VERIFIED

1. `EmpPersonal.EmpId` ↔ `EmpHistory.EmpId`,
   `EmpInOutTrans.EmpId`, `EmpLoans.EmpId`,
   `EmpSalaryCalculation.EmpId` and `TimeAttendance_Transactions.EmpId`.
2. `EmpPersonal.DeptI` ↔ `EmpDept.DeptId` is a **name-based
   hypothesis**, especially due to the differing spelling.
3. `EmpVacations.EmpNo` ↔ `EmpPersonal.EmpId` is also **not
   established**. Field types, conversion and document semantics must be read.
4. `USER.Uno` ↔ `UserVouchersBranches.UserNo`,
   `MPOSRelationUserAndFunction.UserNo`, and
   `User_Screens_Settings.User_Id` are candidate user identity joins.
5. `FunctionSecurity.Fno` ↔ `GroupSysFuncStorTbl.nFunctNo`
   and `MPOSRelationUserAndFunction.FunctionNo` are candidate action rights.
   Check group and store scoping before translating permission behavior.

All links above require actual SQL metadata/approved source behavior,
controlled sample key-cardinality checks and exception analysis. A matching
column name **does not establish a foreign key**.

## Observed reference control surface

`ShareGeneralSettings` has named flags for prohibiting unposting payment,
receipt, purchase, purchase-return, debit/credit notes, general journal, POS
sales, automatic voucher, cheque deposit/pay and cash deposit documents.
**Existence of a field is not proof the protection is enabled or enforced**.
Before designing a new control, test the original supported behavior with
authorized nonproduction transactions.

`dbo.Settings` has explicit device/serial-port/receipt printer/scanner/scale
and barcode printer fields, while `BarCodeSettings` and
`POS_Print_Settings_Templates` expose template/label/receipt header fields.
Real driver compatibility, screen behavior and terminal connection remain
unverified.

## Next proof required for the 90% goal

1. An approved SQL `SELECT`-only identity, or independent authorized metadata
   export of `sys.columns`, `sys.types`, `sys.indexes`,
   `sys.foreign_keys` and `sys.sql_modules` metadata where permitted.
2. Per-reference-screen and per-action inventory showing role, company,
   department and branch-specific behavior.
3. A controlled, nonfinancial test plan for staff status/attendance,
   permission denial, settings history and device interactions.
4. A signed source-to-new-ERP mapping with test hashes, negative test cases,
   and independent TrustSoft outcome comparisons.
5. Only then increment a workflow from DISCOVERED to ANALYZED, SPECIFIED,
   BUILT, TESTED, MATCHED and ACCEPTED. All 90% numerator calculations
   remain disabled until the weighted reference catalog is frozen.

**Existing implementation:** only synthetic isolated PostgreSQL HR and
configuration schema, read-only API and Flutter demo screens in PR #216.
No real employee/payroll/password data is embedded in the repo.
