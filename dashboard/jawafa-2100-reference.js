/* JAWAFA ERP 2100 — screenshot-faithful facade; no direct SQL connection or invented financial amounts. */
(()=>{
 "use strict";
 const frame=document.getElementById("stage-frame"),stage=document.getElementById("stage");
 const $=id=>document.getElementById(id);
 const keys=["sales","purchases","inventory","payables","postdated_cheques"];
 let dataset=null,origin="NOT_CONNECTED";
 const nf=new Intl.NumberFormat("en-US",{minimumFractionDigits:0,maximumFractionDigits:3});
 const num=v=>typeof v==="number"&&Number.isFinite(v)&&Math.abs(v)<=1e15?v:null;
 // The 1536px desktop artwork must occupy exactly the available horizontal space.
 // A 0.45 minimum scale previously cropped narrow/browser-desktop-mode viewports.
 let lastReportedHeight=0,resizeFrame;
 const reportHeight=()=>{
  if(window.parent===window)return;
  const footer=document.querySelector(".functional-tools");
  const bottom=footer?footer.getBoundingClientRect().bottom+window.scrollY:document.documentElement.scrollHeight;
  const height=Math.max(200,Math.ceil(bottom+4));
  if(Math.abs(height-lastReportedHeight)<2)return;
  lastReportedHeight=height;
  try{window.parent.postMessage({type:"jawafa2100:content-height",height},location.origin==="null"?"*":location.origin);}catch{}
 };
 const scheduleHeight=()=>{
  if(resizeFrame)cancelAnimationFrame(resizeFrame);
  resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;reportHeight();});
 };
 const fit=()=>{
  const responsive=matchMedia("(max-width:959px)").matches;
  frame.style.direction="ltr";
  stage.style.transformOrigin="top left";
  if(responsive){
   stage.style.transform="none";
   frame.style.height="auto";
  }else{
   const width=frame.clientWidth||innerWidth;
   const scale=Math.min(1,width/1536);
   stage.style.transform="scale("+scale+")";
   frame.style.height=Math.ceil(864*scale)+"px";
  }
  scheduleHeight();
 };
 addEventListener("resize",fit,{passive:true});
 addEventListener("load",scheduleHeight);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(scheduleHeight);
 fit();
 function shape(x){
  if(!x||typeof x!=="object"||Array.isArray(x)||x.format!=="jawafa-performance-v1"||!x.metrics||typeof x.metrics!=="object")
    throw Error("الملف غير مطابق لصيغة jawafa-performance-v1.");
  const o={format:"jawafa-performance-v1",source:typeof x.source==="string"?x.source.slice(0,120):"ملف محلي",cutoff:typeof x.cutoff==="string"?x.cutoff.slice(0,40):null,metrics:{},trend:{labels:[],sales_2026:[],sales_2025:[],sales_2024:[]},departments:[],alerts:[]};
  keys.forEach(k=>{const m=x.metrics[k]||{};o.metrics[k]={today:num(m.today),prior_2025:num(m.prior_2025),prior_2024:num(m.prior_2024)}});
  const t=x.trend||{},labels=Array.isArray(t.labels)?t.labels.slice(0,30):[];
  o.trend.labels=labels.map(v=>String(v).slice(0,16));
  for(const k of ["sales_2026","sales_2025","sales_2024"])
    o.trend[k]=(Array.isArray(t[k])?t[k].slice(0,labels.length):[]).map(num);
  if(Array.isArray(x.departments))o.departments=x.departments.slice(0,8).map(v=>({name:String(v.name||"قسم").slice(0,35),share:num(v.share)})).filter(v=>v.share!==null&&v.share>=0&&v.share<=100);
  if(Array.isArray(x.alerts))o.alerts=x.alerts.slice(0,8).map(v=>({text:String(v.text||"").slice(0,180),level:["info","warn","danger","success"].includes(v.level)?v.level:"info"}));
  return o;
 }
 function render(){
  keys.forEach(k=>document.querySelectorAll('[data-number="'+k+'"]').forEach(el=>el.textContent=dataset&&dataset.metrics[k].today!==null?nf.format(dataset.metrics[k].today):"—"));
  const text=dataset?"مصدر العرض: "+dataset.source+(origin==="LOCAL"?" (محلي، غير معتمد)":origin==="API"?" (user_read • قراءة مشفرة ومتحقق منها)":" (غير مثبت)"):"مصدر البيانات: غير متصل";
  $("source-state").textContent=text;
  $("connection-status").textContent=dataset?"● "+text+" • لا تغييرات على قاعدة البيانات":"● المصدر: غير متصل — هذه واجهة بصرية؛ لا توجد أرقام مالية حية";
  $("download-json").disabled=$("download-csv").disabled=!dataset;
  renderChart();renderDepartments();renderAlerts();
 }
 function renderChart(){
  const svg=$("sales-svg"),barGroup=svg.querySelector(".demo-bars"),line=svg.querySelector(".demo-line");
  if(!dataset||dataset.trend.sales_2026.filter(x=>x!==null).length<2){barGroup.removeAttribute("hidden");barGroup.style.display="";line.style.display="";$("chart-state").textContent="رسم توضيحي — دون بيانات فعلية";return;}
  const values=dataset.trend.sales_2026,high=Math.max(1,...values.filter(v=>v!==null).map(Math.abs));
  barGroup.replaceChildren();barGroup.style.display="";
  const coords=[];values.forEach((v,i)=>{
   if(v===null)return;
   const x=36+(i/Math.max(1,values.length-1))*254;
   const y=120-(Math.max(0,v)/high*100);
   const node=document.createElementNS("http://www.w3.org/2000/svg","rect");
   node.setAttribute("x",x.toFixed(2));node.setAttribute("y",y.toFixed(2));node.setAttribute("width",Math.max(3,Math.min(10,250/values.length-2)));node.setAttribute("height",Math.max(0,120-y));
   barGroup.appendChild(node);coords.push((x+3).toFixed(1)+","+Math.max(0,y-5).toFixed(1));
  });
  line.setAttribute("d",coords.map((p,i)=>(i?"L":"M")+p.replace(","," ")).join(""));line.style.display=coords.length>1?"":"none";
  $("chart-state").textContent=origin==="LOCAL"?"ملف محلي • غير متحقق":"سلسلة بيانات من API • بحاجة للتحقق";
 }
 function renderDepartments(){
  const el=$("department-list"),donut=$("donut");
  if(!dataset||!dataset.departments.length){donut.style.background="conic-gradient(#2ae788 0 42%,#9bea8a 42% 68%,#d5ba64 68% 85%,#319f6b 85% 100%)";$("donut-value").textContent="—";el.replaceChildren();for(const n of ["الأسواق","المطاعم","الأفران","أخرى"]){const li=document.createElement("li"),b=document.createElement("b");li.textContent=n+" ";b.textContent="—";li.appendChild(b);el.appendChild(li);}return;}
  el.replaceChildren();let total=dataset.departments.reduce((n,x)=>n+x.share,0)||1,pos=0;
  const colors=["#40f287","#84e575","#d3b85b","#3eaa8f"];
  const grad=[];
  dataset.departments.forEach((x,i)=>{const p=100*x.share/total,next=Math.min(100,pos+p);grad.push(colors[i%colors.length]+" "+pos.toFixed(2)+"% "+next.toFixed(2)+"%");pos=next;
   const li=document.createElement("li"),b=document.createElement("b");li.textContent=x.name+" ";b.textContent=nf.format(x.share)+"%";li.appendChild(b);el.appendChild(li);});
  donut.style.background="conic-gradient("+grad.join(",")+")";$("donut-value").textContent="100%";
 }
 function renderAlerts(){
  const el=$("alerts-list");if(!dataset||!dataset.alerts.length)return;
  el.replaceChildren();for(const item of dataset.alerts){const div=document.createElement("div");div.className="alert "+item.level;div.textContent=item.text;el.appendChild(div);}
 }
 function setData(x,type){
  dataset=shape(x);origin=type;render();
 }
 function save(name,type,body){
  const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 $("load-json").addEventListener("click",()=> $("json-file").click());
 $("json-file").addEventListener("change",async e=>{
  const f=e.currentTarget.files[0];if(!f)return;
  try{if(f.size>5*1024*1024)throw Error("الملف يتجاوز 5 ميغابايت");
   setData(JSON.parse(await f.text()),"LOCAL");
  }catch(err){$("connection-status").textContent="تعذر عرض البيانات: "+err.message;}
  finally{e.currentTarget.value="";}
 });
 async function connectVerified(){
  // Only the authorized same-origin command bridge may receive a Firebase bearer.
  // Never send credentials or raw SQL connection strings to an external origin.
  let jwt;
  try {
    const auth=window.parent===window?window.AAS_OWNER_AUTH:window.parent.AAS_OWNER_AUTH;
    if(!auth||typeof auth.getIdToken!=="function")throw Error("OWNER_AUTH_NOT_READY");
    jwt=await auth.getIdToken();
    if(typeof jwt!=="string"||!jwt)throw Error("NOT_AUTHENTICATED");
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),8000);
    let response;
    try {
      response=await fetch("/api/jawafa/v1/performance",{
        method:"GET",credentials:"same-origin",cache:"no-store",signal:ctrl.signal,
        headers:{"Accept":"application/json","Authorization":"Bearer "+jwt}
      });
    }finally{clearTimeout(timer)}
    const content=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(String(content.error||"HTTP_"+response.status).slice(0,100));
    if(content.format!=="jawafa-performance-v1"||
       content.source_system!=="Jawafa_DB"||content.data_verified!==true||
       content.read_only!==true||content.verification?.sql_login!=="user_read"||
       content.verification?.tls_encrypted!==true||
       content.verification?.tls_certificate_trusted!==true||
       content.verification?.deny_write_test_passed!==true)
       throw Error("SQL_SOURCE_VERIFICATION_FAILED");
    setData(content,"API");
  }catch(err){
    dataset=null;origin="NOT_CONNECTED";render();
    $("connection-status").textContent="● NOT_CONNECTED — "+String(err.message||"SOURCE_UNAVAILABLE").slice(0,110);
  }finally{jwt=null}
 }
 $("check-source").addEventListener("click",connectVerified);
 window.addEventListener("load",()=>setTimeout(connectVerified,1000),{once:true});
 $("download-json").addEventListener("click",()=>{if(dataset)save("jawafa-2100-screen.json","application/json;charset=utf-8",JSON.stringify({provenance:origin,verified:false,data:dataset},null,2));});
 $("download-csv").addEventListener("click",()=>{
  if(!dataset)return;
  const rows=[["metric","today","prior_2025","prior_2024"],...keys.map(k=>{const x=dataset.metrics[k];return [k,x.today,x.prior_2025,x.prior_2024]})];
  const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v===null?"":v).replace(/"/g,'""')+'"').join(",")).join("\r\n");
  save("jawafa-2100-screen.csv","text/csv;charset=utf-8",csv);
 });
 render();
})();