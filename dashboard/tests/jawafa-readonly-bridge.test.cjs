'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const load=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=load('index.html');
const central=load('jawafa-readonly-kpis.js');
const erp=load('jawafa-2100-reference.js');
const integration=load('jawafa-integration.js');
const bridge=fs.readFileSync(path.resolve(root,'../jawafa-command-bridge/server.cjs'),'utf8');

test('both central dashboard and green ERP 2100 have authenticated private performance UI',()=>{
  assert.match(html,/id="jawafa-secure-kpis"/);
  assert.match(html,/src="\.\/jawafa-readonly-kpis\.js"/);
  assert.match(central,/\/api\/jawafa\/v1\/performance/);
  assert.match(erp,/\/api\/jawafa\/v1\/performance/);
  assert.match(bridge,/if\(p==='\/api\/jawafa\/v1\/performance'\)/);
});
test('no SQL secrets or read-write SQL commands in client',()=>{
  for(const code of [central,erp]){
    assert.doesNotMatch(code,/\bsa\s*[:=]/i);
    assert.doesNotMatch(code,/INSERT INTO|DELETE FROM|UPDATE\s+\w+\s+SET/i);
    assert.match(code,/tls_certificate_trusted/);
    assert.match(code,/deny_write_test_passed/);
    assert.match(code,/getIdToken/);
    assert.match(code,/github\.io/);
  }
});
test('public GitHub Pages never receives owner JWT requests from either adapter',()=>{
  assert.match(central,/host\.endsWith\('\.github\.io'\)/);
  assert.match(erp,/location\.hostname\.endsWith\("\.github\.io"\)/);
  assert.match(integration,/hostname\.endsWith\("\.github\.io"\)/);
});
test('summary cells render as unknown until data is sourced and verified',()=>{
  for(const metric of ['sales','purchases','inventory','payables','postdated_cheques']){
    assert.match(html,new RegExp('data-sql-kpi="'+metric+'">—'));
  }
  assert.match(html,/NOT_CONNECTED — بانتظار بوابة HTTPS خاصة/);
});
