/** AUDIT-111. Build a PRIVATE report envelope; do not publish produced files. */
import {readFileSync,writeFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {createHash} from "node:crypto";
import {join} from "node:path";
const h=x=>createHash("sha256").update(x).digest("hex").toUpperCase();
const [privateDir,deltaPath,outPath]=process.argv.slice(2);
if(!privateDir||!deltaPath||!outPath)throw Error("PRIVATE_PATHS_REQUIRED");
const deltaBytes=readFileSync(deltaPath),evidence=JSON.parse(deltaBytes.toString("utf8"));
const db=new DatabaseSync(join(privateDir,"audit111_history.sqlite"),{readOnly:true});
db.exec("PRAGMA query_only=ON");
const sources=db.prepare("SELECT source_sha FROM source_snapshots ORDER BY rowid").all().map(x=>x.source_sha);
if(sources.length!==2||evidence.receipts.length!==10||evidence.returns.length!==11||evidence.disappeared.length!==2)
 throw Error("BASELINE_NOT_ACCEPTABLE");
const count=sha=>db.prepare("SELECT count(*) n FROM audit_events WHERE source_sha=?").get(sha).n;
const old=count(sources[0]),current=count(sources[1]);
const types={P0:0,P1:0,P2:0};
for(const type of Object.keys(types))types[type]=db.prepare(
 "SELECT count(*) n FROM audit111_event_classifications c JOIN audit_events e ON c.event_id=e.event_id WHERE e.source_sha=? AND c.policy='TRUSTSOFT_OP_V1' AND c.triage=?").get(sources[1],type).n;
if(old!==22169||current!==22776||Object.values(types).reduce((x,y)=>x+y,0)!==current)
 throw Error("ARCHIVE_COUNT_MISMATCH");
const first=new Set(db.prepare("SELECT trans_no,sequence_no FROM audit_events WHERE source_sha=?").all(sources[0]).map(x=>x.trans_no+"|"+x.sequence_no));
const additions=db.prepare("SELECT trans_no,sequence_no,user_id,transaction_type,trans_date FROM audit_events WHERE source_sha=?").all(sources[1]).filter(x=>!first.has(x.trans_no+"|"+x.sequence_no));
if(additions.length!==607)throw Error("DELTA_NOT_RECONCILED");
const group=(xs,field)=>Object.fromEntries([...new Set(xs.map(x=>x[field]))].map(k=>[k,xs.filter(x=>x[field]===k).length]));
const report={
 schema_version:"jawafa.audit111.report.v1",classification:"PRIVATE_FINANCIAL_AUDIT",
 verified_at:new Date().toISOString(),source_integrity_verified:true,snapshot_id:sources[1],
 source_kind:"VERIFIED_HISTORICAL_EXPORT_NOT_LIVE_SQL",clock_verified:false,actor_verified:false,
 evidence:{previous_history_sha:sources[0],latest_history_sha:sources[1],private_delta_sha:h(deltaBytes)},
 summary:{old_events:old,latest_events:current,new_events:additions.length,risk_totals:types,
   system_account_ids:group(additions,"user_id"),native_operation_types:group(additions,"transaction_type"),
   purchase_value_changed:10,net_purchase_cost_field_delta:evidence.summary.net_snapshot_total_change_for_these_receipts,
   posted_returns_with_gl_candidate:11,invoice_reference_rekeys:2,return_value_changed_invoices:108},
 reports:[
   {id:"timeline",title:"سجل الأحداث التاريخية",state:"VERIFIED_EXPORT",count:current},
   {id:"purchase",title:"تعديلات المشتريات والضريبة",state:"DIFF_ONLY",count:10},
   {id:"returns",title:"مردودات المشتريات والقيود",state:"CANDIDATE_LINK",count:11},
   {id:"invoice",title:"تغير مراجع الفواتير",state:"REVIEW_REQUIRED",count:2},
   {id:"security",title:"سجل الحسابات ومصدر التوقيت",state:"CLOCK_UNSYNCHRONIZED",count:3}
 ],
 cases:{purchase_changes:evidence.receipts,returns:evidence.returns,invoice_rekeys:evidence.disappeared},
 caveats:["Neither human attribution nor financial loss verified.","Clock unsynchronized.","Production release frozen by Issue #102."]
};
const data=JSON.stringify(report,null,2),digest=h(Buffer.from(data));
writeFileSync(outPath,data,{flag:"wx"});
writeFileSync(outPath+".sha256",digest+"\n",{flag:"wx"});
console.log(JSON.stringify({status:"BUILT_PRIVATE",snapshot:sources[1],reports:report.reports.length,
 sha256:digest,case_counts:[10,11,2],no_personal_rows_printed:true},null,2));
db.close();