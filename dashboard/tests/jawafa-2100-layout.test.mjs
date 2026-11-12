import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('jawafa-2100-reference.css');
const child=read('jawafa-2100-reference.js');
const host=read('jawafa-2100-frame-host.js');
const index=read('index.html');

test('desktop artwork is LTR-anchored inside its RTL financial dashboard',()=>{
 assert.match(css,/\.stage-frame\{[^}]*direction:ltr/);
 assert.match(css,/\.stage\{[^}]*transform-origin:top left/);
 assert.match(child,/frame\.style\.direction="ltr"/);
 assert.match(child,/stage\.style\.transformOrigin="top left"/);
});

test('desktop fit scales exactly to available width without a destructive minimum zoom',()=>{
 assert.match(child,/Math\.min\(1,width\/1536\)/);
 assert.doesNotMatch(child,/Math\.max\(\.45,width\/1536\)/);
 assert.match(child,/frame\.style\.height=Math\.ceil\(864\*scale\)/);
});

test('iframe uses measured content height and verifies same-origin and source',()=>{
 assert.match(child,/footer\.getBoundingClientRect\(\)\.bottom/);
 assert.match(child,/type:"jawafa2100:content-height"/);
 assert.match(host,/event\.origin!==window\.location\.origin/);
 assert.match(host,/event\.source!==frame\.contentWindow/);
 assert.match(host,/Number\.isFinite\(height\)/);
 assert.match(index,/src="\.\/jawafa-2100-frame-host\.js"/);
 assert.doesNotMatch(index,/#jawafa-2100-reference-frame\{[^}]*height:100dvh;min-height:600px/);
 assert.match(index,/#jawafa-2100-reference-frame\{[^}]*height:clamp\(/);
});

test('the view remains read-only with no fictional financial totals',()=>{
 assert.match(index,/data-view="jawafa-2100"/);
 assert.match(child,/origin="NOT_CONNECTED"/);
 assert.match(child,/jawafa-performance-v1/);
 assert.doesNotMatch(css,/83,420|390,000/);
});
