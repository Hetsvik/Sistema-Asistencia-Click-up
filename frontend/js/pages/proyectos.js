import { Projects } from '../api.js';
import { initPage } from '../layout.js';
import { enableMenuKeyboard } from '../page-tools.js';
import { $, debounce, esc, fmtDateTime } from '../ui.js';
await initPage({role:'admin',page:'inicio'});enableMenuKeyboard();
let before=null,q='',serial=0;
async function load(append=false){
 const token=++serial;$('#project-error').hidden=true;$('#project-more').disabled=true;
 try{
  const data=await Projects.list({q,before:append?before:null,limit:20});if(token!==serial)return;
  const html=data.projects.map(p=>`<article class="project-card card"><span class="project-area">${esc(p.area)}</span><h2>${esc(p.nombre)}</h2><p class="project-description">${esc(p.descripcion||'Este proyecto fue creado antes de incorporar la descripción.')}</p><div class="project-card-footer"><span>Fecha del proyecto</span><time>${p.fecha?fmtDateTime(p.fecha):'Sin fecha registrada'}</time></div></article>`).join('');
  if(append)$('#project-list').insertAdjacentHTML('beforeend',html);else $('#project-list').innerHTML=html||'<p class="agenda-message">No hay proyectos para mostrar.</p>';
  before=data.next_before;$('#project-more').hidden=!data.has_more;
 }catch(err){if(token===serial){$('#project-error').textContent=err.message;$('#project-error').hidden=false;}}
 finally{if(token===serial)$('#project-more').disabled=false;}
}
$('#project-search').addEventListener('input',debounce(e=>{q=e.target.value.trim();load();},300));
$('#project-more').onclick=()=>load(true);await load();
