/** AUDIT-111: aggregate evidence coverage without printing any financial document, user name or amount. */
import {DatabaseSync} from "node:sqlite";
import {join} from "node:path";
const dir=process.argv[2];if(!dir)throw Error("REQUIRED_PRIVATE_DIR");
const db=new DatabaseSync(join(dir,"audit111_history.sqlite"),{readOnly:true});db.exec("PRAGMA query_only=ON");
const row=db.prepare(`SELECT
 count(*) AS total,
 sum(CASE WHEN trim(coalesce(old_value,''))<>'' AND trim(coalesce(new_value,''))<>'' THEN 1 ELSE 0 END) AS both_values_present,
 sum(CASE WHEN trim(coalesce(old_value,''))<>'' AND trim(coalesce(new_value,''))='' THEN 1 ELSE 0 END) AS old_only,
 sum(CASE WHEN trim(coalesce(old_value,''))='' AND trim(coalesce(new_value,''))<>'' THEN 1 ELSE 0 END) AS new_only,
 sum(CASE WHEN trim(coalesce(old_value,''))='' AND trim(coalesce(new_value,''))='' THEN 1 ELSE 0 END) AS neither,
 sum(CASE WHEN trim(coalesce(old_value,''))<>'' AND trim(coalesce(new_value,''))<>''
            AND old_value<>new_value THEN 1 ELSE 0 END) AS explicit_different_pair,
 sum(CASE WHEN trim(coalesce(transaction_description,''))<>'' THEN 1 ELSE 0 END) AS description_present,
 sum(CASE WHEN trim(coalesce(trans_date,''))<>'' AND trim(coalesce(trans_time,''))<>'' THEN 1 ELSE 0 END) AS dates_and_times,
 sum(CASE WHEN trim(coalesce(receipt_no,''))<>'' THEN 1 ELSE 0 END) AS receipt_link,
 sum(CASE WHEN trim(coalesce(user_id,''))<>'' THEN 1 ELSE 0 END) AS system_user_id
 FROM audit_events`).get();
const dated=db.prepare("SELECT substr(trans_date,1,7) AS month,count(*) AS events FROM audit_events GROUP BY substr(trans_date,1,7) ORDER BY month").all();
const mapped=db.prepare(`SELECT count(*) AS events_mapped FROM audit_events a WHERE EXISTS(
  SELECT 1 FROM user_directory u WHERE u.user_id=a.user_id)`).get();
console.log(JSON.stringify({coverage:row,monthly_counts:dated,accounts:mapped,
  finding:"A logged history row is not necessarily an invoice modification. Before/after pairs are only explicit when both are present.",
  provenance:"PRIVATE_SQLITE_ONLY",claims_of_human_attribution:false},null,2));db.close();
