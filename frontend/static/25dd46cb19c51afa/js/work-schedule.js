const DAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
export function weeklyMinutes(schedule){return (schedule||[]).reduce((n,d)=>n+d.tramos.reduce((m,s)=>m+minutes(s.fin)-minutes(s.inicio),0),0);}
const fresh=()=>DAYS.map((_,i)=>({dia:i+1,active:false,tramos:[{inicio:'09:00',fin:'18:00'}]}));
export function initWorkSchedule(root){
 let state=fresh(),configured=false;
 root.innerHTML=`<div class="schedule-heading"><div><p class="module-eyebrow">Organización del equipo</p><h2>Horario de trabajo</h2></div><span class="schedule-zone">Hora de Perú · UTC−5</span></div>
 <p class="field-help" id="schedule-help">Configura una semana habitual. Marca los días laborables y elige sus horas de entrada y salida.</p>
 <label class="schedule-enable"><input type="checkbox" id="schedule-enabled" aria-describedby="schedule-help"> Definir horario semanal</label>
 <div id="schedule-editor" hidden><div class="schedule-tools"><button type="button" class="btn outline sm" id="schedule-weekdays">Lun–vie · 09:00–18:00</button><button type="button" class="btn outline sm" id="schedule-copy">Copiar lunes a días activos</button></div>
 <p class="field-help">Horas de 00:00 a 23:59. Añade un segundo tramo si hay una pausa; el descanso no suma horas. Cada tramo debe terminar el mismo día.</p>
 <div id="schedule-days"></div></div>
 <p class="schedule-summary" id="schedule-summary" role="status" aria-live="polite"></p>
 <p class="field-help">Se guarda al pulsar Crear Usuario o Guardar Cambios. Los cambios rigen desde mañana (Perú). La entrada de cada tramo tiene 10 minutos de tolerancia.</p>`;
 const enabled=root.querySelector('#schedule-enabled'),editor=root.querySelector('#schedule-editor'),container=root.querySelector('#schedule-days'),summary=root.querySelector('#schedule-summary');
 function updateSummary(){
  if(!configured){summary.textContent='Sin horario configurado';return;}
  const active=state.filter(d=>d.active),valid=active.every(d=>d.tramos.every(s=>s.inicio&&s.fin&&s.fin>s.inicio)&&(d.tramos.length<2||d.tramos[1].inicio>=d.tramos[0].fin));
  if(!valid){summary.textContent='Revisa las horas: la salida debe ser posterior a la entrada y los tramos no deben superponerse.';return;}
  const total=weeklyMinutes(active),h=Math.floor(total/60),m=total%60;
  summary.textContent=active.length?`${active.length} ${active.length===1?'día laborable':'días laborables'} · ${h} h${m?' '+m+' min':''} por semana`:'Semana sin jornadas laborables';
 }
 function render(){
  enabled.checked=configured;editor.hidden=!configured;
  container.innerHTML=state.map((d,i)=>`<div class="schedule-day" data-day="${d.dia}"><div class="schedule-day-header"><label class="schedule-day-toggle"><input type="checkbox" data-active="${i}" ${d.active?'checked':''}> ${DAYS[i]}</label><span class="schedule-day-state">${d.active?'Laborable':'Descanso'}</span></div>
  <div class="schedule-day-body" ${d.active?'':'hidden'}>${d.tramos.map((s,j)=>`<div class="schedule-slot"><span class="schedule-slot-title">Tramo ${j+1}</span><label for="schedule-${i}-${j}-in">Entrada<input class="input plain" id="schedule-${i}-${j}-in" type="time" step="60" value="${s.inicio}" data-i="${i}" data-j="${j}" data-key="inicio" aria-label="${DAYS[i]}, entrada del tramo ${j+1}"></label><label for="schedule-${i}-${j}-out">Salida<input class="input plain" id="schedule-${i}-${j}-out" type="time" step="60" value="${s.fin}" data-i="${i}" data-j="${j}" data-key="fin" aria-label="${DAYS[i]}, salida del tramo ${j+1}"></label>${j?`<button type="button" class="schedule-remove" data-remove="${i}" aria-label="Quitar segundo tramo de ${DAYS[i]}">×</button>`:''}</div>`).join('')}
  ${d.tramos.length<2?`<button type="button" class="schedule-add" data-add="${i}">+ Añadir segundo tramo</button>`:''}<p class="schedule-day-error" id="schedule-error-${i}" role="alert" hidden></p></div></div>`).join('');
  updateSummary();
 }
 enabled.addEventListener('change',()=>{configured=enabled.checked;render();});
 container.addEventListener('change',e=>{
  const t=e.target;
  if(t.hasAttribute('data-active')){const i=Number(t.dataset.active);state[i].active=t.checked;render();container.querySelector(`[data-active="${i}"]`).focus();}
  else if(t.dataset.key){state[Number(t.dataset.i)].tramos[Number(t.dataset.j)][t.dataset.key]=t.value;root.querySelector(`#schedule-error-${t.dataset.i}`).hidden=true;for(const input of t.closest('.schedule-day').querySelectorAll('[aria-invalid]')){input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');}updateSummary();}
 });
 container.addEventListener('click',e=>{
  const add=e.target.closest('[data-add]'),remove=e.target.closest('[data-remove]');
  if(add){const i=Number(add.dataset.add),end=state[i].tramos[0].fin;state[i].tramos.push({inicio:end,fin:end<'18:00'?'18:00':''});render();container.querySelector(`#schedule-${i}-1-in`).focus();}
  if(remove){const i=Number(remove.dataset.remove);state[i].tramos.splice(1,1);render();container.querySelector(`[data-add="${i}"]`).focus();}
 });
 root.querySelector('#schedule-weekdays').addEventListener('click',()=>{configured=true;state=fresh().map((d,i)=>({...d,active:i<5}));render();});
 root.querySelector('#schedule-copy').addEventListener('click',()=>{
  if(!state[0].active){summary.textContent='Activa y configura el lunes antes de copiarlo.';container.querySelector('[data-active="0"]').focus();return;}
  for(const d of state)if(d.active)d.tramos=state[0].tramos.map(s=>({...s}));render();
 });
 render();
 return {
  set(value){configured=value!==null;state=fresh();for(const d of value||[]){state[d.dia-1]={dia:d.dia,active:true,tramos:d.tramos.map(s=>({...s}))};}render();},
  get(){
   if(!configured)return null;
   for(const e of root.querySelectorAll('.schedule-day-error'))e.hidden=true;
   for(const e of root.querySelectorAll('[aria-invalid]')){e.removeAttribute('aria-invalid');e.removeAttribute('aria-describedby');}
   function invalid(i,j,key,msg){const input=container.querySelector(`#schedule-${i}-${j}-${key}`),error=root.querySelector(`#schedule-error-${i}`);error.textContent=msg;error.hidden=false;input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',error.id);summary.textContent=msg;input.focus();throw new Error(msg);}
   for(const [i,d] of state.entries())if(d.active){
    for(const [j,s] of d.tramos.entries()){
     if(!s.inicio||!s.fin||s.fin<=s.inicio){invalid(i,j,'out',`${DAYS[i]}: completa las horas; la salida debe ser posterior a la entrada del mismo día.`);}
     if(j&&s.inicio<d.tramos[j-1].fin){invalid(i,j,'in',`${DAYS[i]}: los tramos deben estar en orden y no superponerse.`);}
    }
   }
   return state.filter(d=>d.active).map(d=>({dia:d.dia,tramos:d.tramos.map(s=>({...s}))}));
  }
 };
}
