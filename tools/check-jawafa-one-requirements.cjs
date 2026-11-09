'use strict';
/* Verify documented JAWAFA ONE requirement status directly from its single source of truth.
 * Never infer production acceptance from demo, CI, or emulator test statuses.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname,'..');
const matrix = fs.readFileSync(path.join(repo,'docs/jawafa-one/REQUIREMENTS_MATRIX.md'),'utf8');
const report = fs.readFileSync(path.join(repo,'docs/jawafa-one/IMPLEMENTATION_STATUS.md'),'utf8');
const vocabulary=['VERIFIED','TEST_PASSED','BUILT_NOT_TESTED','IN_PROGRESS','TEST_FAILED','BLOCKED','NOT_STARTED'];
const counts=Object.fromEntries(vocabulary.map(k=>[k,0]));
const seen=new Set();
for(const row of matrix.split(/\r?\n/)){
  if(!/^\|\s*REQ-\d+\s*\|/.test(row))continue;
  const cells=row.split('|').slice(1,-1).map(v=>v.trim());
  const id=cells[0], status=cells[cells.length-1];
  assert.match(id,/^REQ-\d{3}$/);
  assert.ok(!seen.has(id),'Duplicate requirement: '+id);
  assert.ok(Object.hasOwn(counts,status),'Unknown status for '+id+': '+status);
  seen.add(id);
  counts[status]++;
}
const total=seen.size;
assert.ok(total>0,'No requirements found');
for(const status of vocabulary){
  const match=report.match(new RegExp('^\\| '+status+' \\| (\\d+) \\|','m'));
  assert.ok(match,'Missing report status row '+status);
  assert.equal(Number(match[1]),counts[status],'Stale status count '+status);
}
const scalar=(label)=> {
  const match=report.match(new RegExp('^- '+label+': \\*\\*(\\d+) \\/ (\\d+)\\*\\*','m'));
  assert.ok(match,'Missing report scalar '+label);
  assert.equal(Number(match[2]),total,'Wrong denominator '+label);
  return Number(match[1]);
};
assert.equal(scalar('Implemented \\(any code exists: TEST_PASSED \\+ BUILT_NOT_TESTED \\+ IN_PROGRESS \\+ TEST_FAILED\\)'),counts.TEST_PASSED+counts.BUILT_NOT_TESTED+counts.IN_PROGRESS+counts.TEST_FAILED);
assert.equal(scalar('Tested with a passing automated test'),counts.TEST_PASSED);
assert.equal(scalar('Verified in the target \\(production\\) environment'),counts.VERIFIED);
assert.equal(scalar('Remaining \\(NOT_STARTED \\+ BLOCKED\\)'),counts.NOT_STARTED+counts.BLOCKED);
assert.equal([...Object.values(counts)].reduce((a,b)=>a+b,0),total);
assert.ok(report.includes('NOT READY'),'Release caveat absent');
console.log(JSON.stringify({result:'PASS',requirements:total,counts,acceptance:'NOT READY'}));
