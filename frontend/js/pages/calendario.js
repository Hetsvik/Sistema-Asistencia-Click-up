import { initPage } from '../layout.js';
import { $, $$ } from '../ui.js';
import { enableMenuKeyboard } from '../page-tools.js';

const iso=d=>d.toISOString().slice(0,10);
const fullDate=d=>new Intl.DateTimeFormat('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(d);
async function main(){
  await initPage({role:document.body.dataset.role,page:'calendario'});
  enableMenuKeyboard();
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const today=`${parts.year}-${parts.month}-${parts.day}`;
  let selected=today,view=new Date(`${today}T00:00:00Z`);
  view.setUTCDate(1);
  const render=()=>{
    const y=view.getUTCFullYear(),m=view.getUTCMonth();
    $('#month-label').textContent=new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'}).format(view);
    const offset=(view.getUTCDay()+6)%7;
    $('#calendar-grid').innerHTML=Array.from({length:42},(_,i)=>{
      const date=new Date(Date.UTC(y,m,1-offset+i)),key=iso(date),isToday=key===today;
      return `<button type="button" class="calendar-day${date.getUTCMonth()!==m?' other-month':''}${isToday?' today':''}" data-date="${key}" aria-label="${fullDate(date)}${isToday?', hoy':''}" aria-pressed="${key===selected}"${isToday?' aria-current="date"':''}>${date.getUTCDate()}</button>`;
    }).join('');
    $('#selected-date').textContent=fullDate(new Date(`${selected}T00:00:00Z`));
    $('#month-prev').disabled=y<=1900 && m===0;
    $('#month-next').disabled=y>=2100 && m===11;
  };
  $('#calendar-grid').addEventListener('click',e=>{
    const b=e.target.closest('[data-date]');if(!b)return;
    selected=b.dataset.date;
    $$('[data-date]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.date===selected)));
    $('#selected-date').textContent=fullDate(new Date(`${selected}T00:00:00Z`));
  });
  $('#calendar-grid').addEventListener('keydown',e=>{
    const delta={ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7}[e.key];
    const current=e.target.closest('[data-date]');if(!delta || !current)return;
    e.preventDefault();const next=new Date(`${current.dataset.date}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+delta);
    if(next.getUTCFullYear()<1900 || next.getUTCFullYear()>2100)return;
    selected=iso(next);view=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth(),1));render();$(`[data-date="${selected}"]`).focus();
  });
  $('#month-prev').onclick=()=>{view.setUTCMonth(view.getUTCMonth()-1);render();};
  $('#month-next').onclick=()=>{view.setUTCMonth(view.getUTCMonth()+1);render();};
  $('#calendar-today').onclick=()=>{selected=today;view=new Date(`${today.slice(0,7)}-01T00:00:00Z`);render();};
  render();
}
main().catch(err=>console.error('Calendario:',err));
