import {migrationBridge} from './migration-bridge.mjs';

// Source-only entry. Database triggers also stop writes from old in-flight code.
export default {
  async fetch(request,env){
    if(new URL(request.url).pathname.startsWith('/__migration/'))return migrationBridge(request,env,'source');
    return new Response(request.method==='HEAD'?null:'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Перенос турниров</title><main><h1>Перенос турниров</h1><p>Сохранение временно остановлено. Данные и права доступа переносятся на новый адрес. Дождитесь окончания переноса и обновите страницу.</p></main></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
  }
};
