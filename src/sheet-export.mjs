import {gameResult} from './domain.mjs';

export function sheetDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Укажите дату турнира перед экспортом.');
 const date=new Date(value+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw Error('Проверьте дату турнира перед экспортом.');
 const [year,month,day]=value.split('-');return `${day}.${month}.${year}`;
}
export function ratingGames(t){
 const games=t.rounds.flatMap((round,ri)=>round.games.map((game,i)=>({game,label:`Бой ${i+1}`,round:round.number??ri+1})));
 for(const [i,game]of (t.finals??[]).entries())games.push({game,label:i===0?'ГФ':'МФ',round:'Финалы'});
 return games;
}
export function ratingRows(t){
 const date=sheetDate(t.date),names=new Map(t.players.map(p=>[p.id,p.name])),rows=[];
 for(const {game,label}of ratingGames(t)){
  if(!gameResult(game)||game.players.length>4)continue;
  rows.push([date,label,'Игрок','Счёт']);
  for(let i=0;i<4;i++)rows.push(i<game.players.length?[date,i+1,names.get(game.players[i])??'',game.scores[i]/100]:[date,'','','']);
  rows.push([date,'','','']);
 }
 return rows;
}
const safeText=value=>String(value??'').replace(/[\t\r\n]+/g,' ').replace(/^([=+@-])/,'\'$1');
export function ratingTSV(t){return ratingRows(t).map(row=>row.map(value=>typeof value==='number'?value.toLocaleString('ru-RU',{useGrouping:false,maximumFractionDigits:2}):safeText(value)).join('\t')).join('\n');}

export const ratingExclusions=t=>ratingGames(t).filter(({game})=>game.players.length>4&&gameResult(game)).map(({label,game})=>({label,players:game.players.length}));
export function gamesCSV(t){
 const names=new Map(t.players.map(p=>[p.id,p.name])),date=t.date?sheetDate(t.date):'',rows=[['Дата','Круг','Бой','Место за столом','Игрок','Счёт','Место в финале','Статус']];
 for(const {game,label,round}of ratingGames(t)){if(!gameResult(game))continue;for(const [i,id]of game.players.entries())rows.push([date,round,label,i+1,names.get(id)??'',game.scores[i]/100,game.places?.[i]??'','Сыгран']);}
 for(const round of t.rounds)for(const id of round.missed??[])rows.push([date,round.number,'','',names.get(id)??'','','','Вынужденно пропустил бой']);
 return '\uFEFF'+rows.map(row=>row.map(value=>'"'+(typeof value==='number'?value.toLocaleString('ru-RU',{useGrouping:false,maximumFractionDigits:2}):safeText(value)).replace(/"/g,'""')+'"').join(';')).join('\r\n');
}
