import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script, runInNewContext } from 'node:vm';
import test from 'node:test';

const index = readFileSync(resolve('dashboard/index.html'), 'utf8');
const luqta = readFileSync(resolve('dashboard/luqta-integration.js'), 'utf8');
const api = readFileSync(resolve('dashboard/luqta-api.js'), 'utf8');
// Linear-time tag scanning avoids backtracking regexes on arbitrary HTML.
function* extractInlineScripts(html) {
  const folded = html.toLowerCase();
  let cursor = 0;
  while (cursor < html.length) {
    const start = folded.indexOf('<script', cursor);
    if (start < 0) return;
    const delimiter = html.charAt(start + 7);
    if (!' >\t\n\r'.includes(delimiter) || !delimiter) {
      cursor = start + 7;
      continue;
    }
    let openEnd = -1;
    let quote = '';
    for (let i = start + 7; i < html.length; i++) {
      const char = html[i];
      if (quote) {
        if (char === quote) quote = '';
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        openEnd = i;
        break;
      }
    }
    if (openEnd < 0) throw new Error('Unclosed script opening tag');
    let close = folded.indexOf('</script', openEnd + 1);
    let closeEnd = -1;
    while (close >= 0) {
      let i = close + 8;
      while (i < html.length && ' \t\n\r'.includes(html[i])) i++;
      if (html[i] === '>') {
        closeEnd = i;
        break;
      }
      close = folded.indexOf('</script', close + 8);
    }
    if (closeEnd < 0) throw new Error('Unclosed script element');
    yield html.slice(openEnd + 1, close);
    cursor = closeEnd + 1;
  }
}
const navSource = index.match(/  const NAV = (\[[\s\S]*?\n  \]);\n  const VIEWS/);
assert.ok(navSource, 'Primary NAV array is present');
const nav = runInNewContext('(' + navSource[1] + ')');

test('all 6 operational groups exist and each has detailed destinations', () => {
  assert.equal(nav.length, 6);
  assert.ok(nav.some(g => g[0].includes('جوافة')));
  assert.ok(nav.some(g => g[0].includes('المتجر')));
  assert.ok(nav.some(g => g[0].includes('AAS')));
  assert.ok(nav.every(group => group[1].length >= 5));
});
test('all navigation entries are unique and resolve to an existing view', () => {
  const seen = new Set();
  const physicalViews = new Set([...index.matchAll(/data-view="([^"]+)"/g)].map(m=>m[1]));
  for (const [, items] of nav) for (const [id] of items) {
    assert.ok(!seen.has(id), 'Duplicate navigation target: '+id);
    seen.add(id);
    const target = id.startsWith('luqta/') ? 'luqta' : id.startsWith('aas-') ? 'aas-live' : id;
    assert.ok(physicalViews.has(target), id+' is missing physical view '+target);
  }
  assert.ok(seen.size > 50);
});
test('mobile navigation is scoped to one group and reports active page', () => {
  assert.match(index,/id="nav-group-select"/);
  assert.match(index,/id="nav-breadcrumb"/);
  assert.match(index,/id="nav-group-cards"/);
  assert.match(index,/chipNav\.replaceChildren\(\)/);
  assert.match(index,/groupSelect\.addEventListener\("change"/);
  assert.match(index,/class:"nav-section"/);
});
test('all Luqta sub-screens have deep links and can select their actual code', () => {
  // Every section the Luqta integration can draw must be reachable by a deep link, or the router falls back to overview.
  const tabs = [...luqta.match(/const tabs = \[([\s\S]*?)\];/)[1].matchAll(/\["([a-z]+)",/g)].map(m => m[1]);
  assert.ok(tabs.length >= 29, 'all integration tabs parsed');
  const ids = new Set(nav.flatMap(group => group[1].map(row => row[0])));
  assert.ok(ids.has('luqta'));
  tabs.filter(x=>x!=='overview').forEach(tab => assert.ok(ids.has('luqta/'+tab)));
  assert.match(index,/CustomEvent\("luqta:navigate"/);
  assert.match(luqta,/window\.addEventListener\("luqta:navigate"/);
  assert.match(luqta,/TAB_GROUPS/);
  assert.match(api,/createClient/);
});
test('inline scripts and integrations parse as valid JavaScript', () => {
  let n=0;
  for (const inlineScript of extractInlineScripts(index)) {
    if (!inlineScript.trim()) continue;
    new Script(inlineScript, {filename:'inline-'+(++n)+'.js'});
  }
  assert.ok(n>0, 'at least one inline script tested');
  new Script(luqta, {filename:'luqta-integration.js'});
  new Script(api, {filename:'luqta-api.js'});
});

test('inline-script parser covers uppercase SCRIPT tags', () => {
  const fixture = '<SCRIPT type="text/javascript">const upperCaseScript = 1;</SCRIPT>';
  const matches = [...extractInlineScripts(fixture)];
  assert.equal(matches.length, 1);
  assert.doesNotThrow(() => new Script(matches[0], {filename:'uppercase-inline.js'}));
  assert.deepEqual([...extractInlineScripts('<scripture>ignored</scripture>')], []);
  assert.equal([...extractInlineScripts('<SCRIPT data-note="a>b">const okay=1;</SCRIPT>')][0], 'const okay=1;');
  assert.throws(() => [...extractInlineScripts('<script>missing close')], /Unclosed script element/);
});

test('central dashboard declares mobile viewport to avoid desktop-scale rendering on phones', () => {
  assert.match(index, /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"\s*>/);
});

test('external app preview supports close and clears iframe without claiming provider logout', () => {
  const portal = readFileSync(resolve('dashboard/appdeploy-modules.html'), 'utf8');
  assert.match(portal, /id="closeViewer"/);
  assert.match(portal, /closeViewer\.addEventListener\("click",clearPreview\)/);
  assert.match(portal, /window\.addEventListener\("pagehide",clearPreview\)/);
  assert.match(portal, /frame\.src="about:blank"/);
  assert.match(portal, /btn\.addEventListener\("click",\(\)=>\{clearPreview\(\)/);
  assert.match(portal, /ولا يسجّل الخروج من التطبيق الأصلي/);
  for (const script of extractInlineScripts(portal)) {
    if (script.trim()) new Script(script, {filename:'appdeploy-inline.js'});
  }
});
