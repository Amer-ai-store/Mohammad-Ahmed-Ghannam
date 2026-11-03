import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReport} from '../audit111/model.mjs';
function fixture(){
 return {
  schema_version:'jawafa.audit111.report.v1',classification:'PRIVATE_FINANCIAL_AUDIT',
  source_integrity_verified:true,snapshot_id:'TEST-SHA',
  verified_at:'2026-11-03T00:00:00.000Z',
  summary:{old_events:22,latest_events:25,new_events:3,purchase_value_changed:1,
   posted_returns_with_gl_candidate:1,invoice_reference_rekeys:1,
   return_value_changed_invoices:2,net_purchase_cost_field_delta:1.25},
  reports:Array.from({length:5},(_,i)=>({id:'case-'+i,title:'SYNTHETIC',state:'TEST',count:1})),
  cases:{purchase_changes:[{id:'test-a'}],returns:[{id:'test-b'}],invoice_rekeys:[{id:'test-c'}]},
  clock_verified:false,actor_verified:false,source_kind:'SYNTHETIC_ONLY'
 };
}
test('private report validates consistent counts and matching snapshot',()=>{
 assert.equal(validateReport(fixture(),'TEST-SHA').summary.new_events,3);
});
test('wrong source, visibility or metadata rejected',()=>{
 for(const patch of [
  {snapshot_id:'WRONG'}, {classification:'PUBLIC'},
  {source_integrity_verified:false}, {verified_at:'not-a-date'},
  {schema_version:'bad'}, {reports:[]}
 ])assert.throws(()=>validateReport({...fixture(),...patch},'TEST-SHA'));
});
test('report data must reconcile historical counts and section lengths',()=>{
 for(const summary of [
  {...fixture().summary,new_events:4},
  {...fixture().summary,purchase_value_changed:10},
  {...fixture().summary,net_purchase_cost_field_delta:NaN}
 ])assert.throws(()=>validateReport({...fixture(),summary},'TEST-SHA'));
});
test('duplicate catalog and invalid count are rejected',()=>{
 const duplicate=fixture();duplicate.reports[1].id=duplicate.reports[0].id;
 assert.throws(()=>validateReport(duplicate,'TEST-SHA'));
 const invalid=fixture();invalid.reports[0].count=-1;
 assert.throws(()=>validateReport(invalid,'TEST-SHA'));
});
test('synthetic QA does not assert verified human identity',()=>{
 assert.equal(fixture().actor_verified,false);
 assert.equal(fixture().clock_verified,false);
});
