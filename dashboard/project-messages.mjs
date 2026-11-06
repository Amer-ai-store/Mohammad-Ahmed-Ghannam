import {normalizeChatUrl} from "./project-links.mjs";
/* Project Message Hub. Public GitHub mailbox: NON-SENSITIVE coordination metadata only.
 * Never put finance data, personal records, credentials or private evidence URLs in this issue.
 * ChatGPT project chats cannot be pushed into via the ChatGPT UI by this module.
 */
export const HUB_ISSUE_URL = "https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/168";
export const HUB_API_URL = "https://api.github.com/repos/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/168/comments";
export const HUB_KIND = "PROJECT_CHAT_MESSAGE";
export const KNOWN_PROJECTS = ["gpt", "التقرير النهائي"];
export const DISPATCHER_LINKS_KEY = "amer.projectMessageHub.dispatchers.v1";
export const DISPATCHER_FROM = {project:"التقرير النهائي",chat:"موزع المهام 1"};
export const DISPATCHER_TO = {project:"gpt",chat:"موزع المهام 2"};
export function validateDispatcherLinks(first,second) {
  const first_chat=normalizeChatUrl(first),second_chat=normalizeChatUrl(second);
  if(first_chat===second_chat)throw Error("TWO_DISTINCT_CHATS_REQUIRED");
  return {first_chat,second_chat};
}
export function composeDispatcherMessage({id,subject,body}) {
  return composeHubMessage({id,from_project:DISPATCHER_FROM.project,from_chat:DISPATCHER_FROM.chat,
    to_project:DISPATCHER_TO.project,to_chat:DISPATCHER_TO.chat,subject,body});
}
export function isDispatcherMessage(message) {
  return Boolean(message&&message.from_project===DISPATCHER_FROM.project&&message.from_chat===DISPATCHER_FROM.chat
    &&message.to_project===DISPATCHER_TO.project&&message.to_chat===DISPATCHER_TO.chat);
}

export function parseHubMessage(comment) {
  const raw=String(comment?.body||"").trim();
  const fenced=raw.match(/(?:^|\n)\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60(?:\s|$)/i);
  let message;
  try {message=JSON.parse(fenced?fenced[1]:raw);} catch {return null;}
  if(!message || typeof message!=="object" || Array.isArray(message) || message.kind!==HUB_KIND || message.schema!=="1.0")return null;
  const fields=["id","from_project","from_chat","to_project","to_chat","subject","body"];
  if(!fields.every(k=>typeof message[k]==="string" && message[k].trim() && message[k].length<=2500))return null;
  if(!KNOWN_PROJECTS.includes(message.to_project)||message.from_project.length>160)return null; // Sender identity is a claim in the message, not an authenticated ChatGPT project origin.
  return {id:message.id,from_project:message.from_project,from_chat:message.from_chat,to_project:message.to_project,to_chat:message.to_chat,subject:message.subject,body:message.body,reply_to:typeof message.reply_to==="string"?message.reply_to:null,comment_id:comment.id,created_at:comment.created_at||null,permalink:comment.html_url||HUB_ISSUE_URL};
}
export function composeHubMessage({from_project,to_project,from_chat,to_chat,subject,body,id}) {
  if(!KNOWN_PROJECTS.includes(from_project)||!KNOWN_PROJECTS.includes(to_project))throw Error("INVALID_PROJECT");
  for(const val of [from_chat,to_chat,subject,body])if(typeof val!=="string"||!val.trim())throw Error("MISSING_FIELD");
  const m={kind:HUB_KIND,schema:"1.0",id,from_project,from_chat:from_chat.trim(),to_project,to_chat:to_chat.trim(),subject:subject.trim(),body:body.trim(),reply_to:null};
  return "\x60\x60\x60json\n"+JSON.stringify(m,null,2)+"\n\x60\x60\x60";
}
function el(tag,attributes={},textValue) {
  const node=document.createElement(tag);
  Object.entries(attributes).forEach(([k,v])=>node.setAttribute(k,v));
  if(textValue!==undefined)node.textContent=String(textValue);
  return node;
}
function initMessageHub(){
  const root=document.querySelector('[data-view="project-messages"]');
  if(!root)return;
  const $=(id)=>root.querySelector("#"+id);
  const status=$("pm-status"), list=$("pm-list"), linksForm=$("pm-dispatcher-links"),form=$("pm-compose");
  const setState=(message)=>status.textContent=message;
  const linksState=$("pm-links-status");
  let dispatcherLinks=null;
  try {
    const saved=JSON.parse(localStorage.getItem(DISPATCHER_LINKS_KEY)||"null");
    if(saved) {
      dispatcherLinks=validateDispatcherLinks(saved.first_chat,saved.second_chat);
      linksForm.elements.namedItem("first_chat").value=dispatcherLinks.first_chat;
      linksForm.elements.namedItem("second_chat").value=dispatcherLinks.second_chat;
      linksState.textContent="تم استرجاع ربط الموزّعين من هذا الجهاز. لم يُثبت اتصال مباشر بدردشات ChatGPT.";
    }
  }catch {linksState.textContent="تعذر استرجاع الروابط المحلية؛ أدخل رابط المحادثتين مجددًا.";}
  linksForm.addEventListener("submit",(event)=>{
    event.preventDefault();
    try {
      const fields=new FormData(linksForm);
      const next=validateDispatcherLinks(fields.get("first_chat"),fields.get("second_chat"));
      localStorage.setItem(DISPATCHER_LINKS_KEY,JSON.stringify(next));
      dispatcherLinks=next;
      linksState.textContent="تم حفظ رابط موزّع 1 ورابط موزّع 2 محليًا. لا يوجد ربط مباشر بدردشات ChatGPT أو نشر لهذه الروابط.";
    }catch(error){linksState.textContent="تعذر حفظ الربط: "+String(error.message);}
  });
  function draw(items){
    list.replaceChildren();
    if(!items.length){
      list.append(el("p",{class:"muted"},"لا توجد رسائل تنسيق مسجلة بين الموزّعين ضمن التعليقات المقروءة."));
      return;
    }
    items.slice(-100).reverse().forEach(m=>{
      const article=el("article",{class:"panel","data-message-id":m.id});
      article.append(el("h3",{},m.subject));
      article.append(el("p",{class:"small muted"},"من "+DISPATCHER_FROM.chat+" / "+m.from_project+" إلى "+DISPATCHER_TO.chat+" / "+m.to_project));
      article.append(el("p",{},m.body));
      article.append(el("p",{class:"small muted"},"SENT على GitHub فقط · تعليق #"+m.comment_id+" · "+(m.created_at||"وقت غير متاح")+" · هوية مرسل الرسالة مُصرَّح بها في النص وغير موثّقة؛ DELIVERED وREAD غير مثبتتين."));
      article.append(el("a",{href:m.permalink,target:"_blank",rel:"noopener noreferrer"},"فتح تعليق GitHub"));
      list.append(article);
    });
  }
  async function load(){
    $("pm-refresh").disabled=true;
    setState("جارٍ قراءة سجل GitHub #168...");
    try {
      const response=await fetch(HUB_API_URL+"?per_page=100&page=1",{headers:{Accept:"application/vnd.github+json"},cache:"no-store"});
      if(!response.ok)throw Error("HTTP "+response.status);
      const comments=await response.json();
      if(!Array.isArray(comments))throw Error("INVALID_RESPONSE");
      const messages=comments.map(parseHubMessage).filter(isDispatcherMessage);
      draw(messages);
      setState("تمت قراءة "+comments.length+" تعليقًا؛ الرسائل المطابقة لمسار الموزّعين: "+messages.length+". وجود التعليق يثبت SENT فقط.");
    }catch(error){
      list.replaceChildren();
      setState("تعذرت قراءة سجل GitHub: "+String(error.message)+". لا يوجد إثبات جديد للإرسال أو التسليم.");
    }finally{$("pm-refresh").disabled=false;}
  }
  $("pm-refresh").addEventListener("click",load);
  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    if(!dispatcherLinks){
      setState("سجّل رابط محادثة 1 ورابط محادثة 2 واحفظهما أولًا.");
      return;
    }
    const fields=new FormData(form);
    const id="PMH-"+(crypto.randomUUID?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2));
    let payload;
    try{
      payload=composeDispatcherMessage({id,subject:fields.get("subject"),body:fields.get("body")});
    }catch(error){setState("تعذر إعداد الرسالة: "+String(error.message));return;}
    const instruction="أرسل رسالة تنسيق واحدة فقط بنشر كتلة JSON التالية تعليقًا مستقلًا على GitHub Issue #168 في مستودع Amer-ai-store/Mohammad-Ahmed-Ghannam عبر GitHub connector. افحص وجود معرّف الرسالة قبل النشر لمنع التكرار، ثم اقرأ التعليق بعد الكتابة وأعد المعرّف ورابط الدليل. هذه الرسالة حصريًا من موزّع المهام 1 إلى موزّع المهام 2؛ يقوم كل موزّع بالتوزيع على وكلائه داخل مشروعه، دون توجيه مباشر عبر المشروعين لأي وكيل. لا تنشر روابط محادثات أو بيانات مالية أو أسرارًا، ولا تعلن DELIVERED أو READ دون دليل الطرف المقابل. لا تكتب مباشرة في محادثة ChatGPT أخرى.\n\n"+payload;
    $("pm-output").value=instruction;
    $("pm-output").hidden=false;
    try{
      await navigator.clipboard.writeText(instruction);
      setState("تم نسخ أمر الإرسال الواحد. لم يتم نشر التعليق بعد؛ نفّذه من محادثة مرتبطة بموصل GitHub.");
    }catch{
      setState("تم تجهيز أمر الإرسال الواحد؛ انسخه من المربع ونفّذه من محادثة مرتبطة بموصل GitHub. لم يُرسل بعد.");
    }
  });
  load();
}
if(typeof document!=="undefined")initMessageHub();
