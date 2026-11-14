/** AUDIT-111 independent read-only check of immutable native-type mappings. */
import {DatabaseSync} from "node:sqlite";
import {join} from "node:path";
import {severityFor,POLICY,verifyDictionary} from "./classify-operations.mjs";
const [srcDir,archive]=process.argv.slice(2);if(!srcDir||!archive)throw Error("SOURCE_AND_ARCHIVE_REQUIRED");
const known=verifyDictionary(srcDir),db=new DatabaseSync(join(archive,"audit111_history.sqlite"),{readOnly:true});
db.exec("PRAGMA query_only=ON");
const total=db.prepare("SELECT count(*) n FROM audit_events").get().n;
const snapshot=db.prepare("SELECT count(*) n FROM audit111_event_classifications WHERE policy=?").get(POLICY).n;
let compared=0,valid=true,failReasons={};
const counts={P0:0,P1:0,P2:0},types={};
for(const x of db.prepare(`SELECT a.transaction_type AS code,c.type_no,c.triage,c.operation_label,c.source_dictionary_sha
 FROM audit_events a LEFT JOIN audit111_event_classifications c
 ON a.event_id=c.event_id AND c.policy=?`).iterate(POLICY)){
 const expected=known.types.get(x.code);
 if(!expected||x.type_no!==x.code||x.operation_label!==expected||x.triage!==severityFor(x.code)
 ||x.source_dictionary_sha!==known.source_sha){valid=false;failReasons[x.code]=(failReasons[x.code]||0)+1}
 if(x.triage in counts)counts[x.triage]++;
 types[x.code]=(types[x.code]||0)+1;compared++;
}
const accepted=valid&&compared===total&&total===snapshot;
console.log(JSON.stringify({passed:accepted,events:total,verified_classifications:compared,matched_source_dictionary_sha:known.source_sha,
 all_types_explained:valid,totals:counts,priority_types:{
 delete_item:types["30"]||0,modify_invoice_number:types["4"]||0,modify_supplier:types["2"]||0},
 policy:POLICY,interpretation:"risk flags, not fraud confirmations",failReasons:accepted?{}:failReasons},null,2));
db.close();if(!accepted)process.exitCode=2;
