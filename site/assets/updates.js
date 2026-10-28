/* Notify about a published revision without replacing an interview in progress. */
(() => {
  'use strict';
  if (!/^https?:$/.test(location.protocol)) return;
  const current = document.querySelector('meta[name="shad-version"]')?.content;
  if (!current) return;
  let checking = false;
  let shown = false;
  async function check() {
    if (checking || shown || document.hidden) return;
    checking = true;
    try {
      const url = new URL('version.json', location.href);
      url.searchParams.set('check', String(Date.now()));
      const response = await fetch(url, {cache: 'no-store'});
      if (!response.ok) return;
      const latest = await response.json();
      if (typeof latest.version !== 'string' || latest.version === current) return;
      shown = true;
      const notice = document.createElement('aside');
      notice.className = 'site-update';
      notice.setAttribute('aria-label', 'Обновление сайта');
      const message = document.createElement('p');
      message.setAttribute('role', 'status');
      message.textContent = 'Доступна новая версия. Текущие вопросы останутся на экране, пока ты не обновишь страницу.';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'Обновить сейчас';
      button.addEventListener('click', () => {
        const next = new URL(location.href);
        next.searchParams.set('revision', latest.version);
        location.assign(next.href);
      });
      const later = document.createElement('button');
      later.type = 'button';
      later.className = 'text-button';
      later.textContent = 'Позже';
      later.addEventListener('click', () => notice.remove());
      notice.append(message, button, later);
      document.body.append(notice);
    } catch {
      // An unavailable connection must never interrupt the interview.
    } finally {
      checking = false;
    }
  }
  check();
  setInterval(check, 60000);
  document.addEventListener('visibilitychange', check);
  addEventListener('focus', check);
})();
