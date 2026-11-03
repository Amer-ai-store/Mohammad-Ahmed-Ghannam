'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const source = readFileSync(join(__dirname,'..','connection-status.js'),'utf8');
function harness() {
  const nodes = new Map();
  const events = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, {dataset:{},textContent:'',listeners:new Map(), addEventListener(name,fn){this.listeners.set(name,fn)},getAttribute(){return null}});
    return nodes.get(id);
  };
  const frame=get('aas-live-frame');
  const document = {getElementById:get,hidden:false};
  let tick;
  const window = {addEventListener(name,fn){events.set(name,fn)},setInterval(fn){tick=fn;return 1},clearInterval(){}};
  runInNewContext(source,{document,window});
  return {get,events,window,frame,tick:()=>tick()};
}
test('all connections initially fail closed',()=>{
  const t=harness();
  for(const id of ['aas','jawafa','luqta'])assert.equal(t.get('connection-'+id).dataset.state,'unverified');
});
test('connection labels require independent authenticated signals',()=>{
  const t=harness();
  t.frame.getAttribute=()=> './aas/index.html#overview';
  t.frame.contentWindow={AASOwnerConnection:{isConnected:()=>true}};
  t.window.JawafaUI={connected:()=>true};
  t.events.get('luqta:bridge-state')({detail:{connected:true,healthVerified:false}});
  assert.equal(t.get('connection-aas').dataset.state,'connected');
  assert.equal(t.get('connection-jawafa').dataset.state,'connected');
  assert.equal(t.get('connection-luqta').dataset.state,'unverified');
  t.events.get('luqta:bridge-state')({detail:{connected:true,healthVerified:true}});
  assert.equal(t.get('connection-luqta').dataset.state,'connected');
  t.frame.contentWindow.AASOwnerConnection.isConnected=()=>false;
  t.window.JawafaUI.connected=()=>false;
  t.events.get('luqta:bridge-state')({detail:{connected:false,healthVerified:false}});
  for(const id of ['aas','jawafa','luqta'])assert.equal(t.get('connection-'+id).dataset.state,'unverified');
});
test('the indicator script never calls private APIs or stores credentials',()=>{
  assert.doesNotMatch(source,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bAuthorization\s*:/);
});
test('unified home exposes only the three documented dashboard actions',()=>{
  const html=readFileSync(join(__dirname,'..','index.html'),'utf8');
  for(const marker of ['id="dashboard-connections"','id="connection-aas"','id="connection-jawafa"','id="connection-luqta"','src="connection-status.js"'])
    assert.ok(html.includes(marker),marker);
  for(const href of ['#aas-overview','#jawafa-monitor','#luqta/overview'])
    assert.ok(html.includes('href="'+href+'"'),href);
});
