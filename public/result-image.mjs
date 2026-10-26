// Draw only the public result-card model, not a screenshot of the organizer page.
// Fixed light colors keep pasted images readable regardless of app/Telegram theme.
const W=1200,M=60,BOTTOM=64,MAX=3400,FONT='Arial, sans-serif';
const colors={bg:'#ffffff',text:'#202c35',muted:'#52636f',green:'#176a49',pale:'#e3f2e9',line:'#d6dee3',stripe:'#f5f7f8'};
function wrapped(ctx,value,width){
  const lines=[];let line='';
  for(const word of String(value).split(/\s+/)){
    const next=line?line+' '+word:word;
    if(ctx.measureText(next).width<=width){line=next;continue;}
    if(line){lines.push(line);line='';}
    for(const char of Array.from(word)){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;}
  }
  lines.push(line);return lines;
}
export async function renderResultImages(card){
  const measure=document.createElement('canvas').getContext('2d');
  const pages=[];let page,top;
  const start=()=>{if(page)page.height=Math.min(MAX,top+BOTTOM);page={items:[]};pages.push(page);measure.font=`bold 42px ${FONT}`;const title=wrapped(measure,card.name,W-M*2);page.title=title;top=74+title.length*52+66;};
  start();
  for(const section of card.sections){
    const widths=section.columns.map(c=>c.width/1040*(W-M*2));
    const heading=(continuation=false)=>{page.items.push({type:'heading',y:top,title:section.title+(continuation?' · продолжение':''),columns:section.columns,widths});top+=96;};
    measure.font=`24px ${FONT}`;
    const rowLines=section.rows.map(row=>row.map((v,i)=>wrapped(measure,v,widths[i]-28))),heights=rowLines.map(row=>Math.max(...row.map(lines=>lines.length))*31+22);
    if(top+96+(heights[0]??54)+BOTTOM>MAX)start();heading();
    for(let i=0;i<section.rows.length;i++){
      if(top+heights[i]+BOTTOM>MAX){start();heading(true);}
      page.items.push({type:'row',y:top,height:heights[i],lines:rowLines[i],columns:section.columns,widths,stripe:i%2===1});top+=heights[i];
    }
    if(section.note){measure.font=`22px ${FONT}`;const lines=wrapped(measure,section.note,W-M*2);const height=lines.length*28+22;if(top+height+BOTTOM>MAX)start();page.items.push({type:'note',y:top+20,lines});top+=height;}
    top+=28;page.height=Math.min(MAX,top+BOTTOM);
  }
  // A page boundary can occur before a table; every page repeats the event and stage.
  return Promise.all(pages.map(async(p,index)=>{
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=Math.ceil(p.height??MAX);const ctx=canvas.getContext('2d');
    ctx.fillStyle=colors.bg;ctx.fillRect(0,0,W,canvas.height);ctx.fillStyle=colors.green;ctx.fillRect(0,0,W,12);ctx.font=`bold 42px ${FONT}`;ctx.textBaseline='top';ctx.fillStyle=colors.text;
    p.title.forEach((line,i)=>ctx.fillText(line,M,52+i*52));ctx.font=`24px ${FONT}`;ctx.fillStyle=colors.muted;const meta=[card.date&&card.date.split('-').reverse().join('.'),card.stage,`делитель ${card.divisor}`].filter(Boolean).join(' · ');ctx.fillText(meta,M,68+p.title.length*52);
    for(const item of p.items){
      if(item.type==='heading'){
        ctx.font=`bold 28px ${FONT}`;ctx.fillStyle=colors.green;ctx.fillText(item.title,M,item.y);ctx.fillStyle=colors.pale;ctx.fillRect(M,item.y+42,W-M*2,46);ctx.font=`bold 21px ${FONT}`;ctx.fillStyle=colors.green;let x=M;
        item.columns.forEach((c,i)=>{ctx.textAlign=c.align==='right'?'right':'left';ctx.fillText(c.label,c.align==='right'?x+item.widths[i]-14:x+14,item.y+55);x+=item.widths[i];});ctx.textAlign='left';
      }else if(item.type==='row'){
        if(item.stripe){ctx.fillStyle=colors.stripe;ctx.fillRect(M,item.y,W-M*2,item.height);}ctx.fillStyle=colors.line;ctx.fillRect(M,item.y+item.height-1,W-M*2,1);ctx.font=`24px ${FONT}`;ctx.fillStyle=colors.text;let x=M;
        item.lines.forEach((lines,i)=>{const right=item.columns[i].align==='right';ctx.textAlign=right?'right':'left';lines.forEach((line,j)=>ctx.fillText(line,right?x+item.widths[i]-14:x+14,item.y+11+j*31));x+=item.widths[i];});ctx.textAlign='left';
      }else{ctx.font=`22px ${FONT}`;ctx.fillStyle=colors.muted;item.lines.forEach((line,i)=>ctx.fillText(line,M,item.y+i*28));}
    }
    ctx.font=`20px ${FONT}`;ctx.fillStyle=colors.muted;ctx.fillText('Своя игра · сохранённые результаты',M,canvas.height-38);ctx.textAlign='right';ctx.fillText(`${index+1} / ${pages.length}`,W-M,canvas.height-38);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Не удалось создать PNG.')), 'image/png'));
    return {blob,width:W,height:canvas.height};
  }));
}
