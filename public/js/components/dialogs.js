export function initConfirmDialog() {
  const dialog = document.getElementById('confirm-dialog');
  const form = document.getElementById('confirm-form');
  const title = document.getElementById('confirm-title');
  const message = document.getElementById('confirm-message');
  const submit = document.getElementById('confirm-submit');
  const cancel = dialog ? dialog.querySelector('[data-dialog-cancel]') : null;
  let lastTrigger = null;

  document.querySelectorAll('[data-confirm-action]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const action = trigger.getAttribute('data-confirm-action');
      const text = trigger.getAttribute('data-confirm-message') || '';
      const heading = trigger.getAttribute('data-confirm-title') || 'Konfirmasi tindakan';
      const label = trigger.getAttribute('data-confirm-label') || 'Lanjutkan';
      const tone = trigger.getAttribute('data-confirm-tone') || 'primary';

      if (!dialog || !form || !submit) {
        if (window.confirm(text)) {
          const fallback = document.createElement('form');
          fallback.method = 'post';
          fallback.action = action;
          document.body.appendChild(fallback);
          fallback.submit();
        }
        return;
      }

      lastTrigger = trigger;
      form.action = action;
      if (title) title.textContent = heading;
      if (message) message.textContent = text;
      submit.textContent = label;
      submit.className = 'btn ' + (tone === 'danger' ? 'btn--danger' : 'btn--primary');

      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
        if (cancel) cancel.focus();
      } else if (window.confirm(text)) {
        form.submit();
      }
    });
  });

  if (!dialog) return;

  if (cancel) {
    cancel.addEventListener('click', () => dialog.close());
  }

  dialog.addEventListener('close', () => {
    if (lastTrigger) {
      lastTrigger.focus();
      lastTrigger = null;
    }
  });

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusables = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.disabled && element.offsetParent !== null);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
