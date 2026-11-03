import { $, esc } from './ui.js';
export function to24Hour(hour,period){return Number(hour)%12+(period==='PM'?12:0);}
export function peruToday(){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}`;
}
let instance=0;
export function initDateTimePicker(root,{initialDate=peruToday(),hour=5,minute=0,period='PM',label='Fecha y hora'}={}){
 const id='dt-'+(++instance);let selected=initialDate,view=new Date(selected.slice(0,7)+'-01T00:00:00Z');
 root.innerHTML=`<div class="date-time-picker"><div class="date-picker-head"><span>${esc(label)}</span><span>Hora de Perú</span></div>
 <div class="picker-month"><button type="button" class="icon-btn" data-prev aria-label="Mes anterior">‹</button><strong data-month aria-live="polite"></strong><button type="button" class="icon-btn" data-next aria-label="Mes siguiente">›</button></div>
 <div class="picker-week" aria-hidden="true">${['L','M','M','J','V','S','D'].map(x=>`<span>${x}</span>`).join('')}</div><div class="picker-days" role="group" aria-label="Seleccionar día"></div>
 <label class="picker-date" for="${id}-date">Fecha seleccionada<input class="input plain" id="${id}-date" type="date" min="1900-01-01" max="2199-12-31" value="${selected}" required></label>
 <div class="picker-time"><label for="${id}-hour">Hora<select class="input plain" id="${id}-hour">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===hour?'selected':''}>${String(i+1).padStart(2,'0')}</option>`).join('')}</select></label>
 <label for="${id}-minute">Minutos<select class="input plain" id="${id}-minute">${Array.from({length:60},(_,i)=>`<option value="${i}" ${i===minute?'selected':''}>${String(i).padStart(2,'0')}</option>`).join('')}</select></label>
 <label for="${id}-period">Periodo<select class="input plain" id="${id}-period"><option ${period==='AM'?'selected':''}>AM</option><option ${period==='PM'?'selected':''}>PM</option></select></label></div></div>`;
 const date=$(`#${id}-date`,root);
 const render=()=>{
  $('[data-month]',root).textContent=new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric',timeZone:'UTC'}).format(view);
  const y=view.getUTCFullYear(),m=view.getUTCMonth(),offset=(view.getUTCDay()+6)%7,last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  $('.picker-days',root).innerHTML=Array.from({length:offset},()=>'<span></span>').join('')+Array.from({length:last},(_,i)=>{const key=`${y}-${String(m+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`;return `<button type="button" data-day="${key}" aria-pressed="${key===selected}" aria-label="${key}">${i+1}</button>`;}).join('');
  $('[data-prev]',root).disabled=y===1900&&m===0;$('[data-next]',root).disabled=y===2199&&m===11;
 };
 $('[data-prev]',root).onclick=()=>{view.setUTCMonth(view.getUTCMonth()-1);render();};$('[data-next]',root).onclick=()=>{view.setUTCMonth(view.getUTCMonth()+1);render();};
 $('.picker-days',root).onclick=e=>{const b=e.target.closest('[data-day]');if(!b)return;selected=b.dataset.day;date.value=selected;render();$(`[data-day="${selected}"]`,root).focus();};
 date.onchange=()=>{if(date.validity.valid&&date.value){selected=date.value;view=new Date(selected.slice(0,7)+'-01T00:00:00Z');render();}};
 render();
 return {getValue:()=>date.value&&date.validity.valid?`${date.value}T${String(to24Hour($(`#${id}-hour`,root).value,$(`#${id}-period`,root).value)).padStart(2,'0')}:${String($(`#${id}-minute`,root).value).padStart(2,'0')}`:null};
}
