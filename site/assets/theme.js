/* Apply the saved choice before painting; research stimuli keep their original colors. */
(() => {
  'use strict';
  const key = 'shad-color-theme';
  const root = document.documentElement;
  let theme = 'light';
  let button;
  try { if (localStorage.getItem(key) === 'dark') theme = 'dark'; } catch {}
  try { if (parent !== window && parent.document.documentElement.dataset.theme) theme = parent.document.documentElement.dataset.theme; } catch {}
  function apply(next) {
    theme = next === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    if (button) button.setAttribute('aria-pressed', String(theme === 'dark'));
    document.dispatchEvent(new CustomEvent('shad-theme-change', {detail: theme}));
  }
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header-inner');
    if (!header) return;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', 'Тёмная тема');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 14.2A8.6 8.6 0 0 1 9.8 3.7 8.6 8.6 0 1 0 20.3 14.2Z"/></svg><span>Тёмная тема</span>';
    button.addEventListener('click', () => {
      apply(theme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(key, theme); } catch {}
    });
    header.append(button);
    apply(theme);
  });
  addEventListener('message', event => {
    if (parent !== window && event.source === parent && event.data?.type === 'shad-theme') apply(event.data.theme);
  });
  addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(event.newValue);
  });
})();
