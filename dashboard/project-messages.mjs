import {normalizeChatUrl} from "./project-links.mjs";
/* Two-dispatcher routing only. This PUBLIC GitHub mailbox accepts NON-SENSITIVE
 * coordination metadata. Conversation URLs stay on the user's device.
 * This UI cannot push messages into native ChatGPT conversations or authenticate
 * the authors of public GitHub comments.
 */
export const HUB_ISSUE_URL="https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/168";
export const HUB_API_URL="https://api.github.com/repos/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/168/comments";
export const HUB_KIND="PROJECT_CHAT_MESSAGE";
export const KNOWN_PROJECTS=["gpt","التقرير النهائي"];
export const DISPATCHERS=Object.freeze({
  one:Object.freeze({project:"التقرير النهائي",chat:"موزع المهام 1"}),
  two:Object.freeze({project:"gpt",chat:"موزع المهام 2"})
});
export const DISPATCHER_STORAGE_KEY="amer.projectMessageHub.dispatchers.v1";
const fence=String.fromCharCode(96).repeat(3);

export function parseHubMessage(comment){
  const raw=String(comment?.body||"").trim();
  const fenced=raw.match(new RegExp("(?:^|\\n)"+fence+"(?:json)?\\s*([\\s\\S]*?)\\s*"+fence+"(?:\\s|$)","i"));
  let message;
  try{message=JSON.parse(fenced?fenced[1]:raw);}catch{return null;}
  if(!message||typeof message!=="object"||Array.isArray(message)||message.kind!==HUB_KIND||message.schema!=="1.0")return null;
  const fields=["id","from_project","from_chat","to_project","to_chat","subject","body"];
  if(!fields.every(k=>typeof message[k]==="string"&&message[k].trim()&&message[k].length<=2500))return null;
  if(!KNOWN_PROJECTS.includes(message.to_project)||message.from_project.length>160)return null;
  return {id:message.id,from_project:message.from_project,from_chat:message.from_chat,
    to_project:message.to_project,to_chat:message.to_chat,subject:message.subject,
    body:message.body,reply_to:typeof message.reply_to==="string"?message.reply_to:null,
    comment_id:comment.id,created_at:comment.created_at||null,
    permalink:comment.html_url||HUB_ISSUE_URL};
}
export function composeHubMessage({from_project,to_project,from_chat,to_chat,subject,body,id,reply_to=null}){
  if(!KNOWN_PROJECTS.includes(from_project)||!KNOWN_PROJECTS.includes(to_project))throw Error("INVALID_PROJECT");
  for(const val of [id,from_chat,to_chat,subject,body])
    if(typeof val!=="string"||!val.trim())throw Error("MISSING_FIELD");
  if(subject.length>160||body.length>500)throw Error("MESSAGE_TOO_LONG");
  const message={kind:HUB_KIND,schema:"1.0",id,from_project,from_chat:from_chat.trim(),
    to_project,to_chat:to_chat.trim(),subject:subject.trim(),body:body.trim(),reply_to};
  return fence+"json\n"+JSON.stringify(message,null,2)+"\n"+fence;
}
export function isDispatcherRoute(message){
  const a=DISPATCHERS.one,b=DISPATCHERS.two;
  return Boolean(message&&(
    (message.from_project===a.project&&message.from_chat===a.chat&&message.to_project===b.project&&message.to_chat===b.chat)||
    (message.from_project===b.project&&message.from_chat===b.chat&&message.to_project===a.project&&message.to_chat===a.chat)
  ));
}
export function composeDispatcherMessage({direction,subject,body,id,reply_to=null}){
  if(direction!=="1to2"&&direction!=="2to1")throw Error("DISPATCHERS_ONLY");
  const sender=direction==="1to2"?DISPATCHERS.one:DISPATCHERS.two;
  const receiver=direction==="1to2"?DISPATCHERS.two:DISPATCHERS.one;
  return composeHubMessage({from_project:sender.project,from_chat:sender.chat,
    to_project:receiver.project,to_chat:receiver.chat,subject,body,id,reply_to});
}
export function normalizeDispatcherLinks(one,two){
  const first=normalizeChatUrl(one),second=normalizeChatUrl(two);
  if(!first.includes("/c/")||!second.includes("/c/"))throw Error("LIVE_CONVERSATION_LINKS_REQUIRED");
  if(first===second)throw Error("DISTINCT_DISPATCHERS_REQUIRED");
  return {one:first,two:second};
}
export function loadDispatcherLinks(store){
  try{
    const data=JSON.parse(store.getItem(DISPATCHER_STORAGE_KEY)||"null");
    return data?.schema===1?normalizeDispatcherLinks(data.one,data.two):null;
  }catch{return null;}
}
export function saveDispatcherLinks(store,one,two){
  const links=normalizeDispatcherLinks(one,two);
  store.setItem(DISPATCHER_STORAGE_KEY,JSON.stringify({schema:1,...links}));
  return links;
}
function el(tag,attributes={},textValue){
  const node=document.createElement(tag);
  Object.entries(attributes).forEach(([key,value])=>node.setAttribute(key,value));
  if(textValue!==undefined)node.textContent=String(textValue);
  return node;
}
function initMessageHub(){
  const root=document.querySelector('[data-view="project-messages"]');
  if(!root)return;
  const $=id=>root.querySelector("#"+id);
  const status=$("pm-status"),linksStatus=$("pm-links-status"),linksRoot=$("pm-chat-links");
  const list=$("pm-list"),form=$("pm-compose"),linksForm=$("pm-links-form");
  const setStatus=value=>{status.textContent=value;};
  function renderLinks(){
    const saved=loadDispatcherLinks(localStorage);
    linksRoot.replaceChildren();
    if(!saved){
      linksStatus.textContent="لم يُربط الموزعان على هذا الجهاز. إدخال الروابط لا يمنح صلاحية قراءة محادثات ChatGPT.";
      return;
    }
    linksForm.elements.namedItem("dispatcher_one").value=saved.one;
    linksForm.elements.namedItem("dispatcher_two").value=saved.two;
    for(const [label,url] of [["فتح محادثة 1",saved.one],["فتح محادثة 2",saved.two]]){
      const link=el("a",{href:url,target:"_blank",rel:"noopener noreferrer"},label);
      linksRoot.append(link,document.createTextNode("  "));
    }
    linksStatus.textContent="رابطان محفوظان محليًا فقط؛ لا توجد مزامنة للخادم ولا إثبات توصيل للمحادثتين.";
  }
  linksForm.addEventListener("submit",event=>{
    event.preventDefault();
    const values=new FormData(linksForm);
    try{
      saveDispatcherLinks(localStorage,values.get("dispatcher_one"),values.get("dispatcher_two"));
      renderLinks();
    }catch(error){linksStatus.textContent="تعذر حفظ الرابطين: "+String(error.message);}
  });
  function draw(items){
    list.replaceChildren();
    const pairs=items.filter(isDispatcherRoute);
    if(!pairs.length){
      list.append(el("p",{class:"muted"},"لا توجد رسائل موثقة بين الموزعين في الصفحة المقروءة من GitHub."));
      return 0;
    }
    for(const message of pairs.slice(-60).reverse()){
      const article=el("article",{class:"panel","data-message-id":message.id});
      article.append(el("h3",{},message.subject),
        el("p",{class:"small muted"},message.from_chat+" ← "+message.to_chat),
        el("p",{},message.body),
        el("p",{class:"small muted"},"SENT إلى GitHub فقط · تعليق #"+message.comment_id+" · "+(message.created_at||"وقت غير متاح")+" · لم يثبت التسليم أو القراءة أو هوية المرسل داخل ChatGPT."),
        el("a",{href:message.permalink,target:"_blank",rel:"noopener noreferrer"},"فتح تعليق الإثبات"));
      list.append(article);
    }
    return pairs.length;
  }
  async function load(){
    $("pm-refresh").disabled=true;
    setStatus("جارٍ قراءة التعليقات من GitHub...");
    try{
      const response=await fetch(HUB_API_URL+"?per_page=100&page=1",
        {headers:{Accept:"application/vnd.github+json"},cache:"no-store"});
      if(!response.ok)throw Error("HTTP "+response.status);
      const rows=await response.json();
      if(!Array.isArray(rows))throw Error("INVALID_RESPONSE");
      const count=draw(rows.map(parseHubMessage).filter(Boolean));
      setStatus("تم رصد "+count+" رسالة بين الموزعين في أحدث 100 تعليق متاح. النشر إلى GitHub يثبت SENT فقط؛ READ/ACK يحتاجان دليلًا مستقلًا.");
    }catch(error){
      list.replaceChildren();
      setStatus("تعذرت قراءة GitHub: "+String(error.message)+". حالة التوصيل غير مثبتة.");
    }finally{$("pm-refresh").disabled=false;}
  }
  $("pm-refresh").addEventListener("click",load);
  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const direction=event.submitter?.value;
    if(!loadDispatcherLinks(localStorage)){
      setStatus("احفظ رابط محادثة 1 ورابط محادثة 2 أولًا.");return;
    }
    const values=new FormData(form);
    let payload;
    try{
      const id="PMH-"+(globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():Date.now().toString(36));
      payload=composeDispatcherMessage({direction,id,subject:values.get("subject"),body:values.get("body")});
    }catch(error){setStatus("تعذر إعداد رسالة الموزعين: "+String(error.message));return;}
    const sender=direction==="1to2"?"موزع المهام 1":"موزع المهام 2";
    const instruction="من داخل محادثة «"+sender+"» وباستخدام GitHub connector، تحقق أولًا من عدم وجود معرّف الرسالة. انشر كتلة JSON التالية كتعليق واحد على GitHub Issue #168 في المستودع Amer-ai-store/Mohammad-Ahmed-Ghannam. اقرأ التعليق بعد الكتابة وأعد معرّفه ورابطه. يجب أن تبقى الرسائل بين موزع المهام 1 وموزع المهام 2 فقط؛ التوجيه الداخلي للوكلاء يتولاه الموزع المستلم داخل مشروعه. لا تنشر روابط المحادثات أو أي بيانات مالية أو أسرار. لا تعتبر DELIVERED أو READ أو ACK مثبتة دون رد فعلي من الطرف المقابل. لا تدّعِ إرسالًا مباشرًا إلى دردشة ChatGPT.\n\n"+payload;
    $("pm-output").value=instruction;
    $("pm-output").hidden=false;
    try{
      await navigator.clipboard.writeText(instruction);
      setStatus("تم نسخ أمر التنسيق للموزع. لم تُرسل رسالة إلى GitHub أو ChatGPT من هذه الصفحة.");
    }catch{
      setStatus("تم إنشاء الأمر. انسخه من المربع ونفّذه في محادثة الموزع المتصلة بـ GitHub. لم يُرسل بعد.");
    }
  });
  renderLinks();load();
}
if(typeof document!=="undefined")initMessageHub();
