# TrustSoft cheque cycle — reference evidence and engineering gaps

**Evidence date:** 2026-11-09 · **Data source:** `Jawafa_DB` historical CSV export `20261109-0100` on authorized private server.

This is an **aggregated, read-only** profile. No cheque IDs, cheque numbers, account IDs, bank numbers, actor identities, transaction values, or financial source rows are included in GitHub.

## Baseline findings from export, not live SQL

| Finding | Count | Interpretation |
|---|---:|---|
| `dbo.ARPDocuments` rows | 8,130 | Cheque-document candidate records |
| `dbo.CheqMovement` rows | 8,249 | Cheque-movement candidate events |
| Distinct nonzero cheque IDs in documents | 8,130 | Current export only |
| Distinct nonzero cheque IDs in movements | 8,057 | Current export only |
| Movement-side IDs lacking a document in the export | 56 | Needs source and period confirmation; not a deletion finding |
| Document-side IDs without a movement in the export | 129 | Needs lifecycle and export scope confirmation |
| Distinct descriptive event-text pairs | 15 | These are **not necessarily 15 distinct cheque states**; eleven are dynamic, cheque-specific deletion messages |
| Generalized event type: paid outgoing cheque | 8,034 | Audit-description classification, not bank-cleared proof |
| Generalized event type: due-date edit | 110 | Requires before/after chronology |
| Generalized event type: paid cheque | 85 | Must reconcile with bank source |
| Generalized event type: cheque deposit | 9 | Not proof of bank acceptance |
| Free-text deletion descriptions containing cheque-specific data | 11 | **Never publish raw text; deletion reason and authorization need source review** |
| IDs with multiple movement events | 170 | 151 have 2, 16 have 3, 3 have 4 |
| Movement groups with non-monotonic date *strings* when ordered by `SeqId` | 20 | Preliminary string/order comparison, **not** evidence of backdating; requires date parsing and sequence rules |
| Duplicate SeqId within one cheque ID group | 0 | Based on the available CSV |
| Movement entries without bilingual status labels | 0 | Available CSV |

**Private primary evidence (SHA256):**
- `Jawafa_Cheque_Cycle_SourceProfile_20261109_Private.json`: `633ccc1bcda47863565dfd6ee7487ed7e4fb44f671111ce3120868479314af54`.
- `Jawafa_Cheque_Source_Transition_Profile_20261109_Private.json`: `a46c4623ef52f43b88825137006150d27d607cf02da2d2a1ce0adbd33a9af308`.

The private reports are stored at `JawafaAudit_Private/20261109` on the authorized server, not deployed on a public website or in the app.

## Cross-snapshot document/movement mapping — newly verified

A second **FULL** export dated 2026-10-26 was independently compared with the 2026-11-09 FULL export. These are distinct cheque IDs, not monetary totals.

| Evidence | 26 October | 9 November |
|---|---:|---:|
| Document IDs in `ARPDocuments` | 8,093 | 8,130 |
| Movement-linked IDs in `CheqMovement` | 8,033 | 8,057 |
| Movement-linked IDs with no document counterpart in that snapshot | 56 | 56 |
| Document IDs without a movement counterpart in that snapshot | 116 | 129 |

**Delta:** 37 new document IDs and 24 new movement-linked IDs were recorded. No previously exported document or movement ID was absent from the later complete export. None of the 56 current movement-only IDs was found in the 26 October document snapshot, and none of the 129 current document-only IDs was found in the earlier movement snapshot.

**Caution:** The 56 unmatched movement-side keys persist across both complete exports, which warrants investigating record types and joins; it is **not proof that cheque records were deleted or that a crime occurred**. Missing movement history may also be legitimate for the cheque's stage or source-table coverage. An official SQL foreign-key inspection, document-type codes, vouchers and bank originals are still required.

**Private evidence SHA256:** `Jawafa_Cheque_CrossSnapshot_20261109_Private.json` — `48e2ad05cf7fa670de14894858eaa75e2e2b7fd946f8077f1607cff03c5e242e`. The detailed report is held on the authorized private server, not in this repository.

## Exact source fields inspected

- `ARPDocuments.CheqId`, `DocumentNo`, `DocumentType`, `DueDate`, `DocumentValue`, `Status`, `CheckStatus`, `Returned`, `InDeposit`, `deleted`, `replaced`, `Delivered`, `Transfered`, `InBankTransNo`, `InDepositTransNo`.
- `CheqMovement.SeqId`, `CheqId`, `statusA`, `statusE`, `MoveDate`, `TransNo`, `VoucherNo`, `APorAR`.
- Candidate links requiring proof: `CheqId`, transaction/voucher identifiers to `ARPPayMaster`, `ARPJournal_GL`, `ARPFrom_gl` and `ARPTo_GL`.

These are **field and data observations**, not verified primary/foreign key declarations from production SQL Server.

## Reimplementation status

`lib/src/domain/cheque.dart` currently provides a **synthetic 7-state model**, designed for initial separation-of-duties and audit tests. **It is not certified as equivalent to TrustSoft's real cheque state machine: the 15 unique event labels comprise four generic event descriptions plus 11 cheque-specific deletion descriptions, not 15 verified states.** No mappings, migration, reconciliation, bank effects, or tax results are certified as equivalent.

### Required evidence before labeling the cheque lifecycle `MATCHED`

1. Map the **five observed audit-description categories** to verified TrustSoft procedures. Eleven descriptions are cheque-specific free text and must be handled as audit events, not enumerated financial states. Determine the true state machine separately from cheque master fields and validated source UI behavior.
2. Resolve the 56 movement-only and 129 document-only cheque IDs, accounting for record type, date, branch, authorization, and export completeness.
3. Determine whether `SeqId` controls movement chronology; parse timestamps into a consistent timezone before interpreting the 20 observed order differences.
4. Map cheque deposit, delivery, bank return, replacement, cancellation, approval, and account movements to original vouchers and general ledger postings.
5. Validate cheque lifecycle with independent user-supplied TrustSoft UI behavior, approved bank statements and controlled synthetic equivalent transactions.
6. Preserve full maker/checker audit with immutable event IDs and rejected write tests. Keep connection to original `Jawafa_DB` **SELECT-only**.
7. Calculate weighted functional parity only after signed acceptance; as of this version, **TrustSoft functional parity is NOT MEASURED**.

## Privacy/safety

Never upload private source exports to GitHub, public app assets, issue bodies, CI logs, or test fixtures. Counts can be used for development prioritization only. Financial originals must remain unchanged.
