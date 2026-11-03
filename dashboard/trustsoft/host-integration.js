/* TrustSoft full native mounting inside the central dashboard; no iframe, no credentials persisted. */
(() => {
 'use strict';
 const section=document.querySelector('section.view[data-view="jawafa-trustsoft"]');
 const button=document.getElementById('trustsoft-toggle');
 const container=document.getElementById('trustsoft-container');
 const status=document.getElementById('trustsoft-host-status');
 if(!section||!button||!container||!status)return;
 let client=null,booting=null;
 const origin='https://trustsoft-control.zxzx-mohammad91.workers.dev';
 async function mount(){
  if(client)return client;
  if(booting)return booting;
  booting=(async()=>{
   const response=await fetch('./trustsoft/index.html',{cache:'no-store',credentials:'omit'});
   if(!response.ok)throw Error('TRUSTSOFT_TEMPLATE_HTTP_'+response.status);
   const parsed=new DOMParser().parseFromString(await response.text(),'text/html');
   const aside=parsed.body.querySelector('aside'),main=parsed.body.querySelector('main');
   if(!aside||!main||!globalThis.TrustSoftEmbedded)throw Error('TRUSTSOFT_NATIVE_DEPENDENCY_MISSING');
   const shadow=container.attachShadow({mode:'open'});
   const css=document.createElement('link');css.rel='stylesheet';css.href='./trustsoft/style.css';
   const overrides=document.createElement('style');
   overrides.textContent=":host{display:block;background:#f3f6fa;color:#1d3048;font:14px Tahoma,Arial,sans-serif;direction:rtl}.trustsoft-shell{display:grid;grid-template-columns:210px minmax(0,1fr);min-height:620px;border-radius:12px;overflow:hidden}.trustsoft-shell aside{position:static;top:auto;bottom:auto;display:flex;width:auto;padding:18px 12px;min-height:620px}.trustsoft-shell main{width:auto;max-width:none;margin:0;padding:18px;overflow:auto}.trustsoft-shell nav{overflow:visible}.trustsoft-shell .cards{grid-template-columns:repeat(auto-fit,minmax(145px,1fr))}@media(max-width:900px){.trustsoft-shell{display:block;min-height:0}.trustsoft-shell aside{min-height:0;width:100%;padding:12px}.trustsoft-shell aside nav{display:flex;flex-wrap:wrap;gap:4px}.trustsoft-shell aside footer{display:none}.trustsoft-shell main{padding:12px;width:100%}.trustsoft-shell .cards{grid-template-columns:repeat(2,minmax(0,1fr))}}";
   const shell=document.createElement('div');shell.className='trustsoft-shell';
   shell.append(document.importNode(aside,true),document.importNode(main,true));
   shadow.append(css,overrides,shell);
   // Same-origin template and standalone application remain one maintained source.
   client=globalThis.TrustSoftEmbedded.mount(shadow);
   status.textContent='الواجهة الأصلية مدمجة؛ حالة البيانات تحدد بعد تسجيل الدخول والتحقق';
   status.dataset.state='mounted';
   return client;
  })();
  try{return await booting;}catch(e){status.textContent='تعذر تحميل شاشات TrustSoft: '+String(e.message||'unknown');throw e;}
  finally{booting=null;}
 }
 function hide(){if(client)client.close();container.hidden=true;button.setAttribute('aria-expanded','false');button.textContent='إظهار شاشات TrustSoft';}
 async function show(){container.hidden=false;button.setAttribute('aria-expanded','true');button.textContent='إغلاق شاشات TrustSoft ومسح الجلسة';try{await mount();}catch{container.hidden=true;button.setAttribute('aria-expanded','false');}}
 button.addEventListener('click',()=>{if(container.hidden)void show();else hide();});
 function sync(){if(section.hidden || location.hash!=='#jawafa-trustsoft'){hide();return;}if(container.hidden)void show();}
 window.addEventListener('hashchange',sync);
 window.addEventListener('pagehide',hide);
 new MutationObserver(sync).observe(section,{attributes:true,attributeFilter:['hidden']});
 sync();
})();