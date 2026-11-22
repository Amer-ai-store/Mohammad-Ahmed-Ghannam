'use strict';
const assert=require('node:assert/strict');const {test}=require('node:test');const {parseSnapshot}=require('../catalog-contract.cjs');
const gate={provenByPrivateGateway:true,tlsChainVerified:true,sqlLoginVerified:'user_read',databaseVerified:'Jawafa_DB',dmlDeniedVerified:true,publicSqlExposure:false,approvedStockView:true,approvedPriceView:true};
const t='2026-11-22T16:00:00.000Z',now='2026-11-22T16:01:00.000Z';
function item(id,qty,extra={}){return {id,sku:'S'+id,name:'صنف '+id,familyCode:id===3?'B':'A',branch:'01',unitKind:'PIECE',availablePieces:qty,priceJod:1.12,priceTaxIncluded:true,quantitySemantics:'NET_READY_MINUS_UNPOSTED_ONCE',...extra}}
function snap(){return {schema:'jawafa-commerce-catalog-v1',source:{host:'JAWAFFASVR',database:'Jawafa_DB'},catalogComplete:true,semanticGate:{inventory:true,prices:true,familyJoin:true},branch:'01',currency:'JOD',priceIncludesTax:true,snapshotAt:t,families:[{code:'A',name:'البقالة'},{code:'B',name:'المنظفات'}],items:[item(1,9),item(2,10),item(3,20)]}}
const run=(s=snap(),g=gate,opts={})=>parseSnapshot(s,g,{now,...opts});
test('10 pieces or more pass; 9 excluded; original families preserved',()=>{const r=run();assert.equal(r.counts.eligible,2);assert.equal(r.counts.skipped.underMinimum,1);assert.deepEqual(r.categories.map(x=>x.name),['البقالة','المنظفات']);assert.equal(r.products[0].stock,10)});
test('weighted/non-piece items excluded without rounding',()=>{const s=snap();s.items[2].unitKind='WEIGHT';const r=run(s);assert.equal(r.counts.eligible,1);assert.equal(r.counts.skipped.notPieces,1)});
test('reader security claims inside snapshot cannot replace trusted evidence',()=>{assert.throws(()=>run(snap(),null),/SECURITY_GATE_FAILED/);assert.throws(()=>run(snap(),{...gate,sqlLoginVerified:'sa'}),/SECURITY_GATE_FAILED/);assert.throws(()=>run(snap(),{...gate,tlsChainVerified:false}),/SECURITY_GATE_FAILED/)});
test('unapproved quantity semantics reject instead of estimating',()=>{const s=snap();s.items[1].quantitySemantics='UNKNOWN';assert.throws(()=>run(s),/STOCK_SEMANTICS_UNKNOWN/)});
test('missing family/branch or duplicate code abort complete import',()=>{let s=snap();s.items[0].familyCode='MISSING';assert.throws(()=>run(s),/INVALID_ITEM_MAPPING/);s=snap();s.items[2].sku='S2';assert.throws(()=>run(s),/DUPLICATE_SKU_OR_ID/)});
test('stale snapshot aborts',()=>{assert.throws(()=>run(snap(),gate,{now:'2026-11-22T17:00:00.000Z'}),/STALE_OR_FUTURE_SNAPSHOT/)});
test('unverified tax-inclusive price aborts',()=>{const s=snap();s.items[1].priceTaxIncluded=false;assert.throws(()=>run(s),/ITEM_PRICE_TAX_UNKNOWN/)});
test('source must be JAWAFFASVR Jawafa_DB, complete and approved',()=>{let s=snap();s.source.database='Other_DB';assert.throws(()=>run(s),/SOURCE_MISMATCH/);s=snap();s.catalogComplete=false;assert.throws(()=>run(s),/SEMANTIC_GATE_FAILED/)});
