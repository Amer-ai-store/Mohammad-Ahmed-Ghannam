import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseHubMessage,composeHubMessage,HUB_ISSUE_URL} from "../project-messages.mjs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
test("single existing dashboard has integrated message-hub view and navigation",()=>{
  assert.ok(html.includes('data-view="project-messages"'));
  assert.ok(html.includes('["project-messages","مركز مراسلات المشاريع"]'));
  assert.ok(html.includes('src="project-messages.mjs"'));
  assert.ok(HUB_ISSUE_URL.endsWith("/issues/168"));
});
test("parse only genuine structured project messages, no fabricated acknowledgement",()=>{
  const body=composeHubMessage({id:"test-1",from_project:"gpt",to_project:"التقرير النهائي",from_chat:"alpha",to_chat:"beta",subject:"test",body:"ping"});
  const m=parseHubMessage({id:42,html_url:"https://example.invalid/42",body});
  assert.equal(m.comment_id,42);assert.equal(m.to_project,"التقرير النهائي");
  assert.equal(m.status,undefined);
  assert.equal(parseHubMessage({id:1,body:"hello"}),null);
  assert.equal(parseHubMessage({id:2,body:"\\x60\\x60\\x60json\\n{}\\n\\x60\\x60\\x60"}),null);
});
test("reject invalid projects to prevent misrouting",()=>{
  assert.throws(()=>composeHubMessage({id:"1",from_project:"other",to_project:"gpt",from_chat:"x",to_chat:"y",subject:"z",body:"hi"}));
});
