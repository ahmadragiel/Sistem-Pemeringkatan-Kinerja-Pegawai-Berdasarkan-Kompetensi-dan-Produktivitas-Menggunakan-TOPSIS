const body = document.body;
const sidebar = document.getElementById('sidebar');
const menuButton = document.querySelector('[data-sidebar-open]');
const closeButtons = document.querySelectorAll('[data-sidebar-close]');
const backdrop = document.querySelector('.sidebar-backdrop');

function focusableInSidebar() {
  if (!sidebar) return [];
  return Array.from(
    sidebar.querySelectorAll('a[href], button:not([disabled])')
  ).filter((element) => element.offsetParent !== null);
}

function openSidebar() {
  if (!sidebar) return;
  body.classList.add('nav-open');
  if (backdrop) backdrop.hidden = false;
  if (menuButton) menuButton.setAttribute('aria-expanded', 'true');
  const firstLink = sidebar.querySelector('.nav-link');
  if (firstLink) firstLink.focus();
}

function closeSidebar(returnFocus) {
  body.classList.remove('nav-open');
  if (backdrop) backdrop.hidden = true;
  if (menuButton) {
    menuButton.setAttribute('aria-expanded', 'false');
    if (returnFocus) menuButton.focus();
  }
}

function handleDrawerKeydown(event) {
  if (!body.classList.contains('nav-open')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSidebar(true);
    return;
  }
  if (event.key !== 'Tab') return;

  const focusables = focusableInSidebar();
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
}

export function initNavigation() {
  if (menuButton) {
    menuButton.addEventListener('click', () => {
      if (body.classList.contains('nav-open')) {
        closeSidebar(true);
      } else {
        openSidebar();
      }
    });
  }

  closeButtons.forEach((button) => {
    button.addEventListener('click', () => closeSidebar(true));
  });

  document.addEventListener('keydown', handleDrawerKeydown);

  window.addEventListener('resize', () => {
    if (window.innerWidth > 980 && body.classList.contains('nav-open')) {
      closeSidebar(false);
    }
  });
}
