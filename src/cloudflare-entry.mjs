import app from './worker.mjs';

// Only the standalone Cloudflare deployment uses this entry point. Keep Sites
// available until its complete database has been copied and verified.
export default {
  async fetch(request, env, ctx) {
    if (env.SVOYAK_MIGRATION_STATUS === 'ready') return app.fetch(request, env, ctx);

    const api = new URL(request.url).pathname.startsWith('/api/');
    const message = 'Перенос ещё не завершён. Турниры пока доступны на прежнем сайте.';
    const body = api ? JSON.stringify({error: message}) : `<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Своя игра · Перенос сайта</title>
<main><h1>Перенос ещё не завершён</h1><p>Продолжайте работу с турнирами на прежнем сайте.</p>
<p><a href="https://svoyak.sardarka-300.chatgpt.site" rel="noreferrer">Открыть работающий сайт</a></p></main></html>`;
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
