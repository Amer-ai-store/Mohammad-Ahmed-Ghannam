import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const folder = dirname(fileURLToPath(import.meta.url));
const dashboard = join(folder, '..');
const html = readFileSync(join(dashboard, 'index.html'), 'utf8');
const js = readFileSync(join(dashboard, 'jawafa-investigation.js'), 'utf8');
const manifest = JSON.parse(readFileSync(join(dashboard, 'data', 'jawafa-investigation-reports.json'), 'utf8'));
const main = JSON.parse(readFileSync(join(dashboard, 'data', 'jawafa-financial-casework.json'), 'utf8'));
const freeze = readFileSync(join(folder, '..', '..', '.github', 'workflows', 'pages.yml'), 'utf8');

class Node {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attrs = {};
    this.listeners = {};
    this.textContent = '';
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelectorAll(tag) { return this.children.filter(x => x.tagName === tag); }
}

const required = ['jf-investigation', 'jf-summary', 'jf-tracks', 'jf-report-rows',
  'jf-report-filters', 'jf-evidence', 'jf-results-count', 'jf-release',
  'jf-reload', 'jf-load', 'jf-source-note'];

function harness(fakeFetch) {
  const nodes = new Map(required.map(id => [id, new Node()]));
  const document = {
    getElementById(id) { return nodes.get(id) || null; },
    createElement(tag) { return new Node(tag); },
    addEventListener() {},
    hidden: false
  };
  runInNewContext(js, { document, fetch: fakeFetch, URL, Date, console }, { timeout: 1800 });
  return nodes;
}

test('native command view contains every investigation panel hook and static assets', () => {
  for (const id of required) assert.ok(html.includes('id="' + id + '"'), id);
  assert.match(html, /href="\.\/jawafa-investigation\.css"/);
  assert.match(html, /src="jawafa-investigation\.js" defer/);
  assert.ok(html.indexOf('id="jf-investigation"') > html.indexOf('data-view="jawafa"'));
  assert.ok(html.indexOf('id="jf-investigation"') < html.indexOf('id="trustsoft-handoff-entry"'));
});

test('report manifest is source-linked, status-only and not published', () => {
  assert.equal(manifest.schema, 'jawafa-investigation-reports-v1');
  assert.equal(manifest.classification, 'PUBLIC_STATUS_AND_PRIVATE_EVIDENCE_LINKS_ONLY');
  assert.equal(manifest.published_to_production, false);
  assert.equal(manifest.release_gate, 'BLOCKED_ISSUE_102');
  assert.equal(manifest.reports.length, 8);
  assert.equal(new Set(manifest.reports.map(x => x.id)).size, 8);
  for (const report of manifest.reports) {
    assert.match(report.href, /^https:\/\/(docs|drive)\.google\.com\//);
    assert.match(report.verified, /^DRIVE_METADATA/);
    assert.equal(report.access, 'PRIVATE_DRIVE');
  }
  assert.equal(main.source_as_of, '2026-11-02');
  assert.equal(main.latest_export.run, '20261031-0100'); // Older archived export is not falsely labeled 2 Nov.
  assert.equal(main.investigation_registry.page_deployed_to_production, false);
  assert.match(freeze, /Production Pages deployment frozen \(Issue #102\)/);
  assert.doesNotMatch(freeze, /uses:\s*actions\/deploy-pages/);
  assert.doesNotMatch(js, /innerHTML|document\.write/);
});

test('report viewer actually renders eight cards, eight reports and filter interactions', async () => {
  const nodes = harness(async () => ({ ok: true, json: async () => structuredClone(manifest) }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes.get('jf-summary').children.length, 8);
  assert.equal(nodes.get('jf-tracks').children.length, 8);
  assert.equal(nodes.get('jf-report-rows').children.length, 8);
  assert.equal(nodes.get('jf-report-filters').children.length, 4);
  assert.match(nodes.get('jf-load').textContent, /2026-11-02/);
  assert.match(nodes.get('jf-release').textContent, /102/);
  const rows = nodes.get('jf-report-rows').children;
  const link = rows[0].children[4].children[0];
  assert.equal(link.tagName, 'a');
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.match(link.href, /^https:\/\/docs\.google\.com/);
  const btn = nodes.get('jf-report-filters').children.find(x => x.dataset.filter === 'bank');
  btn.listeners.click();
  const expected = manifest.reports.filter(r => r.category === 'all' || r.category === 'bank').length;
  assert.equal(nodes.get('jf-report-rows').children.length, expected);
  assert.equal(btn.attrs['aria-pressed'], 'true');
});

test('failed source request does not invent financial results', async () => {
  const nodes = harness(async () => { throw Error('offline'); });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(nodes.get('jf-load').textContent, /تعذر استيراد/);
  assert.match(nodes.get('jf-summary').children[0].textContent, /غير متاحة/);
  assert.equal(nodes.get('jf-report-rows').children.length, 0);
});
