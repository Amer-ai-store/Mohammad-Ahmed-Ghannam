import test from "node:test";
import assert from "node:assert/strict";
import {severityFor,POLICY} from "../../tools/audit111/classify-operations.mjs";
test("TrustSoft-native operation types are used instead of string heuristic",()=>{
 assert.equal(POLICY,"TRUSTSOFT_OP_V1");
 assert.equal(severityFor("30"),"P0"); // delete ITEM, not voucher
 assert.equal(severityFor("2"),"P0"); // change supplier
 assert.equal(severityFor("4"),"P0"); // change invoice number
 assert.equal(severityFor("31"),"P1"); // item quantity
 assert.equal(severityFor("33"),"P1"); // item cost
 assert.equal(severityFor("29"),"P1"); // add item
 assert.equal(severityFor("47"),"P1"); // tax details
 assert.equal(severityFor("26"),"P2"); // note
 assert.equal(severityFor("unknown"),"P2");
});
test("risk scores are investigative priority and not a fraud verdict",()=>{
 assert.equal(typeof severityFor("30"),"string");
 assert.notEqual(severityFor("30"),"VERIFIED_FRAUD");
});
