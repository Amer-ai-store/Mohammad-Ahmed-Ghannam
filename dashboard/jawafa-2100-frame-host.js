/* Resize only the approved same-origin JAWAFA 2100 reference iframe.
 * Source and origin validation prevent unrelated frames from controlling layout. */
(()=>{
 "use strict";
 window.addEventListener("message",event=>{
  if(event.origin!==window.location.origin)return;
  const frame=document.getElementById("jawafa-2100-reference-frame");
  if(!frame||event.source!==frame.contentWindow)return;
  const data=event.data;
  if(!data||data.type!=="jawafa2100:content-height")return;
  const height=data.height;
  if(typeof height!=="number"||!Number.isFinite(height)||height<150||height>12000)return;
  const target=Math.ceil(height);
  const current=parseFloat(frame.style.height)||0;
  if(Math.abs(target-current)>2)frame.style.height=target+"px";
 });
})();
