import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseHubMessage,composeHubMessage,HUB_ISSUE_URL,validateDispatcherLinks,composeDispatcherMessage,isDispatcherMessage} from "../project-messages.mjs";
import {normalizeChatUrl,normalizeProjectUrl,connectProjects,registerChats,effectiveEdges,neighbors,unlink,loadLinkGraph,saveLinkGraph,EMPTY_GRAPH} from "../project-links.mjs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const PROJECT_GPT="https://chatgpt.com/g/g-p-gpt123/project";
const PROJECT_FINAL="https://chatgpt.com/g/g-p-final456/project";
test("single dashboard exposes only two coordinator conversation link inputs",()=>{
  for(const s of ['data-view="project-messages"','["project-messages","ربط موزّعي المهام"]',
    'src="project-messages.mjs"','id="pm-dispatcher-links"','id="pm-dispatcher-1"','id="pm-dispatcher-2"',
    'id="pm-compose"','id="pm-refresh"'])assert.ok(html.includes(s),s);
  for(const obsolete of ['id="pm-links-form"','id="pm-add-chats-form"','id="pm-source-link"',
    'id="pm-send-linked"','id="pm-project-list"','id="pm-filter"','name="first_project"',
    'name="second_project"','name="auto_link"'])assert.ok(!html.includes(obsolete),"Obsolete many-to-many UI: "+obsolete);
  assert.equal((html.match(/id="pm-dispatcher-[12]"/g)||[]).length,2);
  assert.ok(HUB_ISSUE_URL.endsWith("/issues/168"));
});
test("strict ChatGPT project URLs, reject untrusted hosts and conversation URLs",()=>{
  assert.equal(normalizeProjectUrl(PROJECT_GPT+"?utm_source=test"),PROJECT_GPT);
  assert.equal(normalizeChatUrl("https://chatgpt.com/c/example-1?title=abc"),"https://chatgpt.com/c/example-1");
  for(const bad of ["https://attacker.invalid/g/g-p-123/project","javascript:alert(1)","http://chatgpt.com/g/g-p-123/project","https://chatgpt.com/c/not-a-project"])
    assert.throws(()=>normalizeProjectUrl(bad),bad);
});
test("bulk project links create dynamic many-to-many chat relations, including future registrations",()=>{
  let graph=connectProjects(EMPTY_GRAPH,{first_project:"gpt",first_url:PROJECT_GPT,second_project:"التقرير النهائي",second_url:PROJECT_FINAL,auto_link:true});
  assert.equal(effectiveEdges(graph).length,0,"A full project link alone cannot expose or enumerate chats");
  graph=registerChats(graph,"gpt","Alpha | https://chatgpt.com/c/a1\nBeta | https://chatgpt.com/c/a2\nAlpha | https://chatgpt.com/c/a1");
  graph=registerChats(graph,"التقرير النهائي","Investigation | https://chatgpt.com/c/b1\nAudit | https://chatgpt.com/c/b2");
  assert.equal(graph.nodes.length,4);
  assert.equal(effectiveEdges(graph).length,4);
  assert.equal(neighbors(graph,"gpt::https://chatgpt.com/c/a1").length,2);
  assert.equal(neighbors(graph,"التقرير النهائي::https://chatgpt.com/c/b1").length,2);
  graph=registerChats(graph,"gpt","Third | https://chatgpt.com/c/a3");
  assert.equal(effectiveEdges(graph).length,6,"new chats participate in automatic bulk project routes");
  assert.ok(effectiveEdges(graph).every(e=>e.connected===false),"Configured routes do not prove network connectivity");
  const excluded=effectiveEdges(graph)[0];
  graph=unlink(graph,excluded.id);
  assert.equal(effectiveEdges(graph).length,5,"an individual dynamic route can be excluded");
});
test("turning off auto-route disables group expansion without deleting manually registered chats",()=>{
  let graph=connectProjects(EMPTY_GRAPH,{first_project:"gpt",first_url:PROJECT_GPT,second_project:"التقرير النهائي",second_url:PROJECT_FINAL,auto_link:true});
  graph=registerChats(graph,"gpt","https://chatgpt.com/c/a");
  graph=registerChats(graph,"التقرير النهائي","https://chatgpt.com/c/b");
  assert.equal(effectiveEdges(graph).length,1);
  graph=connectProjects(graph,{first_project:"gpt",first_url:PROJECT_GPT,second_project:"التقرير النهائي",second_url:PROJECT_FINAL,auto_link:false});
  assert.equal(effectiveEdges(graph).length,0);
  assert.equal(graph.nodes.length,2);
});
test("persist local link registry (no public transmission)",()=>{
  const store=new Map();
  const adapter={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  const graph=connectProjects(EMPTY_GRAPH,{first_url:PROJECT_GPT,second_url:PROJECT_FINAL});
  saveLinkGraph(adapter,graph);
  const loaded=loadLinkGraph(adapter);
  assert.equal(loaded.projects.gpt,PROJECT_GPT);
  assert.equal(loaded.auto_pairs.length,1);
});
test("GitHub issue receipt is SENT only; do not invent read or delivery evidence",()=>{
  const body=composeHubMessage({id:"test-1",from_project:"gpt",to_project:"التقرير النهائي",from_chat:"alpha",to_chat:"beta",subject:"test",body:"ping"});
  const msg=parseHubMessage({id:42,html_url:"https://github.com/a/b/issues/168#issuecomment-42",body});
  assert.equal(msg.comment_id,42);assert.equal(msg.to_project,"التقرير النهائي");
  assert.equal(msg.status,undefined);assert.equal(msg.acknowledged_at,undefined);
  assert.equal(parseHubMessage({id:1,body:"hello"}),null);
  assert.throws(()=>composeHubMessage({id:"1",from_project:"other",to_project:"gpt",from_chat:"x",to_chat:"y",subject:"z",body:"hi"}));
});

test("GitHub messages prefaced by explanation text are discoverable and sender claims are not authenticated",()=>{
  const payload={
    kind:"PROJECT_CHAT_MESSAGE",schema:"1.0",id:"external-test",
    from_project:"Github و ربط مع جميع محادثات codex وجميع دردشات",
    from_chat:"محادثة إرسال تقرير تجريبي",to_project:"التقرير النهائي",
    to_chat:"صندوق استقبال تقارير الوكلاء",subject:"تقرير تجريبي",
    body:"تقرير تنسيقي فقط",reply_to:null
  };
  const ticks=String.fromCharCode(96).repeat(3);
  const comment={id:6673589802,body:"تقرير تجريبي / TEST — لا يتضمن أسرارًا أو بيانات خاصة.\n\n"+ticks+"json\n"+JSON.stringify(payload,null,2)+"\n"+ticks+"\n\nDelivery semantics: SENT to GitHub only."};
  const received=parseHubMessage(comment);
  assert.equal(received.id,"external-test");
  assert.equal(received.comment_id,6673589802);
  assert.equal(received.to_project,"التقرير النهائي");
  assert.equal(received.from_project,payload.from_project);
  assert.equal(received.authenticated_sender,undefined);
  assert.equal(received.read_at,undefined);
  assert.equal(parseHubMessage({id:17,body:comment.body.replace('"to_project": "التقرير النهائي"','"to_project": "not-registered"')}),null);
});

test("dispatcher-only routing validates two distinct private ChatGPT conversation URLs",()=>{
  const first="https://chatgpt.com/c/coordinator-1?utm_source=local";
  const second="https://chatgpt.com/g/g-p-project123/c/coordinator-2";
  assert.deepEqual(validateDispatcherLinks(first,second),{
    first_chat:"https://chatgpt.com/c/coordinator-1",
    second_chat:second
  });
  assert.throws(()=>validateDispatcherLinks(first,first),/TWO_DISTINCT_CHATS_REQUIRED/);
  assert.throws(()=>validateDispatcherLinks("https://example.org/c/foo",second),/CHATGPT_LINK_ONLY/);
  assert.throws(()=>validateDispatcherLinks("https://chatgpt.com/g/g-p-project123/project",second),/CHAT_LINK_REQUIRED/);
});
test("only dispatcher 1 to dispatcher 2 is composed; private chat URLs never leak into public GitHub payload",()=>{
  const raw=composeDispatcherMessage({id:"PMH-test",subject:"تنسيق",body:"توزيع المهمة داخل المشروع"});
  assert.ok(!raw.includes("chatgpt.com"),"private links must not be published");
  const message=parseHubMessage({id:123,body:raw});
  assert.equal(message.from_project,"التقرير النهائي");
  assert.equal(message.to_project,"gpt");
  assert.equal(message.from_chat,"موزع المهام 1");
  assert.equal(message.to_chat,"موزع المهام 2");
  assert.ok(isDispatcherMessage(message));
  assert.ok(!isDispatcherMessage({...message,to_chat:"وكيل مباشر"}));
  assert.ok(!isDispatcherMessage({...message,from_project:"gpt",to_project:"التقرير النهائي"}));
});
test("plain JSON comments from existing issue remain parseable without endorsing delivery",()=>{
  const payload={kind:"PROJECT_CHAT_MESSAGE",schema:"1.0",id:"test-plain",
    from_project:"التقرير النهائي",from_chat:"موزع المهام 1",to_project:"gpt",to_chat:"موزع المهام 2",
    subject:"test",body:"non-sensitive",reply_to:null};
  const message=parseHubMessage({id:77,body:JSON.stringify(payload)});
  assert.ok(isDispatcherMessage(message));
  assert.equal(message.comment_id,77);
  assert.equal(message.read_at,undefined);
  assert.equal(message.acknowledged_at,undefined);
});
