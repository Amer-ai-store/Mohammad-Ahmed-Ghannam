'use strict';
(() => {
  const button = document.getElementById('install');
  const status = document.getElementById('status');
  let promptEvent;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    button.hidden = false;
  });
  button.addEventListener('click', async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      status.textContent = 'راجع الشاشة الرئيسية للتحقق من التثبيت.';
    } catch {
      status.textContent = 'استخدم قائمة المتصفح لإضافة الصفحة إلى الشاشة الرئيسية.';
    }
    promptEvent = undefined;
    button.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    button.hidden = true;
    status.textContent = 'تم تثبيت بوابة الوصول.';
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
})();
