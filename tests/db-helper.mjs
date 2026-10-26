import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../src/worker.mjs';
export function database(path=':memory:',{initialize=true}={}){
 const db=new DatabaseSync(path);
 if(initialize){db.exec(readFileSync(new URL('../drizzle/0000_tournaments.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../drizzle/0001_tournament_ownership.sql',import.meta.url),'utf8'));}
 const adapter={prepare(sql){let values=[];return {bind(...v){values=v;return this;},async first(){return db.prepare(sql).get(...values)??null;},async all(){return {results:db.prepare(sql).all(...values)};},executeSync(){return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}};},async run(){return this.executeSync();}};},async batch(statements){db.exec('BEGIN');try{const values=statements.map(s=>s.executeSync());db.exec('COMMIT');return values;}catch(error){db.exec('ROLLBACK');throw error;}}};
 return {db,env:{DB:adapter}};
}
export class Client{
 constructor(env){this.env=env;this.cookie='';}
 async request(path,body,{method=body?'POST':'GET',origin='http://local',headers={}}={}){
  const response=await worker.fetch(new Request('http://local'+path,{method,headers:{...(this.cookie?{Cookie:this.cookie}:{}),...(body?{'Content-Type':'application/json',Origin:origin}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),this.env);
  const cookie=response.headers.get('Set-Cookie');if(cookie)this.cookie=cookie.split(';')[0];return response;
 }
 async create(name='Тест'){const response=await this.request('/api/tournaments',{name});if(response.status!==201)throw Error('Creation failed with status '+response.status);return response.json();}
}
