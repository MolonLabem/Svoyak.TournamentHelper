import {standings,scoringDivisor} from './domain.mjs';

const keyPattern=/^[A-Za-z0-9_-]{43}$/;
const sessionLifetime=365*24*60*60;
export function randomCapability(){const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function managementDigest(id,key){return digest('svoyak-management\0'+id+'\0'+key);}
function equalDigest(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function validCapability(key){return typeof key==='string'&&keyPattern.test(key);}
export function cookieName(env){return env.LOCAL_DEV===true?'svoyak-dev-owner':'__Host-svoyak-owner';}
export function ownerCookie(token,env){return `${cookieName(env)}=${token}; Path=/; Max-Age=${sessionLifetime}; HttpOnly; SameSite=Strict${env.LOCAL_DEV===true?'':'; Secure'}`;}
export async function ownerSession(request,env){
 const values=(request.headers.get('Cookie')??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName(env)+'=')).map(s=>s.slice(cookieName(env).length+1));
 if(values.length!==1||!validCapability(values[0]))return null;
 const hash=await digest('svoyak-session\0'+values[0]);
 const row=await env.DB.prepare('SELECT 1 AS valid FROM tournament_owner_sessions WHERE session_hash=? AND expires_at>? LIMIT 1').bind(hash,Date.now()).first();
 return row?{token:values[0],hash}:null;
}
export async function newOwnerSession(){const token=randomCapability();return {token,hash:await digest('svoyak-session\0'+token)};}
export async function canManage(env,id,session){if(!session)return false;return Boolean(await env.DB.prepare('SELECT 1 AS allowed FROM tournament_owner_sessions WHERE tournament_id=? AND session_hash=? AND expires_at>?').bind(id,session.hash,Date.now()).first());}
export function bindSession(env,id,session){return env.DB.prepare('INSERT INTO tournament_owner_sessions (tournament_id,session_hash,expires_at) VALUES (?,?,?) ON CONFLICT(tournament_id,session_hash) DO UPDATE SET expires_at=excluded.expires_at').bind(id,session.hash,Date.now()+sessionLifetime*1000);}
export async function validManagementKey(row,id,key){return validCapability(key)&&equalDigest(row.management_key_hash,await managementDigest(id,key));}
export const ownerTournament=t=>({...t,canEdit:true});
export function spectatorTournament(t){return {id:t.id,name:t.name,date:t.date,scoreDivisor:scoringDivisor(t),players:t.players.map(({id,name,active})=>({id,name,active:active!==false})),rounds:t.rounds.map(({number,games})=>({number,games:games.map(({id,players,scores})=>({id,players,scores}))})),finals:t.finals.map(({id,players,positionOffset,placesMode,scores,places})=>({id,players,...(positionOffset===undefined?{}:{positionOffset}),...(placesMode==='auto'?{placesMode:'auto'}:{}),scores,places})),finished:t.finished,canEdit:false,standings:standings(t).map(({id,name,active,rounds,total,final,rank})=>({id,name,active:active!==false,rounds,total,final,rank}))};}
