import {randomCapability,managementDigest,ownerCookie,ownerSession,newOwnerSession,canManage,bindSession,validManagementKey,ownerTournament,spectatorTournament} from './access.mjs';
import {createTournament,applyAction,DomainError,groupSizes,roundComplete,gameResult,finalPlaceLimit} from './domain.mjs';
import {assets} from './assets.mjs';
export const json=(data,status=200,extraHeaders={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...extraHeaders}});
const bad=message=>{throw new DomainError(message);};
export function validateBackup(input) {
  const t=input?.tournament;
  if(input?.format!=='svoyak-v1'||!t||typeof t!=='object')bad('Неверный формат резервной копии.');
  const fresh=createTournament({id:crypto.randomUUID(),name:t.name,date:t.date,location:t.location,scoreDivisor:t.scoreDivisor});
  if(!Array.isArray(t.players)||t.players.length>120)bad('Некорректный список участников.');
  const normalized=[];const ids=new Set(),seeds=new Set();
  fresh.players=t.players.map(p=>{
    if(!p||typeof p.id!=='string'||!/^p\d+$/.test(p.id)||ids.has(p.id)||!Number.isInteger(p.seed)||p.seed<1||p.seed>10000||p.id!==`p${p.seed}`||seeds.has(p.seed)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100)bad('Некорректные данные участника.');
    ids.add(p.id);seeds.add(p.seed);const name=p.name.trim().replace(/\s+/g,' ');const norm=name.normalize('NFKC').toLocaleLowerCase('ru');if(normalized.includes(norm))bad('В копии повторяются имена.');normalized.push(norm);if(p.active!==undefined&&typeof p.active!=='boolean')bad('Некорректный статус участника.');return {id:p.id,seed:p.seed,name,...(p.active===undefined?{}:{active:p.active})};
  });
  if(fresh.players.filter(p=>p.active!==false).length>40)bad('В активном составе может быть не больше 40 игроков.');
  if(!Array.isArray(t.rounds)||t.rounds.length>3)bad('В копии может быть только три круга.');
  fresh.rounds=t.rounds.map((r,i)=>{
    const explicit=r?.roster!==undefined,roster=explicit?r.roster:fresh.players.map(p=>p.id);
    if(!Array.isArray(roster)||roster.length<3||roster.length>40||new Set(roster).size!==roster.length||roster.some(id=>!ids.has(id)))bad('Некорректный состав круга.');
    const sizes=groupSizes(roster.length),rosterIds=new Set(roster);
    if(r?.number!==i+1||!Array.isArray(r.games)||!r.games.length||(!explicit&&r.games.length!==sizes.length))bad('Некорректная сетка круга.');
    const seen=new Set(),gameIds=new Set();
    const games=r.games.map((g,j)=>{
      if(typeof g?.id!=='string'||!(new RegExp('^r'+(i+1)+'g[1-9]\\d{0,3}$')).test(g.id)||gameIds.has(g.id)||(!explicit&&g.id!==`r${i+1}g${j+1}`)||!Array.isArray(g.players)||![3,4].includes(g.players.length)||(!explicit&&g.players.length!==sizes[j]))bad('Некорректный бой.');gameIds.add(g.id);
      for(const id of g.players){if(!rosterIds.has(id)||seen.has(id))bad('Игрок пропущен или встречается в круге дважды.');seen.add(id);}
      if(g.scores!==null&&(!Array.isArray(g.scores)||g.scores.length!==g.players.length||g.scores.some(s=>!Number.isInteger(s)||Math.abs(s)>99999999)))bad('Некорректные результаты боя.');
      return {id:g.id,players:[...g.players],scores:g.scores?[...g.scores]:null};
    });
    if(seen.size!==rosterIds.size)bad('Не все участники включены в круг.');
    return {number:i+1,randomSeed:i===0&&Number.isInteger(r.randomSeed)?r.randomSeed:null,...(explicit?{roster:[...roster]}:{}),games};
  });
  for(let i=0;i<fresh.rounds.length-1;i++)if(!roundComplete(fresh.rounds[i]))bad('Последующий круг не может существовать без завершения предыдущего.');
  if(!Array.isArray(t.finals)||t.finals.length>2)bad('Некорректные финалы.');
  if(t.finals.length&&(fresh.rounds.length!==3||!fresh.rounds.every(roundComplete)))bad('Для финалов нужны три завершённых круга.');
  const finalistIds=new Set(),flexible=t.finals.some(g=>g?.positionOffset!==undefined);let finalOffset=0;
  fresh.finals=t.finals.map((g,i)=>{
    if(g?.id!==`f${i}`||!Array.isArray(g.players)||g.players.length<1||g.players.length>(flexible?40:4))bad('Некорректный состав финала.');
    if(flexible&&g.positionOffset!==finalOffset)bad('Некорректный порядок мест финалов.');finalOffset+=g.players.length;if(finalOffset>40)bad('В финалах может участвовать не больше 40 игроков.');
    for(const id of g.players){if(!ids.has(id)||finalistIds.has(id))bad('Некорректный участник финала.');finalistIds.add(id);}
    if(g.scores!==null&&(!Array.isArray(g.scores)||g.scores.length!==g.players.length||g.scores.some(s=>!Number.isInteger(s)||Math.abs(s)>99999999)))bad('Некорректный счёт финала.');
    if(g.places!==null&&(!Array.isArray(g.places)||g.places.length!==g.players.length||g.places.some(p=>!Number.isInteger(p)||p<1||p>finalPlaceLimit(g))||!g.scores))bad('Некорректные места финала.');
    return {id:g.id,players:[...g.players],...(flexible?{positionOffset:g.positionOffset}:{}),scores:g.scores?[...g.scores]:null,places:g.places?[...g.places]:null};
  });
  fresh.finished=t.finished===true;fresh.archived=t.archived===true;
  if(fresh.finished&&(!fresh.finals.length||fresh.finals.some(g=>!g.places)))bad('Завершённый турнир должен иметь результаты финалов.');
  // Do not trust executable or extra object properties from imported files.
  if(!Array.isArray(t.history)||t.history.length>10000)bad('Слишком большая или некорректная история.');
  const validTypes=new Set(['register','amendRoster','reshuffle','rename','remove','draw','results','swap','rollback','finals','finalResults','finish','reopen','archive','settings']);
  fresh.history=t.history.map(h=>{
    if(!h||!validTypes.has(h.type)||typeof h.at!=='string'||!Number.isFinite(Date.parse(h.at))||!h.details||typeof h.details!=='object'||h.details.type!==h.type)bad('Повреждён журнал изменений.');
    const d=h.details;
    if(h.type==='register'&&(!Array.isArray(d.names)||d.names.some(n=>typeof n!=='string'||n.length>100)))bad('Повреждён журнал регистрации.');
    if(['results','finalResults'].includes(h.type)&&(!Array.isArray(d.scores)||d.scores.some(s=>!['number','string'].includes(typeof s))))bad('Повреждён журнал результатов.');
    if(h.type==='finalResults'&&(!Array.isArray(d.places)||d.places.some(p=>!Number.isInteger(p))))bad('Повреждён журнал финалов.');
    return {at:h.at,type:h.type,details:JSON.parse(JSON.stringify(d))};
  });
  fresh.history.push({at:new Date().toISOString(),type:'settings',details:{type:'settings',restored:true}});
  return fresh;
}
function requireSameOrigin(request,url){const origin=request.headers.get('Origin');return origin===url.origin||(!origin&&request.headers.get('Sec-Fetch-Site')!=='cross-site');}
function ownershipFields(value){return value&&typeof value==='object'&&['owner','ownerId','owner_id','creator','createdBy','management_key_hash','session_hash'].some(key=>Object.hasOwn(value,key));}
export async function handleApi(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(!env.DB)return json({error:'Хранилище турниров не подключено. Повторите попытку позже.'},503);
 if(!['GET','POST'].includes(request.method))return json({error:'Метод не поддерживается.'},405);
 const session=await ownerSession(request,env);
 if(request.method==='GET'&&path==='/api/session')return json({hasOwnerSession:Boolean(session)});
 if(request.method==='GET'&&path==='/api/tournaments'){
  if(!session)return json([]);
  const {results}=await env.DB.prepare('SELECT t.payload FROM tournaments t JOIN tournament_owner_sessions s ON s.tournament_id=t.id WHERE s.session_hash=? AND s.expires_at>? ORDER BY t.updated_at DESC').bind(session.hash,Date.now()).all();
  return json(results.map(row=>ownerTournament(JSON.parse(row.payload))));
 }
 const match=path.match(/^\/api\/tournaments\/([a-zA-Z0-9-]{1,100})(?:\/(backup|recover|management-link|delete))?$/);
 let row,owned=false;
 if(match){row=await env.DB.prepare('SELECT payload,revision,management_key_hash FROM tournaments WHERE id=?').bind(match[1]).first();if(!row||!row.management_key_hash)return json({error:'Турнир недоступен по этой ссылке.'},404);owned=await canManage(env,match[1],session);}
 if(request.method==='GET'&&match){
  const t=JSON.parse(row.payload);
  if(match[2]==='backup'){if(!owned)return json({error:'Резервная копия доступна только владельцу этого турнира.'},session?403:401);return json({format:'svoyak-v1',tournament:t},200,{'Content-Disposition':'attachment; filename="svoyak-backup.json"'});}
  if(match[2])return json({error:'Метод не поддерживается.'},405);
  if(!owned&&t.archived)return json({error:'Турнир недоступен по этой ссылке.'},404);
  return json(owned?ownerTournament(t):spectatorTournament(t));
 }
 if(request.method!=='POST')return json({error:'Страница не найдена.'},404);
 if(!requireSameOrigin(request,url))return json({error:'Запрос отклонён: другой источник.'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Ожидается JSON.'},415);
 // Before parsing mutable payloads, protect every existing-tournament operation.
 if(match&&!['recover'].includes(match[2])&&!owned)return json({error:'Изменения доступны только владельцу этого турнира.'},session?403:401);
 const content=await request.text();if(content.length>2_000_000)return json({error:'Слишком большой запрос.'},413);
 let body;try{body=JSON.parse(content);}catch{return json({error:'Некорректный JSON.'},400);}if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Ожидается объект запроса.'},400);
 if(ownershipFields(body)||ownershipFields(body?.action)||ownershipFields(body?.tournament))return json({error:'Доступ определяется защищённой сессией, а не полями запроса.'},400);
 if(match?.[2]==='recover'){
  if(!await validManagementKey(row,match[1],body.key))return json({error:'Приватная ссылка управления недействительна.'},403);
  const next=session??await newOwnerSession();await bindSession(env,match[1],next).run();
  return json(ownerTournament(JSON.parse(row.payload)),200,{'Set-Cookie':ownerCookie(next.token,env)});
 }
 if(path==='/api/tournaments'||path==='/api/restore'){
  if(path==='/api/restore'){
   const sourceId=body?.tournament?.id;
   if(typeof sourceId!=='string'||!await canManage(env,sourceId,session))return json({error:'Восстановить копию может только владелец исходного турнира.'},session?403:401);
  }
  const t=path==='/api/restore'?validateBackup(body):createTournament({...body,id:crypto.randomUUID(),demo:false});
  const next=session??await newOwnerSession(),managementKey=randomCapability(),keyHash=await managementDigest(t.id,managementKey);
  await env.DB.batch([env.DB.prepare('INSERT INTO tournaments (id,payload,revision,updated_at,management_key_hash) VALUES (?,?,?,?,?)').bind(t.id,JSON.stringify(t),t.revision,new Date().toISOString(),keyHash),bindSession(env,t.id,next)]);
  return json({tournament:ownerTournament(t),managementKey},201,{'Set-Cookie':ownerCookie(next.token,env)});
 }
 if(match?.[2]==='management-link'){
  const managementKey=randomCapability(),keyHash=await managementDigest(match[1],managementKey);
  await env.DB.batch([env.DB.prepare('UPDATE tournaments SET management_key_hash=? WHERE id=?').bind(keyHash,match[1]),env.DB.prepare('DELETE FROM tournament_owner_sessions WHERE tournament_id=?').bind(match[1]),bindSession(env,match[1],session)]);
  return json({managementKey},200,{'Set-Cookie':ownerCookie(session.token,env)});
 }
 if(match?.[2]==='delete'){
  if(body.confirm!==true)return json({error:'Подтвердите удаление турнира.'},400);
  if(!Number.isInteger(body.revision)||body.revision!==row.revision)return json({error:'Турнир изменён в другой вкладке. Проверьте его перед удалением.'},409);
  // Remove dependent grants first for foreign-key safety. Both statements share
  // one transaction and the same revision condition, so a concurrent edit keeps
  // the tournament and every owner binding intact.
  const results=await env.DB.batch([
   env.DB.prepare('DELETE FROM tournament_owner_sessions WHERE tournament_id=? AND EXISTS (SELECT 1 FROM tournaments WHERE id=? AND revision=?)').bind(match[1],match[1],body.revision),
   env.DB.prepare('DELETE FROM tournaments WHERE id=? AND revision=?').bind(match[1],body.revision)
  ]);
  if(results[1].meta.changes!==1)return json({error:'Турнир изменён в другой вкладке. Проверьте его перед удалением.'},409);
  return json({deleted:true,id:match[1]});
 }
 if(match&&!match[2]){
  if(!Number.isInteger(body.revision)||body.revision!==row.revision)return json({error:'Турнир изменён в другой вкладке.'},409);
  if(!body.action||typeof body.action.type!=='string')bad('Некорректное действие.');
  const actionFields={register:['names'],amendRoster:['names','removeIds','restoreIds','scope','confirm'],rename:['id','name'],remove:['id'],draw:[],reshuffle:['round','confirm'],results:['round','game','scores','confirm','resetFollowing'],swap:['a','b','round','confirm'],rollback:['keep','confirm'],finals:['groups'],finalResults:['game','scores','places','confirm'],finish:[],reopen:[],archive:[],settings:['name','date','location','scoreDivisor','confirm']};const fields=actionFields[body.action.type];if(!fields)bad('Неизвестное действие.');const action=Object.fromEntries(['type',...fields].filter(key=>Object.hasOwn(body.action,key)).map(key=>[key,body.action[key]]));
  const t=applyAction(JSON.parse(row.payload),action,crypto.getRandomValues(new Uint32Array(1))[0]);
  const result=await env.DB.prepare('UPDATE tournaments SET payload=?,revision=?,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(t),t.revision,new Date().toISOString(),t.id,row.revision).run();
  if(result.meta.changes!==1)return json({error:'Турнир изменён в другой вкладке.'},409);
  return json(ownerTournament(t));
 }
 return json({error:'Страница не найдена.'},404);
}
export default {async fetch(request,env){try{
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return await handleApi(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const privateDocument=url.pathname==='/README.md'||url.pathname.startsWith('/docs/');
 if(privateDocument){const session=await ownerSession(request,env);if(!session)return json({error:'Документация доступна в браузере с доступом к управлению турниром.'},401);}
 const asset=assets[/^\/t\/[a-zA-Z0-9-]{1,100}$/.test(url.pathname)?'/':url.pathname];if(!asset)return new Response('Страница не найдена',{status:404});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':privateDocument?'private, no-store':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'",'Referrer-Policy':'no-referrer'}});
 }catch(error){if(error instanceof DomainError)return json({error:error.message},400);console.error('Tournament operation failed',error?.name);return json({error:'Не удалось выполнить операцию. Данные не изменены; повторите попытку.'},500);}}};
