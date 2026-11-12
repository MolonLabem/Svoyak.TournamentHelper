// Temporary, server-only bridge. Remove after the verified cutover.
const migrationTables = {
  tournaments: ['id', 'payload', 'revision', 'updated_at', 'management_key_hash'],
  tournament_owner_sessions: ['tournament_id', 'session_hash', 'expires_at']
};
const migrationHeaders = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const migrationReply = (value, status=200) => new Response(JSON.stringify(value), {status, headers:migrationHeaders});
const migrationHash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(b=>b.toString(16).padStart(2,'0')).join('');

// Authenticate the exact method/path/body; neither keys nor data enter URLs/logs.
export async function authorizeMigration(request, env) {
  try {
  const url = new URL(request.url), time = request.headers.get('X-Migration-Time') ?? '';
  const signature = request.headers.get('X-Migration-Signature') ?? '';
  if (!env.SVOYAK_MIGRATION_SECRET || !/^\d{13}$/.test(time) || !/^[a-f0-9]{64}$/.test(signature)
      || Math.abs(Date.now()-Number(time))>60_000 || !(Number(env.SVOYAK_MIGRATION_EXPIRES)>Date.now()) || url.search) return false;
  const reader=request.clone().body?.getReader(); let length=0; const chunks=[];
  if(reader) for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>3_000_000){void reader.cancel();return false;}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SVOYAK_MIGRATION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g),v=>parseInt(v,16)),new TextEncoder().encode(`${request.method}\n${url.pathname}\n${time}\n${body}`));
  }catch{return false;}
}

export async function migrationBridge(request, env, role) {
  if(request.method!=='POST'||!await authorizeMigration(request,env))return migrationReply({error:'Not found'},404);
  try {
    const path=new URL(request.url).pathname, input=await request.json();
    if(role==='source'){
      const lock=await env.DB.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name IN ('svoyak_frozen_tournaments_insert','svoyak_frozen_tournaments_update','svoyak_frozen_tournaments_delete','svoyak_frozen_sessions_insert','svoyak_frozen_sessions_update','svoyak_frozen_sessions_delete')").first();
      if(lock.n!==6)return migrationReply({error:'Source is not frozen'},409);
    } else if(env.SVOYAK_MIGRATION_STATUS!=='pending')return migrationReply({error:'Target is not pending'},409);
    if(path==='/__migration/manifest'){
      const counts={};for(const table of Object.keys(migrationTables))counts[table]=(await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n;
      return migrationReply({format:'svoyak-d1-v1',role,counts,columns:migrationTables});
    }
    const columns=Object.hasOwn(migrationTables,input.table)?migrationTables[input.table]:null;
    if(!columns)return migrationReply({error:'Invalid table'},400);
    if(path==='/__migration/read'){
      if(!Number.isSafeInteger(input.offset)||input.offset<0)return migrationReply({error:'Invalid offset'},400);
      const row=await env.DB.prepare(`SELECT ${columns.join(',')} FROM ${input.table} ORDER BY ${columns[0]}${input.table==='tournament_owner_sessions'?',session_hash':''} LIMIT 1 OFFSET ?`).bind(input.offset).first();
      const values=row?columns.map(c=>row[c]):null;
      return migrationReply({values,hashes:values?await Promise.all(values.map(migrationHash)):null});
    }
    if(path==='/__migration/import'&&role==='target'){
      const v=input.values;
      if(!Array.isArray(v)||v.length!==columns.length)return migrationReply({error:'Invalid row'},400);
      const valid=input.table==='tournaments'
        ? typeof v[0]==='string'&&typeof v[1]==='string'&&Number.isSafeInteger(v[2])&&typeof v[3]==='string'&&(v[4]===null||typeof v[4]==='string')
        : typeof v[0]==='string'&&typeof v[1]==='string'&&Number.isSafeInteger(v[2]);
      if(!valid)return migrationReply({error:'Invalid field type'},400);
      if(input.table==='tournaments')JSON.parse(v[1]); // Validate only; never reserialize payload.
      // Retries may only retain an identical row, never overwrite an existing one.
      await env.DB.prepare(`INSERT INTO ${input.table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT DO NOTHING`).bind(...v).run();
      const row=await env.DB.prepare(`SELECT ${columns.join(',')} FROM ${input.table} WHERE ${columns[0]}=?${input.table==='tournament_owner_sessions'?' AND session_hash=?':''}`).bind(...v.slice(0,input.table==='tournaments'?1:2)).first();
      const stored=columns.map(c=>row[c]);
      if(JSON.stringify(stored)!==JSON.stringify(v))return migrationReply({error:'Conflicting existing row'},409);
      return migrationReply({hashes:await Promise.all(stored.map(migrationHash))});
    }
    return migrationReply({error:'Not found'},404);
  }catch{return migrationReply({error:'Migration operation failed'},500);}
}
