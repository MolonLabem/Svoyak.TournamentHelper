import {standings,gameResult,roundComplete,scoringDivisor,finalPositionOffset} from './domain.mjs';

const decimal=(value,digits=2)=>Number(value).toLocaleString('ru-RU',{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:false});
export const pointsText=value=>value==null?'—':decimal(value/10000);
export const scoreText=value=>value==null?'—':Number(value/100).toLocaleString('ru-RU',{maximumFractionDigits:2,useGrouping:false});
export const placeText=value=>value==null?'—':Number(value).toLocaleString('ru-RU',{maximumFractionDigits:1,useGrouping:false});
const normalized=t=>({...t,players:t.players.map((p,i)=>({...p,seed:p.seed??i+1}))});

// Recompute historical snapshots from the saved games, never from today's final order.
// Registry order preserves the workbook's tie order in the public projection too.
export function swissRows(t,before=t.rounds.length){
  const rounds=t.rounds.slice(0,before),seen=new Set(rounds.flatMap(r=>[...r.games.flatMap(g=>g.players),...(r.missed??[])]));
  const base=normalized(t);
  return standings({...base,players:base.players.filter(p=>!rounds.length||seen.has(p.id)),rounds,finals:[]});
}
export const finalRows=t=>[...(t.standings??standings(normalized(t)))];
export function resultStages(t){
  const stages=t.rounds.map((r,i)=>({value:String(r.number),label:`После круга ${r.number}`,ready:t.rounds.slice(0,i+1).every(roundComplete)}));
  if(t.finals.length)stages.push({value:'finals',label:'Финалы и швейцарка',ready:t.rounds.length===3&&t.rounds.every(roundComplete)&&t.finals.every(g=>g.scores&&g.places)});
  return stages;
}
const column=(label,width,align='left')=>({label,width,align});
const swissColumns=[column('Место',100),column('Игрок',440),column('Круг 1',125,'right'),column('Круг 2',125,'right'),column('Круг 3',125,'right'),column('Итого',125,'right')];
function swissSection(t,n){return {title:`Швейцарка · после круга ${n}`,columns:swissColumns,rows:swissRows(t,n).map(p=>[p.rank,p.name,...[0,1,2].map(i=>i<n?(p.missed?.[i]?'Пропуск':pointsText(p.rounds[i])):'—'),pointsText(p.total)])};}

// An explicit allowlist: venue, audit, revisions, private links and cookies never enter a card.
export function resultCard(t,stage){
  const selected=resultStages(t).find(s=>s.value===String(stage));
  if(!selected?.ready)throw Error('Сначала сохраните результаты всех боёв этого этапа.');
  const sections=[];
  if(stage==='finals'){
    const scores=new Map(t.finals.flatMap((g,i)=>g.players.map((id,j)=>[id,{score:g.scores[j],place:g.places[j]+finalPositionOffset(t.finals,i),label:i?'МФ':'ГФ'}])));
    sections.push({title:'Итоговые места',columns:[column('Место',100),column('Игрок',510),column('Финал',100),column('Счёт',170,'right'),column('Швейц. очки',160,'right')],rows:finalRows(t).map(p=>{const f=scores.get(p.id);return [placeText(f?.place),p.name,f?.label??'—',scoreText(f?.score),pointsText(p.total)];})});
    sections.push(swissSection(t,3));
  }else{
    const n=Number(stage),round=t.rounds.find(r=>r.number===n),names=new Map(t.players.map(p=>[p.id,p.name]));
    for(const [i,g]of round.games.entries()){
      const result=gameResult(g,scoringDivisor(t));
      sections.push({title:`Круг ${n} · бой ${i+1}`,columns:[column('Игрок',580),column('Счёт',180,'right'),column('Место',140,'right'),column('Очки',140,'right')],rows:g.players.map((id,j)=>[names.get(id)??'Игрок',scoreText(g.scores[j]),placeText(result[j].place),pointsText(result[j].points)]),note:g.chairs?`Пустых мест: ${g.chairs}. Без счёта и очков.`:''});
    }
    if(round.missed?.length)sections.push({title:'Вынужденный пропуск боя',columns:[column('Игрок',1040)],rows:round.missed.map(id=>[names.get(id)??'Игрок']),note:'Без счёта и очков за этот круг.'});
    sections.push(swissSection(t,n));
  }
  return {name:String(t.name),date:String(t.date||''),stage:selected.label,divisor:scoringDivisor(t),sections,filename:`svoyak-${t.date||'results'}-${stage==='finals'?'finals':'round-'+stage}`};
}
