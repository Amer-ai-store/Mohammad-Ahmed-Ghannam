/* Read-only connection indicators for independently authenticated dashboard services.
   The public host neither holds credentials nor performs private API requests here. */
(() => {
  'use strict';
  const box = document.getElementById('dashboard-connections');
  if (!box) return;
  const fields = {
    aas: document.getElementById('connection-aas'),
    jawafa: document.getElementById('connection-jawafa'),
    luqta: document.getElementById('connection-luqta')
  };
  const descriptions = {
    aas: document.getElementById('connection-aas-detail'),
    jawafa: document.getElementById('connection-jawafa-detail'),
    luqta: document.getElementById('connection-luqta-detail')
  };
  let luqta = null;
  function show(key, status, label, message) {
    if (!fields[key] || !descriptions[key]) return;
    fields[key].dataset.state = status;
    fields[key].textContent = label;
    descriptions[key].textContent = message;
  }
  function refresh() {
    const frame = document.getElementById('aas-live-frame');
    let aasConnected = false;
    let aasLoaded = false;
    try {
      aasLoaded = !!frame?.getAttribute('src');
      aasConnected = frame?.contentWindow?.AASOwnerConnection?.isConnected() === true;
    } catch { /* AAS view inaccessible; never infer a successful login. */ }
    show('aas', aasConnected ? 'connected' : 'unverified',
      aasConnected ? 'جلسة المالك متصلة' : (aasLoaded ? 'جلسة المالك غير مثبتة هنا' : 'افتح واجهة AAS أولًا'),
      'الاتصال لا يثبت تسجيل الوكلاء أو تشغيل النماذج.');

    let jawafaConnected = false;
    try { jawafaConnected = window.JawafaUI?.connected() === true; } catch {}
    show('jawafa', jawafaConnected ? 'connected' : 'unverified',
      jawafaConnected ? 'جسر جوافة مصادق عليه' : 'لا يوجد اتصال حي مثبت',
      jawafaConnected ? 'تأكدت واجهة جوافة من مصدر API ومخططه؛ قبول GATE-15 منفصل.' :
        'اللقطات التاريخية لا تعني اتصالًا بقاعدة البيانات، ولا تسمح بتنفيذ أوامر.');

    const verified = luqta?.connected === true && luqta?.healthVerified === true;
    show('luqta', verified ? 'connected' : 'unverified',
      verified ? 'جلسة مدير وفحص خادم ناجحان' : (luqta?.connected ? 'جلسة موجودة؛ الصحة غير مثبتة' : 'اتصال المدير غير مثبت'),
      verified ? 'فحص API في هذه الجلسة فقط؛ اعتماد المخزون وجسر جوافة منفصلان.' :
        'يتطلب رابط HTTPS نشطًا وجلسة مدير مستقلة؛ لا تعتمد على عنوان نفق مؤقت منتهي.');
  }
  window.addEventListener('luqta:bridge-state', event => {
    const detail = event.detail;
    luqta = detail && typeof detail === 'object' ? {
      connected: detail.connected === true,
      healthVerified: detail.healthVerified === true
    } : null;
    refresh();
  });
  document.getElementById('connection-check')?.addEventListener('click', refresh);
  document.getElementById('aas-live-frame')?.addEventListener('load', refresh);
  window.addEventListener('hashchange', refresh);
  window.addEventListener('focus', refresh);
  const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 5000);
  window.addEventListener('pagehide', () => window.clearInterval(timer), {once:true});
  refresh();
})();
