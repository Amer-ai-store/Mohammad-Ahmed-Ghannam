import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseHubMessage,composeHubMessage,composeDispatcherMessage,isDispatcherRoute,normalizeDispatcherLinks,saveDispatcherLinks,loadDispatcherLinks,HUB_ISSUE_URL,DISPATCHER_STORAGE_KEY} from "../project-messages.mjs";
import {normalizeChatUrl,normalizeProjectUrl,connectProjects,registerChats,effectiveEdges,neighbors,unlink,loadLinkGraph,saveLinkGraph,EMPTY_GRAPH} from "../project-links.mjs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const PROJECT_GPT="https://chatgpt.com/g/g-p-gpt123/project";
const PROJECT_FINAL="https://chatgpt.com/g/g-p-final456/project";
test("central dashboard offers exactly two dispatcher conversation links, no bulk routing UI",()=>{
  const from=html.indexOf('data-view="project-messages"');
  const to=html.indexOf('data-view="release-verification"',from);
  const section=html.slice(from,to);
  assert.ok(from>=0&&to>from);
  for(const id of ['pm-links-form','pm-chat-one','pm-chat-two','pm-compose','pm-send-one','pm-send-two','pm-status','pm-refresh']){
    assert.ok(section.includes('id="'+id+'"'),id);
  }
  assert.equal((section.match(/type="url"/g)||[]).length,2);
  for(const removed of ['pm-add-chats-form','pm-send-linked','pm-source-link','first_project','second_project','pm-project-list','pm-links-list','pm-filter']){
    assert.ok(!section.includes(removed),"legacy routing field still exposed: "+removed);
  }
  assert.ok(html.includes('src="project-messages.mjs"'));
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

test("only two distinct ChatGPT conversation URLs are accepted as dispatcher links",()=>{
  const one="https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc";
  const two="https://chatgpt.com/g/g-p-project-id/c/abcdef12-abcd-abcd-abcd-abcdef123456";
  assert.deepEqual(normalizeDispatcherLinks(one+"?utm_source=xyz",two),{one,two});
  assert.throws(()=>normalizeDispatcherLinks(one,one),/DISTINCT_DISPATCHERS_REQUIRED/);
  assert.throws(()=>normalizeDispatcherLinks("https://chatgpt.com/share/s123",two),/LIVE_CONVERSATION_LINKS_REQUIRED/);
  assert.throws(()=>normalizeDispatcherLinks("https://evil.invalid/c/a",two),/CHATGPT_LINK_ONLY/);
  const store=new Map();
  const adapter={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  saveDispatcherLinks(adapter,one,two);
  assert.deepEqual(loadDispatcherLinks(adapter),{one,two});
  assert.equal(store.size,1);
  assert.ok(store.has(DISPATCHER_STORAGE_KEY));
});

test("outgoing dispatcher messages can target only the opposite dispatcher",()=>{
  for(const direction of ["1to2","2to1"]){
    const raw=composeDispatcherMessage({direction,id:"pair-test-"+direction,subject:"اختبار",body:"ping"});
    const message=parseHubMessage({id:90,body:raw});
    assert.ok(isDispatcherRoute(message));
    assert.equal(message.from_chat,direction==="1to2"?"موزع المهام 1":"موزع المهام 2");
    assert.equal(message.to_chat,direction==="1to2"?"موزع المهام 2":"موزع المهام 1");
    assert.ok(!raw.includes("chatgpt.com"));
    assert.equal(message.reply_to,null);
  }
  assert.throws(()=>composeDispatcherMessage({direction:"any",id:"x",subject:"x",body:"x"}),/DISPATCHERS_ONLY/);
  assert.equal(isDispatcherRoute({from_project:"التقرير النهائي",from_chat:"وكيل فرعي",to_project:"gpt",to_chat:"موزع المهام 2"}),false);
  assert.equal(isDispatcherRoute({from_project:"التقرير النهائي",from_chat:"موزع المهام 1",to_project:"gpt",to_chat:"وكيل فرعي"}),false);
});

test("GitHub direct JSON and prefaced fenced JSON both parse, without false delivery claims",()=>{
  const envelope={kind:"PROJECT_CHAT_MESSAGE",schema:"1.0",id:"direct-1",
    from_project:"التقرير النهائي",from_chat:"موزع المهام 1",
    to_project:"gpt",to_chat:"موزع المهام 2",subject:"ping",body:"test",reply_to:null};
  const item=parseHubMessage({id:501,body:JSON.stringify(envelope)});
  assert.equal(item.comment_id,501);
  assert.ok(isDispatcherRoute(item));
  assert.equal(item.read_at,undefined);
  assert.equal(item.delivery_status,undefined);
  assert.equal(parseHubMessage({id:502,body:"not JSON"}),null);
});
