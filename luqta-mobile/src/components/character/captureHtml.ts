// Camera capture page shared by the native WebView and the web iframe.
export const captureHtml = (label: string, color: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;background:transparent;font-family:sans-serif}label{display:flex;height:100%;align-items:center;justify-content:center;gap:12px;border-radius:999px;background:${color};color:#fff;font-size:19px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}input{display:none}svg{width:28px;height:28px}</style></head>
<body><label><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>${label}<input id="f" type="file" accept="image/*" capture="user"></label>
<script>
var send=function(m){var s=JSON.stringify(m);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);else if(window.parent!==window)window.parent.postMessage(s,'*');};
document.getElementById('f').addEventListener('change',function(e){var file=e.target.files&&e.target.files[0];if(!file)return;var r=new FileReader();
r.onload=function(){var img=new Image();img.onload=function(){var max=1024,w=img.naturalWidth,h=img.naturalHeight,k=Math.min(1,max/Math.max(w,h));var c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);send({type:'photo',dataUrl:c.toDataURL('image/jpeg',0.85)});};img.onerror=function(){send({type:'error'});};img.src=r.result;};
r.onerror=function(){send({type:'error'});};r.readAsDataURL(file);e.target.value='';});
</script></body></html>`;

