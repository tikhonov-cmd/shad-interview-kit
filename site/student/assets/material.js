// Size embedded video against the outer viewport, avoiding iframe height feedback.
function setViewerHeight(height) {
  if (Number.isFinite(height) && height > 0) document.documentElement.style.setProperty('--viewer-height', height + 'px');
}
try { if (parent !== window) setViewerHeight(parent.innerHeight); } catch {}
addEventListener('message', event => {
  if (parent !== window && event.source === parent && event.data?.type === 'shad-theme') setViewerHeight(event.data.viewportHeight);
});
(()=>{function tell(){if(parent!==window)parent.postMessage({type:'shad-height',height:Math.ceil(document.body.getBoundingClientRect().height)},'*')}new ResizeObserver(tell).observe(document.body);addEventListener('load',tell);document.fonts.ready.then(tell);document.querySelectorAll('video').forEach(v=>v.addEventListener('error',()=>{let p=document.createElement('p');p.className='error';p.textContent=v.dataset.stimulusVersion?'Видео не удалось загрузить. Сообщите интервьюеру. Для этого интервью нужна сокращённая версия 3:00.':'Видео не удалось загрузить. Попробуйте открыть исходник по ссылке ниже или сообщите интервьюеру.';v.after(p)}));})();