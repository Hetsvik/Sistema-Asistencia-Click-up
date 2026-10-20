import { Projects } from '../api.js';
import { initPage } from '../layout.js';
import { enableMenuKeyboard } from '../page-tools.js';
import { $,debounce,esc,fmtDateTime } from '../ui.js';
await initPage({role:'admin',page:'inicio'});enableMenuKeyboard();
let page=1,serial=0;
async function load(){
 const token=++serial;$('#project-error').hidden=true;$('#project-list').setAttribute('aria-busy','true');$('#project-prev').disabled=$('#project-next').disabled=true;
 try{
  const data=await Projects.list({q:$('#project-search').value.trim(),order:$('#project-order').value,page,limit:10});if(token!==serial)return;page=data.page;
  $('#project-list').innerHTML=data.projects.map(p=>`<article class="project-card project-row card"><div class="project-main"><span class="project-area">${esc(p.area)}</span><h2>${esc(p.nombre)}</h2><p class="project-description">${esc(p.descripcion||'Sin descripción registrada.')}</p></div><div class="project-meta"><span>Fecha registrada · Perú</span><time>${p.fecha?fmtDateTime(p.fecha):'Sin fecha histórica'}</time></div><a class="btn sm outline project-edit" href="/admin/proyectos/editar?id=${encodeURIComponent(p.id)}" aria-label="Editar proyecto ${esc(p.nombre)}">Editar</a></article>`).join('')||'<p class="agenda-message">No hay proyectos para mostrar.</p>';
  $('#project-count').textContent=`${data.total} proyecto${data.total===1?'':'s'}`;$('#project-page').textContent=`Página ${page} de ${data.pages}`;
  $('#project-prev').disabled=page<=1;$('#project-next').disabled=page>=data.pages;
 }catch(err){if(token===serial){$('#project-error').textContent=err.message;$('#project-error').hidden=false;}}
 finally{if(token===serial)$('#project-list').setAttribute('aria-busy','false');}
}
$('#project-search').addEventListener('input',debounce(()=>{page=1;load();},300));$('#project-order').onchange=()=>{page=1;load();};
$('#project-prev').onclick=()=>{page--;load();};$('#project-next').onclick=()=>{page++;load();};await load();