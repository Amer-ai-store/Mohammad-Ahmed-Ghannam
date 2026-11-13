import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ITEMS,STATES,GATES,TIMELINE,approvalStatus,safeGitHubURL,validateEvidence,parseEvidenceFile} from '../jawafa-acceptance.mjs';

const html=readFileSync('dashboard/index.html','utf8');
const js=readFileSync('dashboard/jawafa-acceptance.mjs','utf8');
const good={
 topic:'Firebase owner E2E',
 identifier:'EV-FIREBASE-20261113-001',
 claimedStatus:'جزئي',
 url:'https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/219',
 checkedAt:'2026-11-13T18:15',
 sha:'8cdcd1c09daf95506f2a6a271c89d97c1640d6c2',
 runId:'42700584654',
 details:'فحص مصدر GitHub فقط؛ لم يتم فحص الخدمة الخاصة'
};
test('native route uses existing central dashboard, no separate page',()=>{
 assert.match(html,/\["jawafa-acceptance","اعتماد اللوحة \| Security \/ QA"\]/);
 assert.match(html,/data-view="jawafa-acceptance"/);
 assert.match(html,/id="jawafa-acceptance-root"/);
 assert.match(html,/src="jawafa-acceptance.mjs"/);
 assert.match(html,/href="#jawafa-acceptance"/);
 assert.match(html,/jawafa-acceptance.css/);
 assert.equal((html.match(/data-view="jawafa-acceptance"/g)||[]).length,1);
});
test('all five evidence statuses are available and acceptance is never automatic',()=>{
 assert.deepEqual(STATES,['مثبت','جزئي','غير مثبت','يحتاج تحققًا إضافيًا','فرضية']);
 assert.equal(approvalStatus(),'غير معتمد إنتاجيًا');
 assert.ok(ITEMS.length>=14 && GATES.some(g=>g.id===57) && GATES.some(g=>g.id===102));
 assert.ok(TIMELINE.length>=6);
 for(const item of ITEMS){assert.ok(STATES.includes(item.status));assert.ok(item.date && item.url.startsWith('https://github.com/'))}
});
test('public status view is GET-only with no backend commands or persistent storage',()=>{
 assert.match(js,/method:'GET',credentials:'omit'/);
 assert.doesNotMatch(js,/\b(?:localStorage|sessionStorage|indexedDB)\b/);
 assert.doesNotMatch(js,/\bmethod:\s*['"](?:POST|PUT|DELETE|PATCH)['"]/);
 assert.doesNotMatch(js,/fetch\(['"]https:\/\/(?:docs|drive)\.google\.com/);
});
test('valid evidence is classified as unreviewed, never production approved',()=>{
 const result=validateEvidence(good);
 assert.equal(result.review,'USER_SUPPLIED_UNREVIEWED');
 assert.equal(result.claimedStatus,'جزئي');
 assert.equal(result.runId,good.runId);
 assert.equal(safeGitHubURL(good.url),good.url);
});
test('reject private, forged, token-bearing and cross-repository evidence URLs',()=>{
 for(const url of [
  'http://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/57',
  'https://docs.google.com/document/d/1',
  'https://github.com/elsewhere/repo/issues/1',
  'https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/57?token=abc',
  'https://github.com.evil.example/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/57'
 ])assert.throws(()=>validateEvidence({...good,url}));
 assert.throws(()=>validateEvidence({...good,details:'authorization:Bearer secrets'}));
 assert.throws(()=>validateEvidence({...good,sha:'not-a-commit'}));
 assert.throws(()=>validateEvidence({...good,claimedStatus:'إنتاج معتمد'}));
});
test('import validates entire payload and rejects duplicates',()=>{
 const fixture=JSON.stringify({schema:'jawafa.acceptance.local.v1',evidence:[good]});
 assert.equal(parseEvidenceFile(fixture).length,1);
 assert.throws(()=>parseEvidenceFile(JSON.stringify({schema:'wrong',evidence:[good]})));
 assert.throws(()=>parseEvidenceFile(JSON.stringify({schema:'jawafa.acceptance.local.v1',evidence:[good,good]})),/مكررة/);
});
