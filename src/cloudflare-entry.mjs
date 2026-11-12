import app from './worker.mjs';

// Only an explicitly ready standalone deployment can read or write tournaments.
// The old Sites database is now a frozen archive, not a writable fallback.
export default {
  async fetch(request, env, ctx) {
    if (env.SVOYAK_MIGRATION_STATUS === 'ready') return app.fetch(request, env, ctx);

    const api = new URL(request.url).pathname.startsWith('/api/');
    const message = 'Турниры временно недоступны. Выполняется проверка данных; попробуйте позже.';
    const body = api ? JSON.stringify({error: message}) : `<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Своя игра · Проверка данных</title>
<main><h1>Турниры временно недоступны</h1><p>Выполняется проверка данных. Сохранение временно остановлено; попробуйте позже.</p>
<p>Прежний адрес больше не принимает изменения.</p></main></html>`;
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 503,
      headers: {
        'Content-Type': api ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer'
      }
    });
  }
};
