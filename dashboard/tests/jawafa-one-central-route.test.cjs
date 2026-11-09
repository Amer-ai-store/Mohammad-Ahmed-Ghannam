'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const one=fs.readFileSync(path.join(root,'one/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'one/app.js'),'utf8');
test('only central dashboard includes embedded JAWAFA ONE AI and dedicated menu route',()=>{
 assert.match(html,/data-view="jawafa-one"/);
 assert.match(html,/\["jawafa-one","JAWAFA ONE AI · التطبيق الموحد"\]/);
 assert.match(html,/id="jawafa-one-frame"/);
 assert.match(html,/src="\.\/one\/index\.html#jawafa-coverage"/);
 assert.match(html,/loading="lazy"/);
 assert.match(html,/referrerpolicy="no-referrer"/);
 assert.match(html,/READ ONLY · RELEASE NOT APPROVED/);
});
test('JAWAFA ONE itself exposes GitHub work and DB coverage with no SQL credentials',()=>{
 assert.match(one,/data-view="jawafa-coverage"/);
 assert.match(one,/data-view="github-work"/);
 assert.match(app,/renderGithubWorkView/);
 assert.match(app,/renderJawafaCoverageView/);
 assert.doesNotMatch(html,/\bsa_password\b|SQL_CONNECTION_STRING\s*=/i);
});
