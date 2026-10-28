'use strict';
const ids = new Set(['m01','m02','m03','m04','m05','m06','m07','m08']);
let items = [], pos = 0;
const assetVersion = new URLSearchParams(document.currentScript?.src.split('?')[1] || '').get('v');
const frame = document.getElementById('material');
const progress = document.getElementById('progress');
function syncTheme() {
  frame.contentWindow?.postMessage({type:'shad-theme', theme:document.documentElement.dataset.theme, viewportHeight:innerHeight}, '*');
}
frame.addEventListener('load', syncTheme);
addEventListener('resize', syncTheme);
document.addEventListener('shad-theme-change', syncTheme);
function render(focus = false) {
  frame.style.height = '';
  frame.src = 'materials/' + items[pos] + '.html' + (assetVersion ? '?v=' + encodeURIComponent(assetVersion) : '');
  frame.title = 'Материал ' + items[pos].toUpperCase() + ' для обсуждения';
  progress.textContent = 'Материал ' + (pos + 1) + ' из ' + items.length;
  document.getElementById('material-code').textContent = items[pos].toUpperCase();
  document.getElementById('prev').disabled = pos === 0;
  document.getElementById('next').disabled = pos === items.length - 1;
  document.getElementById('solo').href = frame.src;
  document.getElementById('solo').hidden = false;
  document.getElementById('last').hidden = pos !== items.length - 1;
  if (focus) progress.focus({preventScroll:true});
  scrollTo(0, 0);
}
function start(raw) {
  const list = raw.toLowerCase().replace(/\s/g, '').split(',');
  if (!list.length || list.length > 2 || list.some(x => !ids.has(x)) || new Set(list).size !== list.length) {
    document.getElementById('error').textContent = 'Проверьте код материала: например, M01 или M01,M02.';
    document.getElementById('code').setAttribute('aria-invalid', 'true');
    progress.textContent = 'Материалы для беседы';
    document.getElementById('solo').hidden = true;
    document.getElementById('entry').hidden = false;
    document.getElementById('session').hidden = true;
    frame.removeAttribute('src');
    return;
  }
  items = list; pos = 0;
  document.getElementById('entry').hidden = true;
  document.getElementById('session').hidden = false;
  document.getElementById('error').textContent = '';
  document.getElementById('code').removeAttribute('aria-invalid');
  render();
}
document.getElementById('open').addEventListener('submit', e => {
  e.preventDefault(); start(document.getElementById('code').value);
});
document.getElementById('prev').onclick = () => { if (pos > 0) { pos--; render(true); } };
document.getElementById('next').onclick = () => { if (pos < items.length - 1) { pos++; render(true); } };
addEventListener('message', e => {
  if (e.source === frame.contentWindow && e.data?.type === 'shad-height' && Number.isFinite(e.data.height)) {
    frame.style.height = Math.min(25000, Math.max(200, e.data.height + 2)) + 'px';
  }
});
const initial = new URLSearchParams(location.search).get('items');
if (initial) start(initial);
