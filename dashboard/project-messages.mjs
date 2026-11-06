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
    const id="PMH-"+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36));
    let payload;
    try {payload=composeHubMessage({id,from_project:fd.get("from_project"),to_project:fd.get("to_project"),from_chat:fd.get("from_chat"),to_chat:fd.get("to_chat"),subject:fd.get("subject"),body:fd.get("body")});}
    catch {setState("يرجى ملء جميع الحقول.");return;}
    const instruction="انشر رسالة التنسيق التالية تعليقًا على GitHub Issue #168 في المستودع Amer-ai-store/Mohammad-Ahmed-Ghannam باستخدام GitHub connector، وتحقق من ظهور معرف التعليق. لا تعتبرها DELIVERED أو READ دون دليل من الطرف المقابل.\n\n"+payload;
    $("pm-output").value=instruction;
    $("pm-output").hidden=false;
    try {await navigator.clipboard.writeText(instruction);setState("تم نسخ أمر الإرسال. لم تُرسل الرسالة بعد: الصقه في محادثة متصلة بـ GitHub واطلب تنفيذها.");}
    catch {setState("تم إعداد أمر الإرسال. انسخه من المربع والصقه في محادثة متصلة بـ GitHub؛ لم يُرسل بعد.");}
  });
  load();
}
if(typeof document!=="undefined")initMessageHub();
