import {redirectBrowser} from './sites-redirect.mjs';

const destination='https://svoyak.sardarka-300.workers.dev';
const redirectScript=`(${redirectBrowser.toString()})();`;
const headers={
  'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};

// Permanent source entry: no application handler, D1 access, or credential bridge.
export default {
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(!['GET','HEAD'].includes(request.method)||path.startsWith('/api/')||path.startsWith('/__migration/')){
      return new Response(request.method==='HEAD'?null:JSON.stringify({error:'Сайт переехал. Откройте турнир на новом адресе; прежний сайт больше не сохраняет изменения.',url:destination}),{status:410,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
    }
    if(path==='/migration-redirect.mjs')return new Response(request.method==='HEAD'?null:redirectScript,{headers:{...headers,'Content-Type':'text/javascript; charset=utf-8'}});
    const route=/^\/t\/[a-zA-Z0-9-]{1,100}$/.test(path)?path:'/';
    const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Своя игра · Новый адрес</title>
<style>html{color-scheme:light dark;font:18px/1.6 system-ui,sans-serif}body{margin:0;padding:2rem}main{max-width:42rem;margin:8vh auto}h1{line-height:1.2}button,a{font:inherit}button{padding:.7rem 1rem;cursor:pointer}a{overflow-wrap:anywhere}p{margin:1.2rem 0}</style>
<script type="module" src="/migration-redirect.mjs"></script></head><body><main><h1>Турниры переехали</h1>
<p>Все сохранённые турниры доступны на новом адресе. На прежнем сайте изменения больше не принимаются.</p>
<p>В новом браузере или на новом адресе организатору нужно открыть сохранённую приватную ссылку и подтвердить восстановление управления. Cookies прежнего адреса не переносятся.</p>
<p id="recovery-note" hidden>Вы открыли приватную ссылку. Она уже убрана из адресной строки. Продолжайте только на своём устройстве: на новом сайте потребуется подтвердить восстановление управления.</p>
<button id="continue-management" type="button" hidden>Перейти и восстановить управление</button>
<p><a id="public-destination" href="${destination+route}" rel="noreferrer">Открыть турнир на новом сайте</a></p>
<noscript><p>Для восстановления управления включите JavaScript или замените только адрес сайта в сохранённой приватной ссылке на svoyak.sardarka-300.workers.dev.</p></noscript>
</main></body></html>`;
    return new Response(request.method==='HEAD'?null:html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
  }
};
