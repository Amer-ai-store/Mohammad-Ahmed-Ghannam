import {EMPTY_GRAPH,parseSideLinks,createLinkGraph,loadLinkGraph,saveLinkGraph,neighbors,unlink} from "./project-links.mjs";
/* Project Message Hub. Public GitHub mailbox: NON-SENSITIVE coordination metadata only.
 * Never put finance data, personal records, credentials or private evidence URLs in this issue.
 * ChatGPT project chats cannot be pushed into via the ChatGPT UI by this module.
 */
export const HUB_ISSUE_URL = "https://github.com/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/168";
export const HUB_API_URL = "https://api.github.com/repos/Amer-ai-store/Mohammad-Ahmed-Ghannam/issues/168/comments";
export const HUB_KIND = "PROJECT_CHAT_MESSAGE";
export const KNOWN_PROJECTS = ["gpt", "التقرير النهائي"];
export function parseHubMessage(comment) {
  const raw=String(comment?.body||"").trim();
  const fenced=raw.match(/^\x60\x60\x60(?:json)?\s*([\s\S]*?)\s*\x60\x60\x60$/i);
  if(!fenced)return null;
  let message;
  try {message=JSON.parse(fenced[1]);} catch {return null;}
  if(!message || typeof message!=="object" || Array.isArray(message) || message.kind!==HUB_KIND || message.schema!=="1.0")return null;
  const fields=["id","from_project","from_chat","to_project","to_chat","subject","body"];
  if(!fields.every(k=>typeof message[k]==="string" && message[k].trim() && message[k].length<=2500))return null;
  if(!KNOWN_PROJECTS.includes(message.from_project)||!KNOWN_PROJECTS.includes(message.to_project))return null;
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
  const state=$("pm-status"), list=$("pm-list"), form=$("pm-compose");
  const setState=(s)=>state.textContent=s;
  function draw(items){
    list.replaceChildren();
    if(!items.length){list.append(el("p",{class:"muted"},"لا توجد رسائل مطابقة للفلاتر. لا يعني ذلك أن الطرف الآخر لا يملك رسائل في محادثاته."));return;}
    const toFilter=$("pm-filter").value;
    items.filter(m=>toFilter==="all"||m.to_project===toFilter).slice(-100).reverse().forEach(m=>{
      const article=el("article",{class:"panel","data-message-id":m.id});
      const title=el("h3",{},m.subject);
      const routing=el("p",{class:"small muted"},m.from_project+" / "+m.from_chat+" ← "+m.to_project+" / "+m.to_chat);
      const content=el("p",{},m.body);
      const stateRow=el("p",{class:"small muted"}, "SENT (GitHub) · تعليق #"+m.comment_id+" · "+(m.created_at||"وقت غير متاح")+" · القراءة من الطرف المقابل غير مثبتة");
      const link=el("a",{href:m.permalink,target:"_blank",rel:"noopener noreferrer"},"فتح دليل الإرسال");
      article.append(title,routing,content,stateRow,link);list.append(article);
    });
    if(!list.children.length)list.append(el("p",{class:"muted"},"لا توجد رسائل لهذا المشروع."));
  }
  /* Link registry is private to this browser. It is NOT an inter-chat transport. */
  let graph=loadLinkGraph(localStorage);
  const linksState=$("pm-links-status"), linksList=$("pm-links-list"), sourceSelect=$("pm-source-link");
  function reportLinks(text){linksState.textContent=text;}
  function renderLinks(){
    linksList.replaceChildren();
    sourceSelect.replaceChildren();
    sourceSelect.append(el("option",{value:""},"اختر محادثة مرتبطة..."));
    for(const node of graph.nodes){
      if(!graph.edges.some(e=>e.left===node.key||e.right===node.key))continue;
      sourceSelect.append(el("option",{value:node.key},node.project+" · "+node.title+" ("+neighbors(graph,node.key).length+" مستلمين)"));
    }
    if(!graph.edges.length)linksList.append(el("p",{class:"muted"},"لم تُضف روابط بعد."));
    for(const edge of graph.edges){
      const left=graph.nodes.find(n=>n.key===edge.left),right=graph.nodes.find(n=>n.key===edge.right);
      if(!left||!right)continue;
      const row=el("div",{class:"panel"});
      row.append(el("strong",{},"ارتباط محدد (محلي، دون اتصال تلقائي)"));
      for(const [caption,node] of [["الطرف الأول",left],["الطرف الثاني",right]]){
        const p=el("p",{class:"small"});
        p.append(el("span",{},caption+" · "+node.project+" · "+node.title+" · "));
        p.append(el("a",{href:node.url,target:"_blank",rel:"noopener noreferrer"}, "فتح المحادثة"));
        row.append(p);
      }
      const remove=el("button",{type:"button",class:"button"},"حذف الارتباط");
      remove.addEventListener("click",()=>{
        graph=unlink(graph,edge.id);
        try{saveLinkGraph(localStorage,graph);reportLinks("تم حذف الارتباط محليًا فقط.");}
        catch{reportLinks("فشل الحفظ المحلي للروابط.");}
        renderLinks();
      });
      row.append(remove);linksList.append(row);
    }
    $("pm-links-count").textContent=graph.edges.length+" ارتباطًا بين "+graph.nodes.filter(n=>neighbors(graph,n.key).length).length+" محادثة. التخزين على هذا الجهاز فقط.";
  }
  $("pm-links-form").addEventListener("submit",event=>{
    event.preventDefault();
    const fields=new FormData(event.currentTarget);
    try{
      const left=parseSideLinks(fields.get("first_links"),fields.get("first_project"));
      const right=parseSideLinks(fields.get("second_links"),fields.get("second_project"));
      if(left[0]?.project===right[0]?.project)throw Error("DISTINCT_PROJECTS_REQUIRED");
      const next=createLinkGraph(graph,left,right);
      const count=next.edges.length-graph.edges.length;
      saveLinkGraph(localStorage,next);
      graph=next;
      renderLinks();
      reportLinks("تم حفظ "+count+" ارتباط جديد على هذا الجهاز فقط. هذه روابط تنقل، ولا تثبت الاتصال أو إرسال الرسائل.");
    }catch(error){reportLinks("تعذر حفظ الربط: "+String(error.message));}
  });
  sourceSelect.addEventListener("change",()=>{
    const node=graph.nodes.find(n=>n.key===sourceSelect.value);
    if(!node)return;
    form.elements.namedItem("from_project").value=node.project;
    form.elements.namedItem("from_chat").value=node.title;
    const dest=neighbors(graph,node.key);
    if(dest.length){
      form.elements.namedItem("to_project").value=dest[0].project;
      form.elements.namedItem("to_chat").value=dest[0].title;
    }
  });
  renderLinks();
  let messages=[];
  async function load(){
    $("pm-refresh").disabled=true;setState("جارٍ التحقق من سجل المراسلات العام...");
    try {
      const response=await fetch(HUB_API_URL+"?per_page=100&page=1",{headers:{Accept:"application/vnd.github+json"},cache:"no-store"});
      if(!response.ok)throw Error("HTTP "+response.status);
      const rows=await response.json();
      if(!Array.isArray(rows))throw Error("INVALID_RESPONSE");
      messages=rows.map(parseHubMessage).filter(Boolean);
      draw(messages);
      setState("تمت قراءة "+messages.length+" رسالة موثقة من GitHub. SENT مثبتة عند وجود تعليق؛ الاستلام داخل ChatGPT غير مثبت.");
    }catch(error){messages=[];list.replaceChildren();setState("تعذّر الوصول إلى سجل GitHub: "+String(error.message)+". لا يمكن إثبات وصول أو إرسال جديد.");}
    finally {$("pm-refresh").disabled=false;}
  }
  $("pm-refresh").addEventListener("click",load);
  $("pm-filter").addEventListener("change",()=>draw(messages));
  form.addEventListener("submit",async(event)=>{
    event.preventDefault();
    const fd=new FormData(form);
    const id=()=>"PMH-"+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36));
    let payloads=[];
    try {
      const selected=graph.nodes.find(n=>n.key===sourceSelect.value);
      if($("pm-send-linked").checked && selected){
        const destinations=neighbors(graph,selected.key);
        if(!destinations.length)throw Error("NO_DESTINATIONS");
        if(destinations.length>25)throw Error("MORE_THAN_25_DESTINATIONS");
        payloads=destinations.map(node=>composeHubMessage({
          id:id(),from_project:selected.project,from_chat:selected.title,
          to_project:node.project,to_chat:node.title,
          subject:fd.get("subject"),body:fd.get("body")
        }));
      }else{
        payloads=[composeHubMessage({
          id:id(),from_project:fd.get("from_project"),to_project:fd.get("to_project"),
          from_chat:fd.get("from_chat"),to_chat:fd.get("to_chat"),
          subject:fd.get("subject"),body:fd.get("body")
        })];
      }
    }catch(error){setState("تعذر إنشاء الأمر: "+String(error.message));return;}
    const instruction="أرسل "+payloads.length+" رسالة تنسيق بنشر كل كتلة JSON تالية كتعليق مستقل على GitHub Issue #168 في مستودع Amer-ai-store/Mohammad-Ahmed-Ghannam عبر GitHub connector. اقرأ التعليقات بعد الكتابة وأعد معرف كل تعليق وتحقق من عدم تكراره. لا تنشر أي بيانات مالية أو أسرار، ولا تعتبر الرسالة DELIVERED أو READ دون دليل من الطرف المقابل. لا تكتب مباشرة في دردشة ChatGPT أخرى.\n\n"+payloads.join("\n\n--- رسالة مستقلة ---\n\n");
    $("pm-output").value=instruction;
    $("pm-output").hidden=false;
    try {await navigator.clipboard.writeText(instruction);setState("تم نسخ أمر الإرسال. لم تُرسل الرسالة بعد: الصقه في محادثة متصلة بـ GitHub واطلب تنفيذها.");}
    catch {setState("تم إعداد أمر الإرسال. انسخه من المربع والصقه في محادثة متصلة بـ GitHub؛ لم يُرسل بعد.");}
  });
  load();
}
if(typeof document!=="undefined")initMessageHub();
