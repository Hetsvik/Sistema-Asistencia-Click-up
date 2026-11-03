import {routeState} from '../list-state.js';
import {pager} from '../page-tools.js';
import { Projects } from '../api.js';
import { initPage } from '../layout.js';
import { enableMenuKeyboard } from '../page-tools.js';
import { $,debounce,esc,fmtDateTime } from '../ui.js';
await initPage({role:'admin',page:'inicio'});enableMenuKeyboard();
const route=routeState({page:1,limit:20,q:'',order:'desc'});
const nav=$('#project-page').parentElement;
const restore=()=>{const s=route.read();page=s.page;$('#project-search').value=s.q;$('#project-order').value=s.order;};
let page=1,serial=0;
async function load(){
 const token=++serial;$('#project-error').hidden=true;$('#project-list').setAttribute('aria-busy','true');
 try{
  const data=await Projects.list({q:$('#project-search').value.trim(),order:$('#project-order').value,page,limit:route.read().limit});if(token!==serial)return;page=data.page;
  $('#project-list').innerHTML=data.projects.map(p=>`<article class="project-card project-row card"><div class="project-main"><span class="project-area">${esc(p.area)}</span><h2>${esc(p.nombre)}</h2><p class="project-description">${esc(p.descripcion||'Sin descripción registrada.')}</p></div><div class="project-meta"><span>Fecha registrada · Perú</span><time>${p.fecha?fmtDateTime(p.fecha):'Sin fecha histórica'}</time></div><a class="btn sm outline project-edit" href="/admin/proyectos/editar?id=${encodeURIComponent(p.id)}" aria-label="Editar proyecto ${esc(p.nombre)}">Editar</a></article>`).join('')||'<p class="agenda-message">No hay proyectos para mostrar.</p>';
  $('#project-count').textContent=`${data.total} proyecto${data.total===1?'':'s'}`;
  route.write({page,limit:data.limit,q:$('#project-search').value.trim(),order:$('#project-order').value});pager(data,next=>{page=next;load();},{element:nav,onSize:limit=>{route.write({limit,page:1});page=1;load();}});
 }catch(err){if(token===serial){$('#project-error').textContent=err.message;$('#project-error').hidden=false;}}
 finally{if(token===serial)$('#project-list').setAttribute('aria-busy','false');}
}
$('#project-search').addEventListener('input',debounce(()=>{page=1;load();},300));$('#project-order').onchange=()=>{page=1;load();};
route.onChange(()=>{restore();load();});restore();await load();
