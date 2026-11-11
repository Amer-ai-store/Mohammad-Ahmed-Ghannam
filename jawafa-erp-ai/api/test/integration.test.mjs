import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createOidcVerifier } from '../src/auth.mjs';
import { buildRuntimeConfig, createServer } from '../src/server.mjs';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const CH_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CH_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ISSUER = 'https://issuer.example.test/';
const AUDIENCE = 'jawafa-erp-api';
let key, jwksUrl, jwksServer, apiServer, pool, baseUrl;

async function call(path, {jwt, tenant, branch, method='GET', origin}={}) {
  const headers = {};
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  if (tenant) headers['x-erp-tenant-id'] = tenant;
  if (branch) headers['x-erp-branch-id'] = branch;
  if (origin) headers.origin = origin;
  const response = await fetch(baseUrl + path, {method, headers, redirect:'manual'});
  return {status:response.status, body:await response.json(), headers:response.headers};
}
async function token(sub, {aud=AUDIENCE,issuer=ISSUER,signedBy=key}={}) {
  return new SignJWT({sub})
    .setProtectedHeader({alg:'RS256',kid:'ci-key'})
    .setIssuer(issuer).setAudience(aud).setIssuedAt()
    .setExpirationTime('5m').sign(signedBy);
}
before(async () => {
  if (!process.env.ERP_TEST_DATABASE_URL) throw Error('ERP_TEST_DATABASE_URL_REQUIRED');
  const pair = await generateKeyPair('RS256');
  key = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  Object.assign(jwk,{kid:'ci-key',alg:'RS256',use:'sig'});
  jwksServer = http.createServer((_req,res) => {
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({keys:[jwk]}));
  });
  jwksServer.listen(0,'127.0.0.1');
  await once(jwksServer,'listening');
  jwksUrl = `http://127.0.0.1:${jwksServer.address().port}/keys`;
  pool = new pg.Pool({connectionString:process.env.ERP_TEST_DATABASE_URL,ssl:false});
  const verifyToken = createOidcVerifier({
    issuer:ISSUER,audience:AUDIENCE,jwksUrl,allowLocalHttpJwks:true,
  });
  apiServer = createServer({pool,verifyToken,allowedOrigins:['https://erp.example.test']});
  apiServer.listen(0,'127.0.0.1');
  await once(apiServer,'listening');
  baseUrl = `http://127.0.0.1:${apiServer.address().port}`;
});
after(async () => {
  if (apiServer) await new Promise((resolve)=>apiServer.close(resolve));
  if (jwksServer) await new Promise((resolve)=>jwksServer.close(resolve));
  if (pool) await pool.end();
});

test('health does not expose database or identity secrets',async()=>{
  const r=await call('/health/live');
  assert.equal(r.status,200);
  assert.equal(r.body.status,'up');
  assert.equal(JSON.stringify(r.body).includes('DATABASE_URL'),false);
});
test('no token or bad JWT is rejected',async()=>{
  assert.equal((await call('/v1/cheques',{tenant:A})).status,401);
  assert.equal((await call('/v1/cheques',{tenant:A,jwt:'not.a.jwt'})).status,401);
});
test('wrong key, issuer and audience are all rejected',async()=>{
  const fake=(await generateKeyPair('RS256')).privateKey;
  assert.equal((await call('/v1/cheques',{tenant:A,
    jwt:await token('member-A',{signedBy:fake})})).status,401);
  assert.equal((await call('/v1/cheques',{tenant:A,
    jwt:await token('member-A',{aud:'wrong'})})).status,401);
  assert.equal((await call('/v1/cheques',{tenant:A,
    jwt:await token('member-A',{issuer:'https://wrong.example.test/'})})).status,401);
});
test('identity must belong to exact company and role',async()=>{
  const jwt=await token('member-A');
  assert.equal((await call('/v1/cheques',{jwt,tenant:B})).status,403);
  assert.equal((await call('/v1/cheques',{jwt})).status,400);
  assert.equal((await call('/v1/cheques',{jwt,tenant:'x'})).status,400);
  assert.equal((await call('/v1/cheques',{tenant:A,
    jwt:await token('viewer-A')})).status,403);
  assert.equal((await call('/v1/cheques',{tenant:A,
    jwt:await token('inactive-A')})).status,403);
});
test('company A reads only own cheque and sanitized events',async()=>{
  const jwt=await token('member-A');
  const r=await call('/v1/cheques',{jwt,tenant:A});
  assert.equal(r.status,200);
  assert.equal(r.body.items.length,1);
  assert.equal(r.body.items[0].reference_no,'SYNTHETIC-A');
  assert.equal(r.body.items[0].amount_fils,'1200500');
  assert.equal(r.body.items[0].current_state,'registered');
  const e=await call(`/v1/cheques/${CH_A}/events`,{jwt,tenant:A});
  assert.equal(e.status,200);
  assert.equal(e.body.items.length,1);
  assert.equal('reason' in e.body.items[0],false);
  const foreign=await call(`/v1/cheques/${CH_B}`,{jwt,tenant:A});
  assert.equal(foreign.status,404);
});
test('company B reader sees only B cheque, never A ledger',async()=>{
  const jwt=await token('member-B');
  const r=await call('/v1/cheques',{jwt,tenant:B});
  assert.equal(r.status,200);
  assert.equal(r.body.items.length,1);
  assert.equal(r.body.items[0].reference_no,'SYNTHETIC-B');
  const j=await call('/v1/journals/draft-balances',{jwt,tenant:B});
  assert.equal(j.status,200);
  assert.equal(j.body.items.length,0);
});
test('draft journal balance is exact, and write methods are denied',async()=>{
  const jwt=await token('member-A');
  const r=await call('/v1/journals/draft-balances',{jwt,tenant:A});
  assert.equal(r.status,200);
  assert.equal(r.body.items.length,1);
  assert.equal(r.body.items[0].balanced_for_review,true);
  assert.equal(r.body.items[0].debit_total_fils,'100250');
  assert.equal(r.body.items[0].credit_total_fils,'100250');
  assert.equal((await call('/v1/cheques',{jwt,tenant:A,method:'POST'})).status,405);
  assert.equal((await call('/v1/cheques',{jwt,tenant:A,method:'DELETE'})).status,405);
});
test('unapproved web origins are denied, allowed origin is explicit',async()=>{
  const jwt=await token('member-A');
  assert.equal((await call('/v1/cheques',{jwt,tenant:A,
    origin:'https://attacker.example'})).status,403);
  const yes=await call('/v1/cheques',{jwt,tenant:A,
    origin:'https://erp.example.test'});
  assert.equal(yes.status,200);
  assert.equal(yes.headers.get('access-control-allow-origin'),'https://erp.example.test');
});
test('service database login cannot write or bypass SQL row security',async()=>{
  const c=await pool.connect();
  try{
    const r=await c.query('SELECT rolbypassrls,rolsuper FROM pg_roles WHERE rolname=current_user');
    assert.equal(r.rows[0].rolbypassrls,false);
    assert.equal(r.rows[0].rolsuper,false);
    await assert.rejects(c.query('DELETE FROM erp.cheques'),(e)=>e.code==='42501');
  }finally{c.release();}
});
test('supplier invoice and draft totals are read-only, company-scoped and normalized',async()=>{
  const aToken=await token('member-A');
  const a=await call('/v1/purchase-invoices',{jwt:aToken,tenant:A});
  assert.equal(a.status,200);
  assert.equal(a.body.items.length,1);
  assert.equal(a.body.items[0].invoice_number_key,'INV-123');
  assert.equal(a.body.items[0].total_fils,'100250');
  assert.equal(a.body.items[0].net_fils,'90000');
  assert.equal(a.body.items[0].tax_fils,'10250');
  assert.equal(a.body.items[0].draft_total_matches_lines,true);
  const supplier=await call('/v1/suppliers',{jwt:aToken,tenant:A});
  assert.equal(supplier.status,200);
  assert.equal(supplier.body.items.length,1);
  assert.equal(supplier.body.items[0].supplier_code,'SYN-A');
  const b=await call('/v1/purchase-invoices',{
    jwt:await token('member-B'),tenant:B,
  });
  assert.equal(b.status,200);
  assert.equal(b.body.items.length,1);
  assert.equal(b.body.items[0].draft_total_matches_lines,false);
  assert.equal((await call('/v1/purchase-invoices',{jwt:aToken,tenant:B})).status,403);
  assert.equal((await call('/v1/purchase-invoices',{
    jwt:await token('viewer-A'),tenant:A,
  })).status,403);
  assert.equal((await call('/v1/purchase-invoices',{
    jwt:aToken,tenant:A,method:'PATCH',
  })).status,405);
});

test('missing production configuration and plaintext remote data reject',()=>{
  assert.throws(()=>createOidcVerifier({
    issuer:ISSUER,audience:AUDIENCE,jwksUrl,
  }),/HTTPS/);
  assert.throws(()=>buildRuntimeConfig({}),/CONFIGURATION_MISSING/);
  assert.throws(()=>buildRuntimeConfig({
    NODE_ENV:'test',ERP_ALLOW_LOCAL_PLAINTEXT_DB:'1',
    ERP_DATABASE_URL:'postgresql://guest@not-localhost/db',
    ERP_OIDC_ISSUER:ISSUER,ERP_OIDC_AUDIENCE:AUDIENCE,
    ERP_OIDC_JWKS_URL:jwksUrl,
  }),/LOOPBACK/);
});


test('HR directory uses company-specific permission, not finance role alone',async()=>{
  const hr=await call('/v1/personnel',{jwt:await token('hr-A'),tenant:A});
  assert.equal(hr.status,200);
  assert.equal(hr.body.items.length,1);
  assert.equal(hr.body.items[0].employee_code,'EMP-A');
  assert.equal(hr.body.items[0].department_code,'OPS');
  assert.equal('salary' in hr.body.items[0],false);
  assert.equal((await call('/v1/personnel',{
    jwt:await token('member-A'),tenant:A,
  })).status,403);
  assert.equal((await call('/v1/personnel',{
    jwt:await token('member-B'),tenant:B,
  })).status,403); // explicit allowed=false must deny
  assert.equal((await call('/v1/personnel',{
    jwt:await token('hr-A'),tenant:B,
  })).status,403); // no cross-tenant membership
  assert.equal((await call('/v1/cheques',{
    jwt:await token('hr-A'),tenant:A,
  })).status,403); // HR permission must not grant finance
  assert.equal((await call('/v1/personnel',{
    jwt:await token('hr-A'),tenant:A,method:'PATCH',
  })).status,405);
});

test('settings expose only latest permitted non-secret revision',async()=>{
  const supervisor=await token('supervisor-A');
  const settings=await call('/v1/settings',{jwt:supervisor,tenant:A});
  assert.equal(settings.status,200);
  assert.equal(settings.body.items.length,1);
  assert.deepEqual(settings.body.items[0],{
    setting_key:'locale',setting_value:'ar',revision_no:2,
  });
  assert.equal((await call('/v1/settings',{
    jwt:await token('hr-A'),tenant:A,
  })).status,403);
  const companyB=await call('/v1/settings',{
    jwt:await token('member-B'),tenant:B,
  });
  assert.equal(companyB.status,200);
  assert.equal(companyB.body.items[0].setting_value,'en');
  assert.equal((await call('/v1/settings',{
    jwt:supervisor,tenant:A,method:'DELETE',
  })).status,405);
});

test('role permissions are readable only with explicit permission',async()=>{
  const privileged=await call('/v1/permissions',{
    jwt:await token('supervisor-A'),tenant:A,
  });
  assert.equal(privileged.status,200);
  assert.equal(privileged.body.items.length,4);
  assert.equal('policy_reference' in privileged.body.items[0],false);
  assert.equal((await call('/v1/permissions',{
    jwt:await token('hr-A'),tenant:A,
  })).status,403);
  assert.equal((await call('/v1/permissions',{
    jwt:await token('member-B'),tenant:B,
  })).status,403);
  assert.equal((await call('/v1/permissions',{
    jwt:await token('supervisor-A'),tenant:A,method:'POST',
  })).status,405);
});


const dailyUrl =
  '/v1/reports/daily-movements?from=2026-10-01&to=2026-10-31';

test('new ERP item ledger report uses scoped POSTED events, explicit numeric units',async()=>{
  const r=await call(dailyUrl,{
    jwt:await token('member-A'),tenant:A,branch:'BR-A',
  });
  assert.equal(r.status,200,JSON.stringify(r.body));
  assert.equal(r.body.referenceStatus,'NOT_MATCHED_WITH_TRUSTSOFT');
  assert.equal(r.body.evidenceStatus,'ERP_EVENTS_ONLY_NOT_TRUSTSOFT_PARITY');
  assert.equal(r.body.functionalParityPercent,null);
  assert.equal(r.body.sourceScopedEventCount,4);
  assert.equal(r.body.postedEventCount,3);
  assert.equal(r.body.ignoredVoidedEventCount,1);
  assert.equal(r.body.items.length,2);
  assert.equal(r.body.items[0].day,'2026-10-01');
  assert.equal(r.body.items[0].item_code,'SKU-A');
  assert.equal(r.body.items[0].sales_before_tax_fils,250);
  assert.equal(r.body.items[0].sales_cost_fils,175);
  assert.equal(r.body.items[0].sales_profit_fils,75);
  assert.equal(r.body.items[1].day,'2026-10-02');
  assert.equal(r.body.items[1].sales_before_tax_fils,-25);
  assert.equal(r.body.items[1].purchase_qty_milli,3000);
  assert.equal(r.body.items[1].purchases_before_tax_fils,600);
  assert.equal(JSON.stringify(r.body).includes('PRIVATE-ITEM'),false);
  assert.equal(JSON.stringify(r.body).includes('PRIVATE-OTHER-TENANT'),false);
  assert.equal(JSON.stringify(r.body).includes('EV-A-1'),false);
});

test('branch-specific authorization blocks same tenant unauthorized and revoked branches',async()=>{
  const jwt=await token('member-A');
  for(const branch of ['BR-LOCKED','BR-REVOKED']){
    const r=await call(dailyUrl,{jwt,tenant:A,branch});
    assert.equal(r.status,403);
    assert.equal(r.body.error,'REPORT_BRANCH_ACCESS_DENIED');
    assert.equal(JSON.stringify(r.body).includes('PRIVATE-'),false);
  }
  const approved=await call(dailyUrl,{
    jwt:await token('supervisor-A'),tenant:A,branch:'BR-LOCKED',
  });
  assert.equal(approved.status,200);
  assert.equal(approved.body.items.length,1);
  assert.equal(approved.body.items[0].item_code,'PRIVATE-ITEM');
});

test('company isolation and default-deny roles for reporting',async()=>{
  const user=await token('member-A');
  const viewer=await token('viewer-A');
  assert.equal((await call(dailyUrl,{jwt:user,tenant:B,branch:'BR-A'})).status,403);
  assert.equal((await call(dailyUrl,{jwt:viewer,tenant:A,branch:'BR-A'})).status,403);
  assert.equal((await call(dailyUrl,{tenant:A,branch:'BR-A'})).status,401);
  const other=await call(dailyUrl,{
    jwt:await token('member-B'),tenant:B,branch:'BR-A',
  });
  assert.equal(other.status,200);
  assert.equal(other.body.items.length,1);
  assert.equal(other.body.items[0].item_code,'PRIVATE-OTHER-TENANT');
  assert.equal(JSON.stringify(other.body).includes('SKU-A'),false);
});

test('report is filterable without leaking unrelated items or dates',async()=>{
  const jwt=await token('member-A');
  const one=await call(
    '/v1/reports/daily-movements?from=2026-10-02&to=2026-10-02'+
    '&item=SKU-A&family=FAM-A&supplier=SUP-A',
    {jwt,tenant:A,branch:'BR-A'},
  );
  assert.equal(one.status,200);
  assert.equal(one.body.items.length,1);
  assert.equal(one.body.items[0].day,'2026-10-02');
  const absent=await call(dailyUrl+'&item=NO-SUCH-ITEM',{
    jwt,tenant:A,branch:'BR-A',
  });
  assert.equal(absent.status,200);
  assert.deepEqual(absent.body.items,[]);
  assert.equal(absent.body.sourceScopedEventCount,0);
  assert.equal(absent.body.functionalParityPercent,null);
});

test('invalid, duplicate or over-wide report scope and filters are blocked',async()=>{
  const jwt=await token('member-A');
  const opts={jwt,tenant:A,branch:'BR-A'};
  assert.equal((await call(dailyUrl,{jwt,tenant:A})).status,400);
  const paths=[
    '/v1/reports/daily-movements?from=2026-02-30&to=2026-02-28',
    '/v1/reports/daily-movements?from=2026-10-31&to=2026-10-01',
    '/v1/reports/daily-movements?from=2026-01-01&to=2026-10-31',
    '/v1/reports/daily-movements?from=2026-10-01&from=2026-10-02&to=2026-10-31',
    dailyUrl+'&item==EVAL',
    dailyUrl+'&unknownFilter=1',
  ];
  for(const url of paths){
    assert.equal((await call(url,opts)).status,400,url);
  }
  assert.equal((await call(dailyUrl,{
    ...opts,branch:'../../OTHER',
  })).status,400);
  assert.equal((await call(dailyUrl,{
    ...opts,method:'POST',
  })).status,405);
});

test('new ERP API DB principal is SELECT-only for movement and branch grant records',async()=>{
  const client=await pool.connect();
  try{
    const roles=await client.query(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user");
    assert.equal(roles.rows[0].rolsuper,false);
    assert.equal(roles.rows[0].rolbypassrls,false);
    for(const table of ['item_movement_events','report_branch_access_events']){
      await assert.rejects(client.query('DELETE FROM erp.'+table),
        error=>error.code==='42501');
      await assert.rejects(client.query('UPDATE erp.'+table+
        " SET recorded_at=clock_timestamp()"),error=>error.code==='42501');
    }
  }finally{client.release();}
});

test('new ERP report source RLS hides other company events from direct reader',async()=>{
  const client=await pool.connect();
  try{
    await client.query('BEGIN READ ONLY');
    const a=await client.query(
      "SELECT set_config('erp.tenant_id',$1,true)",[A]);
    const rows=await client.query(
      'SELECT DISTINCT tenant_id::text AS tenant FROM erp.item_movement_events');
    assert.deepEqual(rows.rows.map(x=>x.tenant),[A]);
  }finally{
    try{await client.query('ROLLBACK');}finally{client.release();}
  }
});
