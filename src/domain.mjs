// Independently implemented from observed workbook behavior. No VBA copied.
export class DomainError extends Error {}
const fail = message => { throw new DomainError(message); };
export const clone = value => structuredClone(value);
export function groupSizes(n) {
  if (!Number.isInteger(n) || n < 3 || n > 40 || n === 5) fail('Нужно от 3 до 40 игроков. Для 5 игроков невозможно составить бои по 3–4 человека.');
  const threes = [0,3,2,1][n % 4];
  const fours = (n - 3 * threes) / 4;
  return [...Array(fours).fill(4), ...Array(threes).fill(3)];
}
export function scoreValue(value) {
  const text = String(value).trim().replace(',', '.');
  if (!/^-?\d{1,6}(\.\d{1,2})?$/.test(text)) fail('Счёт должен быть числом от −999999,99 до 999999,99, максимум два знака после запятой.');
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  return (Number(whole) * 100 + Number(fraction.padEnd(2, '0'))) * (negative ? -1 : 1);
}
export function gameResult(game) {
  if (!game.scores || game.scores.length !== game.players.length || game.scores.some(x => !Number.isInteger(x))) return null;
  return game.scores.map(raw => {
    const above = game.scores.filter(x => x > raw).length;
    const equal = game.scores.filter(x => x === raw).length;
    const place = 1 + above + (equal - 1) / 2;
    return {place, points: (4 - place) * 10000 + raw};
  });
}
export const roundComplete = round => Boolean(round?.games.length && round.games.every(g => gameResult(g)));
export function standings(t, before = t.rounds.length) {
  const rows = t.players.map(p => {
    const rounds = t.rounds.slice(0, before).map(r => {
      const g = r.games.find(g => g.players.includes(p.id));
      return g ? gameResult(g)?.[g.players.indexOf(p.id)]?.points ?? null : null;
    });
    const total = rounds.reduce((a,b) => a + (b ?? 0), 0);
    const final = (t.finals ?? []).flatMap((g,i) => g.players.map((id,j) => ({id, place: g.places?.[j] ? g.places[j] + i * 4 : null}))).find(f => f.id === p.id)?.place ?? null;
    return {...p, rounds, total, final, key: total * 100 - p.seed + (final ? (9 - final) * 1000000000 : 0)};
  });
  const swiss = [...rows].sort((a,b) => b.total - a.total || a.seed - b.seed);
  rows.forEach(p => {
    const first = swiss.findIndex(r => r.total === p.total) + 1;
    const last = first + swiss.filter(r => r.total === p.total).length - 1;
    p.rank = first === last ? String(first) : `${first}–${last}`;
  });
  return rows.sort((a,b) => b.key - a.key || a.seed - b.seed);
}
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let r = Math.imul(seed ^ seed >>> 15, 1 | seed); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
export function pair(t, randomSeed = 1) {
  const sizes = groupSizes(t.players.length);
  const n = t.rounds.length;
  if (n >= 3) fail('Три круга уже сыграны. Перейдите к финалам.');
  if (n && !roundComplete(t.rounds.at(-1))) fail('Сначала внесите результаты всех боёв текущего круга.');
  let remaining = t.players.map(p => p.id);
  const groups = [];
  if (!n) {
    const random = rng(randomSeed);
    for (let i = remaining.length - 1; i > 0; i--) { const j = Math.floor(random() * (i+1)); [remaining[i],remaining[j]] = [remaining[j],remaining[i]]; }
    for (const size of sizes) groups.push(remaining.splice(0, size));
  } else {
    const rows = standings(t, n);
    const adjusted = id => { const p = rows.find(p => p.id === id); return p.total * 100 - p.seed; };
    const penalty = (a,b) => t.rounds.reduce((sum,r,i) => sum + (r.games.some(g => g.players.includes(a) && g.players.includes(b)) ? (i + 1) * 1000000000 : 0),0);
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
  return {number: n+1, randomSeed: n ? null : randomSeed, games: groups.map((players,i) => ({id:`r${n+1}g${i+1}`,players,scores:null}))};
}
function cleanName(s) {
  if (typeof s !== 'string') fail('Введите имя.');
  const name = s.trim().replace(/\s+/g,' ');
  if (!name || name.length > 100) fail('Имя должно содержать от 1 до 100 символов.');
  return name;
}
const norm = s => s.normalize('NFKC').toLocaleLowerCase('ru');
export function createTournament({id, name, date = '', location = '', demo = false}) {
  const title = cleanName(name);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('Проверьте дату турнира.');
  return {id,name:title,date,location:String(location).slice(0,150),players:[],rounds:[],finals:[],history:[],archived:false,finished:false,demo,revision:0};
}
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
      if (t.players.length + names.length > 40) fail('Максимум 40 игроков.');
      const all = [...t.players.map(p=>norm(p.name)),...names.map(norm)];
      if (new Set(all).size !== all.length) fail('Имена игроков должны быть уникальными. Ничего не добавлено.');
      let seed = t.players.reduce((max,p)=>Math.max(max,p.seed),0);
      names.forEach(name => { seed++; t.players.push({id:`p${seed}`,seed,name}); });
      break;
    }
    case 'rename': {
      const p = t.players.find(p=>p.id===action.id); if (!p) fail('Игрок не найден.');
      const name = cleanName(action.name);
      if (t.players.some(q=>q.id!==p.id && norm(q.name)===norm(name))) fail('Такое имя уже есть.');
      p.name = name; break;
    }
    case 'remove': rosterOpen(); t.players=t.players.filter(p=>p.id!==action.id); break;
    case 'draw': t.rounds.push(pair(t, randomSeed)); eventDetails.generatedRound=clone(t.rounds.at(-1)); break;
    case 'results': {
      const ri = t.rounds.findIndex(r=>r.number===action.round);
      if (ri < 0) fail('Круг не найден.');
      if (ri !== t.rounds.length-1 || t.finals.length) fail('Уже сформированы следующие игры. Сначала явно отмените последующие круги и финалы.');
      const g=t.rounds[ri].games.find(g=>g.id===action.game);
      if (!g || !Array.isArray(action.scores) || action.scores.length!==g.players.length) fail('Нужен счёт каждого игрока в бою.');
      const scores=action.scores.map(scoreValue);
      if (g.scores && !action.confirm) fail('Подтвердите замену записанного результата.');
      g.scores=scores; break;
    }
    case 'swap': {
      const r=t.rounds.at(-1);
      if (!r || t.finals.length || r.games.some(g=>g.scores)) fail('Менять состав боёв можно только до внесения результатов текущего круга.');
      const flat=r.games.flatMap(g=>g.players); if(action.a===action.b || !flat.includes(action.a)||!flat.includes(action.b)) fail('Выберите двух разных игроков.');
      r.games.forEach(g=>g.players=g.players.map(id=>id===action.a?action.b:id===action.b?action.a:id));break;
    }
    case 'rollback': {
      if (!action.confirm || !Number.isInteger(action.keep) || action.keep<0 || action.keep>t.rounds.length) fail('Подтвердите отмену последующих кругов.');
      eventDetails.discardedRounds=clone(t.rounds.slice(action.keep));eventDetails.discardedFinals=clone(t.finals);
      t.rounds=t.rounds.slice(0,action.keep);t.finals=[];t.finished=false;break;
    }
    case 'finals': {
      if(t.rounds.length!==3 || !t.rounds.every(roundComplete)) fail('Сначала завершите все три круга.');
      if(t.finals.length) fail('Финалы уже сформированы.');
      if (!Array.isArray(action.groups) || !action.groups[0]?.length || action.groups.length>2) fail('Выберите участников финала.');
      const ids=action.groups.flat();
      if(ids.length!==new Set(ids).size || ids.some(id=>!t.players.some(p=>p.id===id)) || action.groups.some(g=>g.length>4 || g.length<1)) fail('В каждом финале от 1 до 4 уникальных игроков.');
      t.finals=action.groups.map((players,i)=>({id:`f${i}`,players,scores:null,places:null}));break;
    }
    case 'finalResults': {
      const g=t.finals.find(g=>g.id===action.game);if(!g) fail('Финал не найден.');
      if(g.scores && !action.confirm) fail('Подтвердите замену результата финала.');
      if(!Array.isArray(action.scores)||!Array.isArray(action.places)||action.scores.length!==g.players.length||action.places.length!==g.players.length) fail('Заполните счёт и места всех игроков.');
      if(action.places.some(p=>!Number.isInteger(p)||p<1||p>4)) fail('Место в финале — целое число от 1 до 4.');
      g.scores=action.scores.map(scoreValue);g.places=action.places;break;
    }
    case 'finish': if(!t.finals.length||t.finals.some(g=>!g.places)) fail('Заполните результаты финалов.');t.finished=true;break;
    case 'reopen': t.finished=false;break;
    case 'archive': t.archived=!t.archived;break;
    case 'settings': {
      const next=createTournament({id:t.id,name:action.name,date:action.date,location:action.location});
      t.name=next.name;t.date=next.date;t.location=next.location;break;
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
