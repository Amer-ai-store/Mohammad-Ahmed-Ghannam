// Canvas compositor for الاستوديو الإبداعي: scene + product cut-out (drag / pinch / rotate),
// caption, export PNG. Images: data URLs or https only (CSP).
export const studioHtml = (init: { scene: string; product?: string | null; caption?: string }) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:;">
<style>html,body{margin:0;height:100%;background:#EDE7FB;overflow:hidden;touch-action:none}canvas{width:100%;height:100%;display:block}</style></head><body><canvas id="c"></canvas>
<script>
var init=${JSON.stringify(init).replace(/</g, "\\u003c")};
var send=function(m){var s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,'*');};
var c=document.getElementById('c'),x=c.getContext('2d'),S=1080,scene=null,prod=null,caption=init.caption||'';
var st={x:S/2,y:S*0.62,s:0.5,r:0};c.width=S;c.height=S;
function load(src,cb){if(!src){cb(null);return;}var i=new Image();i.crossOrigin='anonymous';i.onload=function(){cb(i);};i.onerror=function(){send({type:'error',code:'IMAGE'});cb(null);};i.src=src;}
function draw(){x.clearRect(0,0,S,S);if(scene){var k=Math.max(S/scene.width,S/scene.height);x.drawImage(scene,(S-scene.width*k)/2,(S-scene.height*k)/2,scene.width*k,scene.height*k);}else{x.fillStyle='#F6F2FE';x.fillRect(0,0,S,S);}
 if(prod){var w=prod.width*st.s*(S/ Math.max(prod.width,prod.height)),h=prod.height*st.s*(S/Math.max(prod.width,prod.height));x.save();x.translate(st.x,st.y);x.rotate(st.r);x.shadowColor='rgba(19,0,80,.35)';x.shadowBlur=40;x.shadowOffsetY=24;x.drawImage(prod,-w/2,-h/2,w,h);x.restore();}
 if(caption){x.font='bold 64px sans-serif';x.textAlign='center';x.direction='rtl';var tw=x.measureText(caption).width+60;x.fillStyle='rgba(254,88,92,.92)';var bx=(S-tw)/2;x.beginPath();x.roundRect?x.roundRect(bx,S-150,tw,96,48):x.rect(bx,S-150,tw,96);x.fill();x.fillStyle='#fff';x.fillText(caption,S/2,S-82);}
 x.font='bold 30px sans-serif';x.textAlign='left';x.fillStyle='rgba(255,255,255,.9)';x.fillText('لُقطة',28,52);}
function cmd(m){if(typeof m==='string'){try{m=JSON.parse(m);}catch(e){return;}}if(!m)return;
 if(m.type==='scene')load(m.src,function(i){scene=i;draw();});
 if(m.type==='product')load(m.src,function(i){prod=i;draw();});
 if(m.type==='caption'){caption=String(m.text||'').slice(0,40);draw();}
 if(m.type==='scale'){st.s=Math.max(0.1,Math.min(1.6,st.s*m.k));draw();}
 if(m.type==='rotate'){st.r+=m.d;draw();}
 if(m.type==='reset'){st={x:S/2,y:S*0.62,s:0.5,r:0};draw();}
 if(m.type==='export'){try{send({type:'image',dataUrl:c.toDataURL('image/png')});}catch(e){send({type:'error',code:'TAINTED'});}}}
window.LuqtaStudio={command:cmd};window.addEventListener('message',function(e){cmd(e.data);});document.addEventListener('message',function(e){cmd(e.data);});
var pts={},base=null;function pos(e){var r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*S/r.width,y:(e.clientY-r.top)*S/r.height};}
c.addEventListener('pointerdown',function(e){pts[e.pointerId]=pos(e);c.setPointerCapture(e.pointerId);base=null;});
c.addEventListener('pointermove',function(e){if(!pts[e.pointerId])return;var p=pos(e),ids=Object.keys(pts);
 if(ids.length===1){st.x+=p.x-pts[e.pointerId].x;st.y+=p.y-pts[e.pointerId].y;}
 else if(ids.length>=2){pts[e.pointerId]=p;var a=pts[ids[0]],b=pts[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y),ang=Math.atan2(b.y-a.y,b.x-a.x);if(base){st.s=Math.max(0.1,Math.min(1.6,base.s*d/base.d));st.r=base.r+ang-base.a;}else base={d:d,a:ang,s:st.s,r:st.r};}
 pts[e.pointerId]=p;draw();});
function up(e){delete pts[e.pointerId];base=null;}c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
load(init.scene,function(i){scene=i;load(init.product,function(p){prod=p;draw();send({type:'ready'});});});
</script></body></html>`;
