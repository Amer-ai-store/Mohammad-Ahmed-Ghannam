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
