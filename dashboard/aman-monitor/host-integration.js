(() => {
  'use strict';
  const button = document.getElementById('aman-access-toggle');
  const container = document.getElementById('aman-access-container');
  const frame = document.getElementById('aman-access-frame');
  if (!button || !container || !frame) return;

  function close() {
    container.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.textContent = 'عرض لوحة أمان داخل مركز القيادة';
    // Destroy the frame rather than retaining a private API token in a hidden tab.
    frame.removeAttribute('src');
  }

  button.addEventListener('click', () => {
    if (!container.hidden) {
      close();
      return;
    }
    container.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.textContent = 'إغلاق لوحة أمان ومسح جلسة القراءة';
    frame.setAttribute('src', './aman-monitor/');
  });
  window.addEventListener('hashchange', () => {
    if (location.hash !== '#jawafa-monitor') close();
  });
  window.addEventListener('pagehide', close);
  const section = button.closest('section.view');
  if (section) {
    new MutationObserver(() => {
      if (section.hidden) close();
    }).observe(section, {attributes: true, attributeFilter: ['hidden']});
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow ||
        event.data?.type !== 'aman:details-open' || container.hidden) return;
    frame.scrollIntoView({block: 'start', behavior: 'auto'});
  });
})();
