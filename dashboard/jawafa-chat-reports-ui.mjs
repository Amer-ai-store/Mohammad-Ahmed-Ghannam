/* Embedded in the EXISTING jawafa-reports view. No new dashboard or public records. */
import {normalizeLedger,CATEGORIES,STATES} from "./jawafa-chat-reports-model.mjs";
const root=document.getElementById("jawafa-chat-report-ledger");
if(root){
  const $=id=>document.getElementById(id);
  const list=$("jcr-items"),status=$("jcr-status"),refresh=$("jcr-refresh"),
        category=$("jcr-category"),level=$("jcr-level"),search=$("jcr-search");
  const state={items:[],version:0,asOf:null,count:null};
  const el=(tag,cls,txt)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(txt!==undefined)node.textContent=String(txt);
    return node;
  };
  const authenticatedUser=()=>{
    const user=window.firebase?.auth?.().currentUser;
    return user?.emailVerified?user:null;
  };
  const badge=(label)=>{
    const css=label==="VERIFIED"?"ok":label==="BLOCKED"||label==="NOT_ACCEPTED"?"bad":"warn";
    return el("span","pill "+css,label);
  };
  function setStatus(text,tone="bad"){
    status.replaceChildren(badge(text));
    status.setAttribute("data-state",tone);
  }
  function render(){
    list.replaceChildren();
    const q=search.value.trim().toLowerCase().slice(0,100);
    const items=state.items.filter(r=>(category.value==="all"||r.category===category.value) &&
      (level.value==="all"||r.state===level.value) &&
      (!q||[r.title,r.summary,r.id,r.evidence_id].some(t=>t.toLowerCase().includes(q))));
    $("jcr-count").textContent=state.count===null?"—":String(items.length)+" / "+state.count;
    if(!items.length){
      const row=el("tr"),cell=el("td",null,state.asOf?"لا يوجد تقرير مطابق للمرشحات.":"لا يوجد سجل معتمد من بوابة خاصة.");
      cell.colSpan=6;row.append(cell);list.append(row);return;
    }
    for(const r of items){
      const row=el("tr");
      const title=el("td");
      title.append(el("strong",null,r.title),el("div","small muted",r.summary));
      row.append(title);
      row.append(el("td",null,r.category));
      const s=el("td");s.append(badge(r.state));row.append(s);
      const ev=el("td");ev.append(badge(r.evidence_status),el("div","small muted",r.evidence_id));row.append(ev);
      row.append(el("td","ltr",r.as_of));
      const link=el("td");
      if(r.url){const a=el("a","btn","فتح في Drive الخاص");
        a.href=r.url;a.target="_blank";a.rel="noopener noreferrer";link.append(a);}
      else link.append(el("span","muted","رابط غير متاح"));
      row.append(link);list.append(row);
    }
  }
  function clear(message="NOT_CONNECTED"){
    state.version++;state.items=[];state.asOf=null;state.count=null;
    $("jcr-verified").textContent="—";$("jcr-snapshot").textContent="لا يوجد مصدر مصادق عليه";
    setStatus(message);render();
  }
  async function load(){
    const myVersion=++state.version;
    state.items=[];state.count=null;state.asOf=null;render();
    refresh.disabled=true;setStatus("CHECKING","warn");
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);
    try{
      // This public GitHub Pages page MUST NOT request or render owner-only financial records.
      if(location.hostname.endsWith(".github.io"))throw Error("PRIVATE_GATEWAY_REQUIRED");
      if(location.protocol!=="https:" && !["localhost","127.0.0.1"].includes(location.hostname))
        throw Error("HTTPS_REQUIRED");
      const user=authenticatedUser();
      if(!user)throw Error("NOT_AUTHENTICATED");
      const token=await user.getIdToken();
      if(myVersion!==state.version) return;
      const response=await fetch("/api/jawafa/v1/chat-report-ledger",{
        method:"GET",headers:{"Accept":"application/json","Authorization":"Bearer "+token},
        credentials:"same-origin",cache:"no-store",redirect:"error",signal:ctl.signal
      });
      if(!response.ok)throw Error("PRIVATE_GATEWAY_"+response.status);
      if(!/^application\/json\b/i.test(response.headers.get("content-type")||""))throw Error("INVALID_CONTENT_TYPE");
      if(Number(response.headers.get("content-length")||"0")>131072)throw Error("RESPONSE_TOO_LARGE");
      const body=await response.text();
      if(body.length>131072)throw Error("RESPONSE_TOO_LARGE");
      const ledger=normalizeLedger(JSON.parse(body));
      if(myVersion!==state.version||!authenticatedUser())return;
      state.items=ledger.reports;state.asOf=ledger.verifiedAt;state.count=ledger.count;
      $("jcr-verified").textContent=ledger.verifiedAt;
      $("jcr-snapshot").textContent="لقطة "+ledger.snapshotId+" · تنتهي "+ledger.expiresAt;
      setStatus("PRIVATE_VERIFIED","ok");render();
    }catch(err){
      if(myVersion===state.version){
        const code=String(err?.message||"NOT_CONNECTED").replace(/[^A-Z0-9_]/g,"").slice(0,50)||"NOT_CONNECTED";
        clear(code);
      }
    }finally{clearTimeout(timer);refresh.disabled=false;}
  }
  for(const c of CATEGORIES){const option=el("option",null,c);option.value=c;category.append(option);}
  for(const s of STATES){const option=el("option",null,s);option.value=s;level.append(option);}
  for(const e of [category,level])e.addEventListener("change",render);
  search.addEventListener("input",render);
  refresh.addEventListener("click",load);
  window.addEventListener("hashchange",()=>{
    if(location.hash==="#jawafa-reports")load();
    else if(state.items.length)clear("SESSION_CLEARED");
  });
  document.addEventListener("visibilitychange",()=>{if(document.hidden)clear("SESSION_CLEARED");});
  try{window.firebase?.auth?.().onAuthStateChanged(u=>{if(!u||!u.emailVerified)clear("NOT_AUTHENTICATED");});}catch{}
  clear("PRIVATE_GATEWAY_REQUIRED");
  if(location.hash==="#jawafa-reports")load();
}
