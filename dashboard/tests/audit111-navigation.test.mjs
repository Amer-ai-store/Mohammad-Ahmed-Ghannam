import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const index=readFileSync(resolve(root,"index.html"),"utf8");
test("AUDIT-111 uses the existing unified dashboard, not a separate public page",()=>{
 assert.match(index,/data-view="jawafa-audit111"/);
 assert.match(index,/href="https:\/\/github\.com\/Amer-ai-store\/Mohammad-Ahmed-Ghannam\/issues\/116"/);
 assert.match(index,/\["jawafa-audit111","111 · تتبع التعديلات"\]/);
 assert.match(index,/src="\.\/audit111-ui\.mjs"/);
});
test("private financial audit is not embedded as static records or source SQL",()=>{
 const auditStart=index.indexOf('data-view="jawafa-audit111"');
 const auditEnd=index.indexOf('data-view="jawafa-receiving"',auditStart);
 assert(auditEnd>auditStart);
 const auditMarkup=index.slice(auditStart,auditEnd);
 assert.match(auditMarkup,/NOT_CONNECTED/);
 assert.match(auditMarkup,/لا توجد بيانات/);
 assert.doesNotMatch(auditMarkup,/CREATE TABLE|INSERT INTO Jawafa_DB|sqlcmd -P/);
});
