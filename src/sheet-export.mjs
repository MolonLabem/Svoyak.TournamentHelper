import {gameResult} from './domain.mjs';

export function sheetDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Укажите дату турнира перед экспортом.');
 const date=new Date(value+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw Error('Проверьте дату турнира перед экспортом.');
 const [year,month,day]=value.split('-');return `${day}.${month}.${year}`;
}
export function ratingGames(t){
 const games=t.rounds.flatMap(round=>round.games.map((game,i)=>({game,label:`Бой ${i+1}`})));
 for(const [i,game]of (t.finals??[]).entries())games.push({game,label:i===0?'ГФ':'МФ'});
 return games;
}
export function ratingRows(t){
 const date=sheetDate(t.date),names=new Map(t.players.map(p=>[p.id,p.name])),rows=[];
 for(const {game,label}of ratingGames(t)){
  if(!gameResult(game))continue;
  rows.push([date,label,'Игрок','Счёт']);
  for(let i=0;i<4;i++)rows.push(i<game.players.length?[date,i+1,names.get(game.players[i])??'',game.scores[i]/100]:[date,'','','']);
  rows.push([date,'','','']);
 }
 return rows;
}
const safeText=value=>String(value??'').replace(/[\t\r\n]+/g,' ').replace(/^([=+@-])/,'\'$1');
export function ratingTSV(t){return ratingRows(t).map(row=>row.map(value=>typeof value==='number'?value.toLocaleString('ru-RU',{useGrouping:false,maximumFractionDigits:2}):safeText(value)).join('\t')).join('\n');}
