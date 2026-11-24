export function initFlash() {
  document.querySelectorAll('[data-flash-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const flash = button.closest('.flash');
      if (flash) flash.remove();
    });
  });
}
