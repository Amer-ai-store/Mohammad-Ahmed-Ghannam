/* AUDIT-111: public, data-free validation for PRIVATE read-only forensic service replies.
   Source events remain on the authenticated backend; never cache in localStorage. */
export const SCHEMA = "jawafa.audit111.v1";
export const DOCUMENT_TYPES = Object.freeze([
  "purchase_invoice","purchase_return","sales_invoice","sales_return",
  "journal","cheque_payment","receipt","deposit","voucher"
]);
export const RISK = Object.freeze(["P0","P1","P2"]);
export const EVIDENCE = Object.freeze(["VERIFIED","DIFF_ONLY","UNVERIFIED"]);
export function validateEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.schema_version !== SCHEMA ||
      value.classification !== "PRIVATE_FINANCIAL_AUDIT" ||
      value.private_access_verified !== true ||
      value.source_integrity_verified !== true ||
      !Array.isArray(value.events) || value.events.length > 500) {
    throw new Error("AUDIT111_UNVERIFIED_SOURCE");
  }
  if (typeof value.snapshot_id !== "string" || !value.snapshot_id ||
      typeof value.verified_at !== "string" || !Number.isFinite(Date.parse(value.verified_at))) {
    throw new Error("AUDIT111_MISSING_RECEIPT");
  }
  const ids = new Set();
  for (const e of value.events) {
    if (!e || typeof e !== "object" || typeof e.event_id !== "string" ||
        !e.event_id || ids.has(e.event_id) || typeof e.document_id !== "string" ||
        !DOCUMENT_TYPES.includes(e.document_type) ||
        !RISK.includes(e.severity) || !EVIDENCE.includes(e.evidence_level) ||
        typeof e.observed_at !== "string" || !Number.isFinite(Date.parse(e.observed_at)) ||
        typeof e.source_ref !== "string" || !e.source_ref ||
        typeof e.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(e.sha256)) {
      throw new Error("AUDIT111_INVALID_EVENT");
    }
    ids.add(e.event_id);
  }
  if (!Number.isSafeInteger(value.history_record_count) || value.history_record_count < 0 ||
      !value.risk_totals || typeof value.risk_totals !== "object" ||
      !RISK.every(k => Number.isSafeInteger(value.risk_totals[k]) && value.risk_totals[k]>=0) ||
      RISK.reduce((a,k)=>a+value.risk_totals[k],0)!==value.history_record_count ||
      value.events.length > value.history_record_count) {
    throw new Error("AUDIT111_INCONSISTENT_AGGREGATE");
  }
  return value;
}
export function visibleActor(event) {
  if (event.actor_verified === true && typeof event.actor === "string" && event.actor.trim())
    return event.actor.trim();
  const account = event.system_user || event.user_id;
  return typeof account === "string" && account.trim()
    ? "حساب نظام: " + account.trim() + " (الشخص غير مثبت)"
    : "غير مثبت";
}
export function summarize(events) {
  return Object.fromEntries(RISK.map(risk=>[risk, events.filter(e=>e.severity===risk).length]));
}
export function filterEvents(events, query="",type="all",risk="all") {
  const q=String(query).trim().toLocaleLowerCase("ar");
  return events.filter(e=>(type==="all"||e.document_type===type) &&
    (risk==="all"||e.severity===risk) &&
    (!q||[e.document_id,e.event_id,e.field,visibleActor(e)]
      .some(v=>String(v??"").toLocaleLowerCase("ar").includes(q))))
    .sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at));
}

/** Validate a server-authorized, hash-verified PRIVATE report envelope. */
export function validateReport(value,expectedSnapshot) {
  if (!value || typeof value!=="object" || Array.isArray(value) ||
      value.schema_version!=="jawafa.audit111.report.v1" ||
      value.classification!=="PRIVATE_FINANCIAL_AUDIT" ||
      value.source_integrity_verified!==true ||
      value.snapshot_id!==expectedSnapshot ||
      !Number.isFinite(Date.parse(value.verified_at||"")) ||
      !value.summary || !value.cases ||
      !Array.isArray(value.reports) || value.reports.length!==5) {
    throw new Error("AUDIT111_REPORT_UNVERIFIED_SOURCE");
  }
  const counts=value.summary;
  const validInt=x=>Number.isSafeInteger(x)&&x>=0;
  if (![counts.old_events,counts.latest_events,counts.new_events,
         counts.purchase_value_changed,counts.posted_returns_with_gl_candidate,
         counts.invoice_reference_rekeys,counts.return_value_changed_invoices]
        .every(validInt) ||
      counts.latest_events-counts.old_events!==counts.new_events ||
      !Array.isArray(value.cases.purchase_changes) ||
      !Array.isArray(value.cases.returns) ||
      !Array.isArray(value.cases.invoice_rekeys) ||
      value.cases.purchase_changes.length!==counts.purchase_value_changed ||
      value.cases.returns.length!==counts.posted_returns_with_gl_candidate ||
      value.cases.invoice_rekeys.length!==counts.invoice_reference_rekeys ||
      !Number.isFinite(counts.net_purchase_cost_field_delta)) {
    throw new Error("AUDIT111_REPORT_INCONSISTENT_TOTALS");
  }
  const names=new Set();
  for (const r of value.reports) {
    if (!r || typeof r.id!=="string" || names.has(r.id) ||
        typeof r.title!=="string" || typeof r.state!=="string" || !validInt(r.count))
      throw new Error("AUDIT111_REPORT_INVALID_CATALOG");
    names.add(r.id);
  }
  return value;
}
