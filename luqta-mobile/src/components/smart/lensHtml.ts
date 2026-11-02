// Camera / microphone page for the WebView (native) and iframe (web). No native modules:
// live preview via getUserMedia, barcode reading via the BarcodeDetector API when the
// WebView supports it, still capture (downsized JPEG) and short voice recording
// (MediaRecorder). Falls back to the system camera file chooser and manual entry.
export type LensMode = "barcode" | "photo" | "voice";
export const lensHtml = (mode: LensMode, labels: { capture: string; stop: string; record: string; fallback: string }) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;background:#130050;color:#fff;font-family:sans-serif;overflow:hidden}video{width:100%;height:100%;object-fit:cover}
#ui{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;gap:10px}button,label{border:0;border-radius:999px;background:#FE585C;color:#fff;font-size:17px;font-weight:700;padding:13px 22px;display:flex;align-items:center;gap:8px}
#frame{position:absolute;left:12%;right:12%;top:28%;bottom:34%;border:3px solid rgba(255,255,255,.85);border-radius:18px;box-shadow:0 0 0 2000px rgba(19,0,80,.35)}#msg{position:absolute;top:12px;left:12px;right:12px;text-align:center;font-size:15px;text-shadow:0 1px 3px #000}
input{display:none}#rec{width:86px;height:86px;border-radius:50%;justify-content:center;font-size:15px}.on{animation:p 1s infinite}@keyframes p{50%{box-shadow:0 0 0 14px rgba(254,88,92,.35)}}</style></head>
<body><video id="v" playsinline muted autoplay></video>${mode === "barcode" ? '<div id="frame"></div>' : ""}<div id="msg"></div><div id="ui"></div>
<script>
var MODE=${JSON.stringify(mode)},L=${JSON.stringify(labels)};
var send=function(m){var s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,'*');};
var ui=document.getElementById('ui'),msg=document.getElementById('msg'),v=document.getElementById('v'),stream=null;
function shrink(src,cb){var img=new Image();img.onload=function(){var max=1280,w=img.naturalWidth||img.videoWidth,h=img.naturalHeight||img.videoHeight,k=Math.min(1,max/Math.max(w,h));var c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);cb(c.toDataURL('image/jpeg',0.82),c);};img.src=src;}
function fileFallback(){var l=document.createElement('label');l.textContent=L.fallback;var i=document.createElement('input');i.type='file';i.accept='image/*';i.setAttribute('capture','environment');l.appendChild(i);ui.appendChild(l);
 i.onchange=function(e){var f=e.target.files&&e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){shrink(r.result,function(d,c){if(MODE==='barcode'&&window.BarcodeDetector){new BarcodeDetector().detect(c).then(function(b){if(b&&b[0])send({type:'barcode',value:b[0].rawValue,format:b[0].format});else send({type:'photo',dataUrl:d,noBarcode:true});}).catch(function(){send({type:'photo',dataUrl:d,noBarcode:true});});}else send({type:'photo',dataUrl:d});});};r.readAsDataURL(f);};}
function snap(){var c=document.createElement('canvas');var w=v.videoWidth,h=v.videoHeight,k=Math.min(1,1280/Math.max(w,h));c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(v,0,0,c.width,c.height);send({type:'photo',dataUrl:c.toDataURL('image/jpeg',0.82)});}
function start(){
 if(MODE==='voice'){
  if(!navigator.mediaDevices||!window.MediaRecorder){msg.textContent='';send({type:'error',code:'NO_RECORDER'});return;}
  var b=document.createElement('button');b.id='rec';b.textContent=L.record;ui.appendChild(b);var rec=null,chunks=[],timer=null;
  b.onclick=function(){if(rec&&rec.state==='recording'){rec.stop();return;}
   navigator.mediaDevices.getUserMedia({audio:true}).then(function(s){stream=s;chunks=[];var type=MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':'audio/mp4';rec=new MediaRecorder(s,{mimeType:type});
    rec.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};
    rec.onstop=function(){clearTimeout(timer);b.classList.remove('on');b.textContent=L.record;s.getTracks().forEach(function(t){t.stop();});var blob=new Blob(chunks,{type:type});var r=new FileReader();r.onload=function(){send({type:'audio',dataUrl:String(r.result).replace(/;codecs=[^;]+/,'')});};r.readAsDataURL(blob);};
    rec.start();b.classList.add('on');b.textContent=L.stop;send({type:'recording'});timer=setTimeout(function(){if(rec.state==='recording')rec.stop();},8000);
   }).catch(function(){send({type:'error',code:'MIC_DENIED'});});};
  send({type:'ready'});return;}
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){fileFallback();send({type:'ready',live:false});return;}
 navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280}},audio:false}).then(function(s){stream=s;v.srcObject=s;
  if(MODE==='photo'){var b=document.createElement('button');b.textContent=L.capture;b.onclick=snap;ui.appendChild(b);}
  if(MODE==='barcode'){if(window.BarcodeDetector){var det=new BarcodeDetector();var busy=false,seen=false;setInterval(function(){if(busy||seen||v.readyState<2)return;busy=true;det.detect(v).then(function(r){busy=false;if(r&&r[0]&&!seen){seen=true;send({type:'barcode',value:r[0].rawValue,format:r[0].format});setTimeout(function(){seen=false;},2500);}}).catch(function(){busy=false;});},350);}else{send({type:'error',code:'NO_BARCODE_DETECTOR'});var b2=document.createElement('button');b2.textContent=L.capture;b2.onclick=snap;ui.appendChild(b2);}}
  send({type:'ready',live:true});
 }).catch(function(){fileFallback();send({type:'error',code:'CAMERA_DENIED'});});
}
window.addEventListener('pagehide',function(){if(stream)stream.getTracks().forEach(function(t){t.stop();});});
start();
</script></body></html>`;
