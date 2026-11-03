/* Jawafa chat-report register: strict private-gateway envelope, no financial content in public assets. */
export const LEDGER_SCHEMA = "jawafa.chat-reports.v1";
export const CATEGORIES = Object.freeze(["موجز","تحقيق مالي","مطابقة بنكية","أمن","تشغيل","تصدير واستعادة","تدقيق","تنبيهات"]);
export const STATES = Object.freeze(["VERIFIED","PARTIAL","DIFF_ONLY","UNVERIFIED","NOT_ACCEPTED","BLOCKED"]);
const valid = value => typeof value === "string" && value.length > 0;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const sha = value => /^[a-f0-9]{64}$/i.test(String(value||""));
const fail = message => { throw new Error(message); };
const time = value => valid(value) && ISO_TIME.test(value) && Number.isFinite(Date.parse(value));
const text = (value,limit,label) => valid(value) && value.length <= limit ? value : fail("INVALID_"+label);
export function privateDriveUrl(value){
  if(!valid(value))return null;
  let url;
  try{url=new URL(value)}catch{return null}
  if(url.protocol!=="https:" || url.username || url.password || url.hash || url.port)return null;
  if(!["docs.google.com","drive.google.com"].includes(url.hostname))return null;
  if(!(/^\/(document|spreadsheets)\/d\/[A-Za-z0-9_-]{15,}(?:\/|$)/.test(url.pathname) ||
       /^\/(file\/d\/[A-Za-z0-9_-]{15,}|drive\/folders\/[A-Za-z0-9_-]{15,})(?:\/|$)/.test(url.pathname)))return null;
  // Drive links are only handed to the verified owner by the private service.
  return url.href;
}
export function normalizeLedger(raw,now=Date.now()){
  if(!raw || typeof raw!=="object" || Array.isArray(raw))fail("INVALID_ENVELOPE");
  if(raw.schema!==LEDGER_SCHEMA)fail("SCHEMA_MISMATCH");
  const a=raw.access||{};
  if(a.authenticated!==true || a.role!=="owner" || a.scope!=="jawafa.reports.read" || a.gateway!=="private")fail("NOT_AUTHORIZED");
  const s=raw.source||{};
  if(s.kind!=="google_drive_private" || s.integrity!=="verified" || s.time_authority!=="independent_utc" || !sha(s.source_sha256))fail("SOURCE_NOT_VERIFIED");
  text(s.snapshot_id,128,"SNAPSHOT");
  if(!time(s.verified_at) || !time(s.expires_at))fail("INVALID_SOURCE_TIME");
  const t=Date.parse(s.verified_at),end=Date.parse(s.expires_at);
  if(t>now+5*60*1000 || end<=now || end<=t || end-t>24*60*60*1000)fail("SOURCE_EXPIRED_OR_FUTURE");
  if(!Array.isArray(raw.reports) || raw.reports.length>100)fail("INVALID_REPORT_COUNT");
  const seen=new Set();
  const reports=raw.reports.map(r=>{
    if(!r || typeof r!=="object" || Array.isArray(r))fail("INVALID_REPORT");
    const id=text(r.id,128,"REPORT_ID");
    if(seen.has(id))fail("DUPLICATE_REPORT_ID");
    seen.add(id);
    if(!CATEGORIES.includes(r.category))fail("INVALID_CATEGORY");
    if(!STATES.includes(r.state))fail("INVALID_STATE");
    if(!STATES.includes(r.evidence_status))fail("INVALID_EVIDENCE_STATUS");
    if(!time(r.as_of))fail("INVALID_REPORT_TIME");
    const link=privateDriveUrl(r.url);
    if(r.url && !link)fail("UNTRUSTED_REPORT_URL");
    return Object.freeze({
      id,title:text(r.title,180,"TITLE"),category:r.category,state:r.state,
      evidence_status:r.evidence_status,
      evidence_id:text(r.evidence_id,128,"EVIDENCE_ID"),
      as_of:r.as_of,summary:text(r.summary,600,"SUMMARY"),url:link
    });
  });
  return Object.freeze({snapshotId:s.snapshot_id,verifiedAt:s.verified_at,expiresAt:s.expires_at,
    reports:Object.freeze(reports),count:reports.length});
}
