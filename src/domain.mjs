// Independently implemented from observed workbook behavior. No VBA copied.
export class DomainError extends Error {}
const fail = message => { throw new DomainError(message); };
export const clone = value => structuredClone(value);
export function groupSizes(n) {
  if(n===5)return [3,2];
  if (!Number.isInteger(n) || n < 3 || n > 40) fail('Нужно от 3 до 40 игроков. Пять игроков распределяются в бои 3 + 2.');
  const threes = [0,3,2,1][n % 4];
  const fours = (n - 3 * threes) / 4;
  return [...Array(fours).fill(4), ...Array(threes).fill(3)];
}
export function customGroupSizes(value,count){
 const sizes=typeof value==='string'?(value.trim()?value.trim().split(/\s*\+\s*/).map(n=>/^\d{1,2}$/.test(n)?Number(n):NaN):[]):value;
 if(!Array.isArray(sizes)||sizes.length>20||sizes.some(n=>!Number.isInteger(n)||n<2||n>40)||sizes.reduce((sum,n)=>sum+n,0)!==count)fail(`Укажите размеры боёв через +: от 2 до 40 игроков в бою, сумма — ${count}.`);
 return [...sizes];
}
export function suggestedGroupSizes(count){try{return groupSizes(count);}catch{if(count===0)return [];if(count===2)return [2];return null;}}
export const chairCount=game=>game.chairs??0;
export function validateChairCount(game,count){if(!Number.isInteger(count)||count<0||count>40-game.players.length)fail('В бою может быть не больше 40 мест вместе со стульями.');return count;}
export function scoreValue(value) {
  const text = String(value).trim().replace(',', '.');
  if (!/^-?\d{1,6}(\.\d{1,2})?$/.test(text)) fail('Счёт должен быть числом от −999999,99 до 999999,99, максимум два знака после запятой.');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  return (Number(whole) * 100 + Number(fraction.padEnd(2, '0'))) * (negative ? -1 : 1);
}
export const activePlayers = t => t.players.filter(p=>p.active!==false);
export function scoringDivisor(input=100) {
  const value=input&&typeof input==='object'?input.scoreDivisor:input;
  if(value===undefined)return 100;
  if(!['number','string'].includes(typeof value)||(typeof value==='string'&&!/^\d{1,5}$/.test(value)))fail('Делитель счёта — целое число от 1 до 10000.');
  const n=Number(value);if(!Number.isInteger(n)||n<1||n>10000)fail('Делитель счёта — целое число от 1 до 10000.');return n;
}
export function gameResult(game, divisor=100) {
  if (!game.scores || game.scores.length !== game.players.length || game.scores.some(x => !Number.isInteger(x))) return null;
  const d=scoringDivisor(divisor);
  return game.scores.map(raw => {
    const above = game.scores.filter(x => x > raw).length;
    const equal = game.scores.filter(x => x === raw).length;
    const place = 1 + above + (equal - 1) / 2;
    return {place, points: ((4-place)*d*200+raw*2)*50/d};
  });
}
export const finalPlaces=game=>gameResult(game)?.map(row=>row.place)??null;
export const roundComplete = round => Boolean(round&&(round.games.length||(round.missed?.length??0))&&round.games.every(g=>gameResult(g)));
export const finalPositionOffset=(finals,index)=>Number.isInteger(finals[index]?.positionOffset)?finals[index].positionOffset:index*4;
export const finalPlaceLimit=g=>g.placesMode==='auto'||g.positionOffset!==undefined?g.players.length:Math.max(4,g.players.length);
export function standings(t, before = t.rounds.length) {
  const d=scoringDivisor(t),finalBonusBase=Math.max(9,...(t.finals??[]).map((g,i)=>finalPositionOffset(t.finals,i)+g.players.length+1));
  const rows = t.players.map(p => {
    const numerators=t.rounds.slice(0,before).map(r=>{const g=r.games.find(g=>g.players.includes(p.id));if(!g)return null;const result=gameResult(g,d),i=g.players.indexOf(p.id);return result?(4-result[i].place)*d*200+g.scores[i]*2:null;});
    const scoreNumerator=numerators.reduce((sum,n)=>sum+(n??0),0),rounds=numerators.map(n=>n==null?null:n*50/d),total=scoreNumerator*50/d;
    const final=(t.finals??[]).flatMap((g,i)=>g.players.map((id,j)=>({id,place:g.places?.[j]?g.places[j]+finalPositionOffset(t.finals,i):null}))).find(f=>f.id===p.id)?.place??null;
    // Common integer numerator keeps ties, seed epsilon and pairing exact for any divisor.
    const pairKey=scoreNumerator*5000-p.seed*d,sortKey=pairKey+(final?(finalBonusBase-final)*1000000000*d:0);
    const missed=t.rounds.slice(0,before).map(r=>r.missed?.includes(p.id)??false);
    return {...p,rounds,missed,total,final,scoreNumerator,pairKey,sortKey,key:sortKey/d};
  });
  const swiss=[...rows].sort((a,b)=>b.scoreNumerator-a.scoreNumerator||a.seed-b.seed);
  for(const p of rows){const first=swiss.findIndex(r=>r.scoreNumerator===p.scoreNumerator)+1,last=first+swiss.filter(r=>r.scoreNumerator===p.scoreNumerator).length-1;p.rank=first===last?String(first):`${first}–${last}`;}
  return rows.sort((a,b)=>b.sortKey-a.sortKey||a.seed-b.seed);
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let r = Math.imul(seed ^ seed >>> 15, 1 | seed); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
function allocateRound(t, randomSeed = 1, retainedSizes = null) {
  const sizes = retainedSizes??groupSizes(activePlayers(t).length);
  const n = t.rounds.length;
  if (n >= 3) fail('Три круга уже сыграны. Перейдите к финалам.');
  if (n && !roundComplete(t.rounds.at(-1))) fail('Сначала внесите результаты всех боёв текущего круга.');
  let remaining = activePlayers(t).map(p => p.id);
  const groups = [];
  if (!n) {
    const random = rng(randomSeed);
    for (let i = remaining.length - 1; i > 0; i--) { const j = Math.floor(random() * (i+1)); [remaining[i],remaining[j]] = [remaining[j],remaining[i]]; }
    for (const size of sizes) groups.push(remaining.splice(0, size));
  } else {
    const rows = standings(t, n);
    const adjusted = id => rows.find(p=>p.id===id).pairKey;
    const penalty = (a,b) => t.rounds.reduce((sum,r,i) => sum + (r.games.some(g => g.players.includes(a) && g.players.includes(b)) ? (i + 1) * 1000000000 * scoringDivisor(t) : 0),0);
    const distance = (a,b) => Math.abs(adjusted(a) - adjusted(b)) + penalty(a,b);
    for (const size of sizes) {
      remaining.sort((a,b) => adjusted(b) - adjusted(a));
      const group = [remaining.shift()];
      while (group.length < size) {
        // Excel MATCH chooses the first registration row on equal distance.
        remaining.sort((a,b) => group.reduce((s,id) => s + distance(a,id) - distance(b,id),0) || t.players.find(p=>p.id===a).seed - t.players.find(p=>p.id===b).seed);
        group.push(remaining.shift());
      }
      groups.push(group);
    }
  }
  return {...(sizes.some(n=>![3,4].includes(n))?{customGroups:true}:{}),number: n+1, randomSeed: n ? null : randomSeed, roster:activePlayers(t).map(p=>p.id), games: groups.map((players,i) => ({id:`r${n+1}g${i+1}`,players,scores:null}))};
}
export function pair(t,randomSeed=1,sizes=null){const count=activePlayers(t).length;if(sizes!==null&&(count<2||count>40))fail('Для жеребьёвки нужно от 2 до 40 игроков.');return allocateRound(t,randomSeed,sizes===null?null:customGroupSizes(sizes,count));}
function cleanName(s) {
  if (typeof s !== 'string') fail('Введите имя.');
  const name = s.trim().replace(/\s+/g,' ');
  if (!name || name.length > 100) fail('Имя должно содержать от 1 до 100 символов.');
  return name;
}
const norm = s => s.normalize('NFKC').toLocaleLowerCase('ru');
export function createTournament({id, name, date = '', location = '', demo = false, scoreDivisor = 100}) {
  const title = cleanName(name);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Проверьте дату турнира.');
  return {id,name:title,date,scoreDivisor:scoringDivisor(scoreDivisor),location:String(location).slice(0,150),players:[],rounds:[],finals:[],history:[],archived:false,finished:false,demo,revision:0};
}
export function swapImpact(t,{a,b,round=t.rounds.length}) {
  const r=t.rounds.find(r=>r.number===Number(round));if(!r)fail('Круг не найден.');
  const ga=r.games.find(g=>g.players.includes(a)),gb=r.games.find(g=>g.players.includes(b));
  if(a===b||!ga||!gb)fail('Выберите двух разных игроков.');
  const games=[...new Set([ga,gb])];return {round:r.number,games:games.map(g=>g.id),savedGames:games.filter(g=>g.scores).length,followingRounds:t.rounds.filter(q=>q.number>r.number).map(q=>q.number),finals:t.finals.length};
}
export function correctionImpact(t,round){const r=t.rounds.find(r=>r.number===Number(round));if(!r)fail('Круг не найден.');return {round:r.number,followingRounds:t.rounds.filter(q=>q.number>r.number).map(q=>q.number),finals:t.finals.length};}
export function reshuffleImpact(t,round=1) {
  const r=t.rounds.find(r=>r.number===Number(round));if(!r)fail('Круг не найден.');
  return {round:r.number,mode:r.number===1?'random':'swiss',unchanged:!r.games.length||(r.number!==1&&sameGroups(r,regeneratedSwissRound(t,r))),savedGames:r.games.filter(g=>g.scores).length,followingRounds:t.rounds.filter(q=>q.number>r.number).map(q=>q.number),finals:t.finals.length};
}
const groupSignature=groups=>groups.map(ids=>[...ids].sort().join(',')).sort().join('|');
const sameGroups=(a,b)=>groupSignature(a.games.map(g=>g.players))===groupSignature(b.games.map(g=>g.players));
function regeneratedSwissRound(t,r) {
  const roster=r.roster??[...new Set(r.games.flatMap(g=>g.players))],ids=new Set(roster.filter(id=>!r.missed?.includes(id)));
  const draft={...t,players:t.players.filter(p=>ids.has(p.id)).map(p=>({...p,active:true})),rounds:t.rounds.filter(q=>q.number<r.number),finals:[]};
  const generated=allocateRound(draft,1,r.games.map(g=>g.players.length));
  return {...r,randomSeed:null,roster:[...roster],games:r.games.map((g,i)=>({...g,players:generated.games[i].players,scores:null}))};
}
function reshuffledRound(r,randomSeed) {
  const original=r.games.flatMap(g=>g.players),random=rng(randomSeed),sizes=r.games.map(g=>g.players.length);
  let order;
  const previous=groupSignature(r.games.map(g=>g.players));
  const changed=ids=>{if(r.games.length===1)return ids.some((id,i)=>id!==original[i]);let offset=0;return groupSignature(sizes.map(n=>ids.slice(offset,offset+=n)))!==previous;};
  // A reroll must change the actual groups, rather than only reorder seats.
  for(let attempt=0;attempt<32;attempt++){
    order=[...original];for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    if(changed(order))break;
  }
  if(!changed(order)){order=[...original];const j=sizes.length>1?sizes[0]:1;[order[0],order[j]]=[order[j],order[0]];}
  return {...r,randomSeed,roster:[...(r.roster??original)],games:r.games.map(g=>({...g,players:order.splice(0,g.players.length),scores:null}))};
}
function amendRoster(t,action,randomSeed,planOnly=false) {
 if(t.archived||t.finished)fail('Сначала откройте турнир для редактирования.');
 if(t.finals.length)fail('Сначала отмените финалы в настройках; результаты кругов сохранятся.');
 if(!['current','next'].includes(action.scope))fail('Выберите, с какого момента менять состав.');
 const names=action.names??[],removeIds=action.removeIds??[],restoreIds=action.restoreIds??[];
 if(![names,removeIds,restoreIds].every(Array.isArray))fail('Выберите изменения состава.');
 const hasRosterChange=names.length+removeIds.length+restoreIds.length>0;
 if(!hasRosterChange&&!planOnly&&action.sizes===undefined&&action.missedIds===undefined)fail('Выберите изменения состава или боёв.');
 if(action.scope==='next'&&(action.sizes!==undefined||action.missedIds!==undefined))fail('Размеры боёв и пропуски применяются только к текущему кругу.');
 if(new Set([...removeIds,...restoreIds]).size!==removeIds.length+restoreIds.length)fail('Игрок указан в изменениях дважды.');
 const cleaned=names.map(cleanName);if(new Set(cleaned.map(norm)).size!==cleaned.length)fail('Имена игроков должны быть уникальными.');
 for(const r of t.rounds)r.roster??=[...new Set([...r.games.flatMap(g=>g.players),...(r.missed??[])])];
 for(const id of removeIds){const p=t.players.find(p=>p.id===id);if(!p||p.active===false)fail('Игрок не участвует в текущем составе.');p.active=false;}
 for(const id of restoreIds){const p=t.players.find(p=>p.id===id);if(!p||p.active!==false)fail('Игрок уже участвует или не найден.');p.active=true;}
 let seed=t.players.reduce((max,p)=>Math.max(max,p.seed),0);
 for(const name of cleaned){const previous=t.players.find(p=>norm(p.name)===norm(name));if(previous){if(previous.active!==false)fail('Такое имя уже участвует.');previous.active=true;}else{seed++;t.players.push({id:`p${seed}`,seed,name,active:true});}}
 if(activePlayers(t).length>40)fail('В одном круге может участвовать не больше 40 игроков.');
 if(t.players.length>120)fail('В турнире может быть не больше 120 разных участников за три круга.');
 const r=t.rounds.at(-1);let preservedGames=r?.games.filter(g=>g.scores).length??0,rebuiltGames=0,newSizes=[],pendingCount=0,missedCount=r?.missed?.length??0,chairsRemoved=0,choices=[];
 if(!r&&!hasRosterChange)fail('Сначала начните круг.');
 if(r&&action.scope==='current'){
  const fixed=r.games.filter(g=>g.scores),fixedIds=new Set(fixed.flatMap(g=>g.players)),previousMissed=r.missed??[],missed=action.missedIds??previousMissed;
  if(!Array.isArray(missed)||new Set(missed).size!==missed.length||missed.some(id=>!t.players.some(p=>p.id===id)))fail('Проверьте список пропустивших бой.');
  if(missed.some(id=>fixedIds.has(id)))fail('У этого игрока уже записан результат. Сыгранные бои не изменяются.');
  const waiting=new Set([...r.games.filter(g=>!g.scores).flatMap(g=>g.players),...previousMissed]);
  const eligible=hasRosterChange?activePlayers(t):t.players.filter(p=>waiting.has(p.id));
  const pool=eligible.filter(p=>!fixedIds.has(p.id)&&!missed.includes(p.id));pendingCount=pool.length;missedCount=missed.length;
  if(fixedIds.size+pool.length+missed.length>40)fail('С учётом сыгравших и пропустивших в круге будет больше 40 игроков. Примените изменение со следующего круга.');
  choices=t.players.filter(p=>!fixedIds.has(p.id)&&(eligible.some(q=>q.id===p.id)||missed.includes(p.id))).map(p=>({id:p.id,name:p.name,missed:missed.includes(p.id)}));
  const suggestion=suggestedGroupSizes(pool.length);
  if(planOnly)return {round:r.number,scope:action.scope,preservedGames,pendingCount,missedCount,choices,suggestedSizes:suggestion,activeCount:activePlayers(t).length};
  if(pool.length){if(action.sizes!==undefined)newSizes=customGroupSizes(action.sizes,pool.length);else{try{newSizes=groupSizes(pool.length);}catch{fail(`В несыгранных боях останется ${pool.length} игроков. Выберите размеры боёв вручную, например 3 + 2 для пяти, или примените изменение со следующего круга.`);}}}
  else if(action.sizes!==undefined)customGroupSizes(action.sizes,0);
  if(!pool.length&&!fixed.length&&!missed.length)fail('В круге должны остаться игроки или отметки пропуска.');
  const draft={...t,players:pool.map(p=>({...p,active:true})),rounds:t.rounds.slice(0,-1),finals:[]};
  const generated=pool.length?allocateRound(draft,r.randomSeed??randomSeed,newSizes).games:[],oldPending=r.games.filter(g=>!g.scores);
  let serial=Math.max(0,...r.games.map(g=>Number(g.id.match(/g(\d+)$/)?.[1]??0)));
  generated.forEach((g,i)=>{g.id=oldPending[i]?.id??`r${r.number}g${++serial}`;const count=chairCount(oldPending[i]??{});if(count){validateChairCount(g,count);g.chairs=count;}});chairsRemoved=oldPending.slice(generated.length).reduce((sum,g)=>sum+chairCount(g),0);
  let i=0;rebuiltGames=oldPending.length;r.games=r.games.flatMap(g=>g.scores?[g]:i<generated.length?[generated[i++]]:[]);r.games.push(...generated.slice(i));
  r.roster=[...new Set([...r.games.flatMap(g=>g.players),...missed])];if(missed.length)r.missed=[...missed];else delete r.missed;
  if(r.games.some(g=>![3,4].includes(g.players.length)))r.customGroups=true;
 }
 return {round:r?.number??0,scope:action.scope,preservedGames,rebuiltGames,newSizes,pendingCount,missedCount,chairsRemoved,choices,activeCount:activePlayers(t).length};
}
export function rosterChangePreview(t,action){return amendRoster(clone(t),action,1);}
export function rosterChangeOptions(t,action){return amendRoster(clone(t),action,1,true);}
function resetFollowing(t,round,eventDetails){eventDetails.discardedRounds=clone(t.rounds.filter(r=>r.number>round));eventDetails.discardedFinals=clone(t.finals);t.rounds=t.rounds.filter(r=>r.number<=round);t.finals=[];t.finished=false;}
export function applyAction(original, action, randomSeed = 1) {
  const t = clone(original);
  const eventDetails=clone(action);
  if (t.archived && action.type !== 'archive') fail('Турнир в архиве. Сначала восстановите его.');
  if (t.finished && !['archive','settings','reopen'].includes(action.type)) fail('Турнир завершён. Откройте его для редактирования в настройках.');
  const rosterOpen = () => { if (t.rounds.length) fail('Состав уже зафиксирован. Для изменения состава сначала отмените все круги.'); };
  switch (action.type) {
    case 'register': {
      rosterOpen();
      if (!Array.isArray(action.names) || !action.names.length) fail('Введите имена игроков, по одному в строке.');
      const names = action.names.map(cleanName);
      if (activePlayers(t).length + names.length > 40) fail('Максимум 40 игроков.');
      const all = [...t.players.map(p=>norm(p.name)),...names.map(norm)];
      if (new Set(all).size !== all.length) fail('Имена игроков должны быть уникальными. Ничего не добавлено.');
      let seed = t.players.reduce((max,p)=>Math.max(max,p.seed),0);
      names.forEach(name => { seed++; t.players.push({id:`p${seed}`,seed,name}); });
      break;
    }
    case 'amendRoster': {
      if(action.confirm!==true)fail('Подтвердите изменение состава.');
      eventDetails.previousRound=clone(t.rounds.at(-1)??null);eventDetails.previousPlayers=clone(t.players);const {choices,...impact}=amendRoster(t,action,randomSeed);eventDetails.impact=impact;break;
    }
    case 'rename': {
      const p = t.players.find(p=>p.id===action.id); if (!p) fail('Игрок не найден.');
      const name = cleanName(action.name);
      if (t.players.some(q=>q.id!==p.id && norm(q.name)===norm(name))) fail('Такое имя уже есть.');
      p.name = name; break;
    }
    case 'remove': rosterOpen(); t.players=t.players.filter(p=>p.id!==action.id); break;
    case 'draw': t.rounds.push(pair(t,randomSeed,action.sizes??null)); eventDetails.generatedRound=clone(t.rounds.at(-1)); break;
    case 'reshuffle': {
      const impact=reshuffleImpact(t,action.round);
      if(action.confirm!==true)fail('Подтвердите повторную жеребьёвку и сброс результатов этого круга.');
      const r=t.rounds.find(r=>r.number===impact.round);if(impact.unchanged)return t;
      const generated=r.number===1?reshuffledRound(r,randomSeed):regeneratedSwissRound(t,r);eventDetails.mode=impact.mode;eventDetails.previousRound=clone(r);
      resetFollowing(t,r.number,eventDetails);t.rounds[t.rounds.length-1]=generated;eventDetails.generatedRound=clone(generated);break;
    }
    case 'chairs': {
      const game=[...t.rounds.flatMap(r=>r.games),...t.finals].find(g=>g.id===action.game);if(!game)fail('Бой не найден.');
      const count=validateChairCount(game,action.count),previous=chairCount(game);if(previous===count)return t;
      eventDetails.previousCount=previous;if(count)game.chairs=count;else delete game.chairs;break;
    }
    case 'results': {
      const ri = t.rounds.findIndex(r=>r.number===action.round);
      if (ri < 0) fail('Круг не найден.');
      if ((ri !== t.rounds.length-1 || t.finals.length)&&!(action.confirm===true&&action.resetFollowing===true)) fail('Уже сформированы следующие игры. Подтвердите отмену последующих кругов и финалов при исправлении.');
      const g=t.rounds[ri].games.find(g=>g.id===action.game);
      if (!g || !Array.isArray(action.scores) || action.scores.length!==g.players.length) fail('Нужен счёт каждого игрока в бою.');
      const scores=action.scores.map(scoreValue);
      if (g.scores && !action.confirm) fail('Подтвердите замену записанного результата.');
      eventDetails.previousScores=clone(g.scores);if(ri!==t.rounds.length-1||t.finals.length)resetFollowing(t,action.round,eventDetails);g.scores=scores; break;
    }
    case 'swap': {
      const impact=swapImpact(t,action),r=t.rounds.find(r=>r.number===impact.round);
      if((impact.savedGames||impact.followingRounds.length||impact.finals)&&action.confirm!==true)fail('Подтвердите сброс результатов затронутых боёв и последующих кругов.');
      eventDetails.discardedGames=clone(r.games.filter(g=>impact.games.includes(g.id)));if(impact.followingRounds.length||impact.finals)resetFollowing(t,r.number,eventDetails);
      for(const g of r.games)if(impact.games.includes(g.id)){g.players=g.players.map(id=>id===action.a?action.b:id===action.b?action.a:id);g.scores=null;}break;
    }
    case 'rollback': {
      if (!action.confirm || !Number.isInteger(action.keep) || action.keep<0 || action.keep>t.rounds.length) fail('Подтвердите отмену последующих кругов.');
      eventDetails.discardedRounds=clone(t.rounds.slice(action.keep));eventDetails.discardedFinals=clone(t.finals);
      t.rounds=t.rounds.slice(0,action.keep);t.finals=[];t.finished=false;break;
    }
    case 'finals': {
      if(t.rounds.length!==3 || !t.rounds.every(roundComplete)) fail('Сначала завершите все три круга.');
      if(t.finals.length) fail('Финалы уже сформированы.');
      if (!Array.isArray(action.groups) || !action.groups.length || action.groups.length>2 || !action.groups.every(Array.isArray) || !action.groups[0].length) fail('Выберите участников финала.');
      const ids=action.groups.flat();
      if(ids.length!==new Set(ids).size || ids.some(id=>!activePlayers(t).some(p=>p.id===id)) || ids.length>40 || action.groups.some(g=>g.length>40 || g.length<1)) fail('Выберите от 1 до 40 разных участников из активного состава; игрок может участвовать только в одном финале.');
      let offset=0;t.finals=action.groups.map((players,i)=>{const game={id:`f${i}`,players,positionOffset:offset,placesMode:'auto',scores:null,places:null};offset+=players.length;return game;});break;
    }
    case 'finalResults': {
      const g=t.finals.find(g=>g.id===action.game);if(!g) fail('Финал не найден.');
      if(g.scores && !action.confirm) fail('Подтвердите замену результата финала.');
      if(!Array.isArray(action.scores)||action.scores.length!==g.players.length) fail('Заполните счёт всех игроков финала.');
      const scores=action.scores.map(scoreValue),places=finalPlaces({...g,scores});
      eventDetails.previousScores=clone(g.scores);eventDetails.previousPlaces=clone(g.places);eventDetails.previousPlacesMode=g.placesMode??'manual';eventDetails.places=[...places];eventDetails.placesMode='auto';
      g.scores=scores;g.places=places;g.placesMode='auto';break;
    }
    case 'finish': if(!t.finals.length||t.finals.some(g=>!g.places)) fail('Заполните результаты финалов.');t.finished=true;break;
    case 'reopen': t.finished=false;break;
    case 'archive': t.archived=!t.archived;break;
    case 'settings': {
      const next=createTournament({id:t.id,name:action.name,date:action.date,location:action.location,scoreDivisor:action.scoreDivisor??scoringDivisor(t)});
      if(next.scoreDivisor!==scoringDivisor(t)&&(t.rounds.length>1||t.finals.length)){if(action.confirm!==true)fail('Изменение делителя пересчитает очки. Подтвердите отмену кругов после первого и финалов.');resetFollowing(t,1,eventDetails);}
      eventDetails.previousDivisor=scoringDivisor(t);t.name=next.name;t.date=next.date;t.location=next.location;t.scoreDivisor=next.scoreDivisor;break;
    }
    default: fail('Неизвестное действие.');
  }
  t.history.push({at:new Date().toISOString(),type:action.type,details:eventDetails});
  t.revision++;
  return t;
}
export function demoTournament() {
  let t=createTournament({id:'demo',name:'Осенний турнир',date:'2026-10-31',location:'Клуб интеллектуальных игр',demo:true});
  t=applyAction(t,{type:'register',names:['Александр Волков','Мария Соколова','Дмитрий Орлов','Елена Морозова','Андрей Лебедев','Анна Кузнецова','Сергей Попов','Ольга Новикова','Михаил Петров','Ирина Смирнова','Павел Васильев','Наталья Белова','Иван Фёдоров','Екатерина Зайцева','Алексей Громов','Юлия Мельникова']});
  t=applyAction(t,{type:'draw'},2864);
  for(let i=0;i<4;i++)t=applyAction(t,{type:'results',round:1,game:t.rounds[0].games[i].id,scores:[[1200,850,600,350],[1100,750,750,-100],[1450,1050,700,200],[950,800,450,100]][i]});
  t=applyAction(t,{type:'draw'});
  for(let i=0;i<2;i++)t=applyAction(t,{type:'results',round:2,game:t.rounds[1].games[i].id,scores:[[1350,1100,800,550],[1000,1000,650,250]][i]});
  return t;
}
