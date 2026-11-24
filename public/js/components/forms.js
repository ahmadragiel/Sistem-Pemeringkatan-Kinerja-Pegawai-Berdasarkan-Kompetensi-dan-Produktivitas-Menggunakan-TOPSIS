export function initFormBusyState() {
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', () => {
      const submitButton = form.querySelector('button[type="submit"]');
      if (!submitButton || submitButton.disabled) return;
      const busyLabel = submitButton.getAttribute('data-busy-label') || 'Memproses...';
      submitButton.setAttribute('aria-busy', 'true');
      submitButton.classList.add('is-busy');
      submitButton.disabled = true;
      submitButton.textContent = busyLabel;
    });
  });
}
