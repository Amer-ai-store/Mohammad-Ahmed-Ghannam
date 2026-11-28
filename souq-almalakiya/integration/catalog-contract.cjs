'use strict';
/**
 * Pure, fail-closed catalog transformation. This module NEVER touches SQL,
 * writes files, posts orders, or establishes source authenticity itself.
 * Its caller must verify the local reader identity, trusted TLS, deny-DML,
 * signed channel and stock/price semantics independently.
 */
class ImportRejected extends Error { constructor(code,detail=''){super(`${code}${detail?': '+detail:''}`);this.code=code;} }
function reject(code,detail){throw new ImportRejected(code,detail)}
function validText(s,n=150){return typeof s==='string' && s.trim().length>0 && s.trim().length<=n;}
const finite=n=>typeof n==='number' && Number.isFinite(n);
function parseSnapshot(snapshot, trustedChannelEvidence, {now=new Date(), maxAgeMinutes=15, minimumPieces=10}={}) {
  // Never accept source/self-asserted privileges as proof of trust: evidence is
  // provided by the already authenticated, private ingestion layer only.
  if (!trustedChannelEvidence || trustedChannelEvidence.provenByPrivateGateway!==true ||
      trustedChannelEvidence.tlsChainVerified!==true || trustedChannelEvidence.sqlLoginVerified!=='user_read' ||
      trustedChannelEvidence.databaseVerified!=='Jawafa_DB' || trustedChannelEvidence.dmlDeniedVerified!==true ||
      trustedChannelEvidence.publicSqlExposure===true || trustedChannelEvidence.approvedStockView!==true ||
      trustedChannelEvidence.approvedPriceView!==true)
    reject('SECURITY_GATE_FAILED');
  if (!snapshot || snapshot.schema!=='jawafa-commerce-catalog-v1')reject('SCHEMA_MISMATCH');
  if (snapshot.source?.database!=='Jawafa_DB'||snapshot.source?.host!=='JAWAFFASVR')reject('SOURCE_MISMATCH');
  if(snapshot.catalogComplete!==true || snapshot.semanticGate?.inventory!==true || snapshot.semanticGate?.prices!==true || snapshot.semanticGate?.familyJoin!==true)
    reject('SEMANTIC_GATE_FAILED');
  if (!validText(snapshot.branch,80) || snapshot.currency!=='JOD' || snapshot.priceIncludesTax!==true)
    reject('BRANCH_OR_PRICE_POLICY_MISSING');
  const ts=new Date(snapshot.snapshotAt).getTime(), nowms=new Date(now).getTime();
  if (!Number.isFinite(ts) || ts>nowms+60_000 || nowms-ts>maxAgeMinutes*60_000)reject('STALE_OR_FUTURE_SNAPSHOT');
  if (!Array.isArray(snapshot.families)||!snapshot.families.length||!Array.isArray(snapshot.items)||!snapshot.items.length)
    reject('EMPTY_OR_INCOMPLETE_CATALOG');
  if (snapshot.items.length>250_000)reject('CATALOG_TOO_LARGE');
  const families=new Map();
  for (const f of snapshot.families){
    if(!validText(f.code,80)||!validText(f.name))reject('INVALID_FAMILY');
    if(families.has(f.code))reject('DUPLICATE_FAMILY',f.code);
    families.set(f.code,f.name.trim());
  }
  const seenIds=new Set(),seenSku=new Set();
  const items=[];const skipped={underMinimum:0,notPieces:0};
  for (const p of snapshot.items){
    if(!p||!Number.isSafeInteger(p.id)||p.id<1||!validText(p.sku,80)||!validText(p.name,180)||
       !validText(p.familyCode,80)||!families.has(p.familyCode)||p.branch!==snapshot.branch)
      reject('INVALID_ITEM_MAPPING');
    if(seenIds.has(p.id)||seenSku.has(p.sku))reject('DUPLICATE_SKU_OR_ID',p.sku);
    seenIds.add(p.id);seenSku.add(p.sku);
    // Do not interpret kilograms, packs or mixed units as individual pieces.
    if(p.unitKind!=='PIECE') {skipped.notPieces++;continue;}
    if(!Number.isSafeInteger(p.availablePieces)||p.availablePieces<0||!finite(p.priceJod)||p.priceJod<0)
      reject('INVALID_PIECE_QUANTITY_OR_PRICE',p.sku);
    if (p.quantitySemantics!=='NET_READY_MINUS_UNPOSTED_ONCE')reject('STOCK_SEMANTICS_UNKNOWN',p.sku);
    if (p.priceTaxIncluded!==true)reject('ITEM_PRICE_TAX_UNKNOWN',p.sku);
    if(p.availablePieces<minimumPieces){skipped.underMinimum++;continue;}
    items.push({id:p.id,sku:p.sku,name:p.name.trim(),category:'jawafa:'+p.familyCode,
      familyCode:p.familyCode,unit:'حبة',price:Math.round(p.priceJod*1000)/1000,
      stock:p.availablePieces,source:'Jawafa_DB',branch:p.branch,snapshotAt:snapshot.snapshotAt,
      rating:0,tags:[],desc:'صنف من جوافة، يخضع لسياسة الأسعار والمخزون المعتمدة.',emoji:'🛒'});
  }
  const presentFamilies=new Set(items.map(p=>p.familyCode));
  const categories=[...families.entries()].filter(([code])=>presentFamilies.has(code))
    .map(([code,name])=>({id:'jawafa:'+code,name,code,emoji:'🛒',color:'#E8F4EE'}));
  return {schema:'jawafa-store-catalog-v1',source:'Jawafa_DB',branch:snapshot.branch,snapshotAt:snapshot.snapshotAt,
    minimumPieces,items,products:items,categories,
    counts:{totalSource:snapshot.items.length,eligible:items.length,families:categories.length,skipped},
    note:'Validated mapping only. Caller must persist this result only in a separate commerce DB after live provenance gate.'};
}
module.exports={parseSnapshot,ImportRejected};
