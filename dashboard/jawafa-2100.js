
/* Jawafa 2100: display-only analytics. Financial data never leaves the user's browser. */
(function(){
  "use strict";
  var root=document.getElementById("jawafa-2100-screen");
  if(!root)return;
  var state=null,provenance="NOT_CONNECTED",sourceName="لا يوجد مصدر",loadedAt=null;
  var $=function(id){return document.getElementById(id);};
  var formatter=new Intl.NumberFormat("ar-JO",{maximumFractionDigits:2});
  var number=function(x){return typeof x==="number"&&Number.isFinite(x)&&Math.abs(x)<=1e15?x:null;};
  var fmt=function(x){var n=number(x);return n===null?"—":formatter.format(n);};
  var pct=function(current,old){var a=number(current),b=number(old);return a===null||b===null||b===0?"—":((a-b)/Math.abs(b)*100).toFixed(1)+"%";};
  var keys=["sales","purchases","inventory","payables","postdated_cheques"];
  var colors=["#42f58e","#9ade5a","#ecc361","#377a60"];
  var knownLevels=new Set(["info","warn","danger"]);
  function setText(id,value){var x=$(id);if(x)x.textContent=value;}
  function validate(obj){
    if(!obj||typeof obj!=="object"||Array.isArray(obj)||obj.format!=="jawafa-performance-v1"||!obj.metrics||typeof obj.metrics!=="object")throw Error("تنسيق الملف غير مطابق: يلزم jawafa-performance-v1 ومجموعة metrics");
    var clean={format:obj.format,source:typeof obj.source==="string"?obj.source.slice(0,120):"ملف",cutoff:typeof obj.cutoff==="string"?obj.cutoff.slice(0,40):null,metrics:{},trend:{labels:[],sales_2026:[],sales_2025:[],sales_2024:[]},departments:[],alerts:[]};
    keys.forEach(function(k){var m=obj.metrics[k]||{};clean.metrics[k]={today:number(m.today),prior_2025:number(m.prior_2025),prior_2024:number(m.prior_2024)};});
    var t=obj.trend||{};
    var labels=Array.isArray(t.labels)?t.labels.slice(0,35):[];
    clean.trend.labels=labels.map(function(x){return String(x).slice(0,18);});
    ["sales_2026","sales_2025","sales_2024"].forEach(function(k){var items=Array.isArray(t[k])?t[k].slice(0,clean.trend.labels.length):[];clean.trend[k]=items.map(number);});
    if(Array.isArray(obj.departments)){clean.departments=obj.departments.slice(0,10).map(function(x){return {name:String(x.name||"قسم").slice(0,35),share:number(x.share)};}).filter(function(x){return x.share!==null&&x.share>=0&&x.share<=100;});}
    if(Array.isArray(obj.alerts)){clean.alerts=obj.alerts.slice(0,12).map(function(x){return {level:knownLevels.has(x.level)?x.level:"info",text:String(x.text||"").slice(0,220)};});}
    return clean;
  }
  function chart(data){
    var svg=$("j21-linechart");while(svg.firstChild)svg.removeChild(svg.firstChild);
    var ns="http://www.w3.org/2000/svg";
    var make=function(tag,attr,text){var n=document.createElementNS(ns,tag);Object.keys(attr||{}).forEach(function(k){n.setAttribute(k,String(attr[k]));});if(text!==undefined)n.textContent=text;svg.appendChild(n);return n;};
    var count=data?data.trend.labels.length:0;
    for(var i=0;i<=4;i++){var y=16+34*i;make("line",{x1:28,y1:y,x2:492,y2:y,class:"gridline"});}
    if(!data||count<2){make("text",{x:250,y:91,"text-anchor":"middle",fill:"#b7d7c4","font-size":"16"},"لا توجد سلسلة بيانات معتمدة للعرض");return;}
    var series=["sales_2026","sales_2025","sales_2024"];
    var values=[];
    series.forEach(function(k){data.trend[k].forEach(function(v){if(v!==null)values.push(v);});});
    if(!values.length){make("text",{x:250,y:90,"text-anchor":"middle"},"بيانات المقارنة غير متاحة");return;}
    var min=Math.min(0,Math.min.apply(null,values)),max=Math.max.apply(null,values);if(max===min)max=min+1;
    series.forEach(function(k,si){var pts=[];data.trend[k].forEach(function(v,i){if(v===null)return;var x=30+(i/Math.max(1,count-1))*460,y=152-((v-min)/(max-min))*128;pts.push(x.toFixed(1)+","+y.toFixed(1));});if(pts.length>=2)make("polyline",{points:pts.join(" "),fill:"none",stroke:[colors[0],colors[1],colors[2]][si],"stroke-width":si===0?3:2,"stroke-linejoin":"round","stroke-linecap":"round",opacity:si===0?1:0.8});});
    [0,Math.floor((count-1)/2),count-1].forEach(function(i){make("text",{x:30+(i/(count-1))*460,y:170,"text-anchor":"middle"},data.trend.labels[i]);});
  }
  function departments(items){
    var list=$("j21-departments");list.replaceChildren();var donut=$("j21-donut");
    var total=items.reduce(function(s,x){return s+x.share;},0);
    if(!total){donut.style.background="conic-gradient(#244b37 0 100%)";setText("j21-donut-caption","—");var e=document.createElement("li");e.textContent="لا توجد بيانات موثقة للأقسام";list.appendChild(e);return;}
    var upto=0,segments=[];
    items.slice(0,4).forEach(function(x,i){var end=Math.min(100,upto+(x.share/total*100));segments.push(colors[i]+" "+upto+"% "+end+"%");upto=end;});
    if(upto<100)segments.push("#244b37 "+upto+"% 100%");
    donut.style.background="conic-gradient("+segments.join(",")+")";setText("j21-donut-caption","100%");
    items.forEach(function(x,i){var li=document.createElement("li"),name=document.createElement("span"),value=document.createElement("b");name.textContent="● "+x.name;name.style.color=colors[i%colors.length];value.textContent=fmt(x.share)+"%";li.append(name,value);list.appendChild(li);});
  }
  function alerts(items){
    var box=$("j21-alerts");box.replaceChildren();
    if(!items.length){var div=document.createElement("div");div.className="j21-alert warn";div.textContent="التنبيهات غير متاحة دون مصدر بيانات مصادق عليه.";box.appendChild(div);return;}
    items.slice(0,5).forEach(function(x){var div=document.createElement("div");div.className="j21-alert "+(x.level==="info"?"":x.level);div.textContent=x.text;box.appendChild(div);});
  }
  function render(){
    keys.forEach(function(k){var x=state&&state.metrics[k];setText("j21-k-"+k,fmt(x&&x.today));setText("j21-y-"+k,x?"2025: "+pct(x.today,x.prior_2025)+"  |  2024: "+pct(x.today,x.prior_2024):"2025/2024: —");});
    setText("j21-state",state?(provenance==="LOCAL"?"ملف محلي · غير متحقق":"API · تحقق المصدر مطلوب"):"NOT_CONNECTED");
    setText("j21-source",state?sourceName:"Jawafa_DB: غير متصل");
    setText("j21-updated",loadedAt?"عرض: "+loadedAt:"آخر تحديث: غير متوفر");
    chart(state);departments(state?state.departments:[]);alerts(state?state.alerts:[]);
    $("j21-export").disabled=!state;$("j21-export-csv").disabled=!state;
  }
  function accept(data,where,label){
    state=validate(data);provenance=where;sourceName=label||state.source;loadedAt=new Date().toLocaleString("ar-JO");render();
    setText("j21-feedback","تم تحميل الأرقام للعرض محليًا، ولا يُعد ذلك إثباتًا لصحة المصدر أو اعتماده.");
  }
  $("j21-import").addEventListener("click",function(){$("j21-upload").click();});
  $("j21-upload").addEventListener("change",async function(e){
    var f=e.target.files&&e.target.files[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error("الملف يتجاوز 5 ميغابايت");accept(JSON.parse(await f.text()),"LOCAL","ملف محلي: "+f.name);}catch(err){setText("j21-feedback","تعذر استيراد الملف: "+err.message);}finally{e.target.value="";}
  });
  function download(content,mime,filename){var blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
  $("j21-export").addEventListener("click",function(){if(!state)return;download(JSON.stringify({provenance:provenance,loaded_at:loadedAt,data:state},null,2),"application/json;charset=utf-8","jawafa-2100-display.json");});
  $("j21-export-csv").addEventListener("click",function(){if(!state)return;var rows=[["metric","today","2025","2024"]];keys.forEach(function(k){var m=state.metrics[k];rows.push([k,m.today,m.prior_2025,m.prior_2024]);});var csv="\uFEFF"+rows.map(function(row){return row.map(function(v){return '"'+String(v===null?"":v).replace(/"/g,'""')+'"';}).join(",");}).join("\r\n");download(csv,"text/csv;charset=utf-8","jawafa-2100-metrics.csv");});
  $("j21-connect").addEventListener("click",async function(){
    var path=window.JAWAFA_2100_ENDPOINT;
    if(typeof path!=="string"||!path.startsWith("/api/jawafa/v1/")||path.startsWith("//")){setText("j21-feedback","NOT_CONNECTED — لا يوجد جسر API خاص موثق ومجهز لهذه الشاشة.");return;}
    try{setText("j21-feedback","جارٍ التحقق من استجابة جسر القراءة المصرح به…");var res=await fetch(path,{credentials:"same-origin",cache:"no-store",headers:{Accept:"application/json"}});if(!res.ok)throw Error("HTTP "+res.status);var body=await res.json();accept(body,"API","جسر القراءة الخاص: "+path);}catch(err){setText("j21-feedback","فشل الاتصال المصرح به: "+err.message);};
  });
  render();
})();
