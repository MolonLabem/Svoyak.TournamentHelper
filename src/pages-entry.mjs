import app from './cloudflare-entry.mjs';
import transition from './sites-entry.mjs';

// Deployment/preview aliases cannot become extra application origins.
export default {
  fetch(request,env,ctx){
    if(new URL(request.url).hostname!=='svoyak-tournament.pages.dev')return transition.fetch(request);
    return app.fetch(request,env,ctx);
  }
};
