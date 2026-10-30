import { Projects } from '../api.js';
import { initPage } from '../layout.js';
import { enableMenuKeyboard } from '../page-tools.js';
import { $,esc,fmtDateTime,openModal,withBusy } from '../ui.js';
await initPage({role:'admin',page:'inicio'});enableMenuKeyboard();
const form=$('#project-form'),editing=location.pathname.includes('/editar'),id=new URLSearchParams(location.search).get('id');
const showError=err=>{$('#project-error').textContent=err.message;$('#project-error').hidden=false;};
let loaded=!editing;
if(editing){
 $('#project-submit').disabled=true;
 try{
  if(!/^[1-9]\d*$/.test(id||''))throw new Error('Falta el identificador. Vuelve al listado y pulsa Editar.');
  const {project:p}=await Projects.get(id);for(const k of ['nombre','area','descripcion'])form.elements[k].value=p[k]||'';
  $('#project-date').textContent=p.fecha?`Fecha registrada: ${fmtDateTime(p.fecha)} · hora de Perú. No cambia al editar.`:'No hay fecha histórica registrada. No se inventará una fecha al editar.';
  $('#project-danger').hidden=false;loaded=true;$('#project-submit').disabled=false;
 }catch(err){showError(err);}
}
form.addEventListener('submit',e=>{
 e.preventDefault();if(!loaded)return;$('#project-error').hidden=true;
 withBusy($('#project-submit'),async()=>{try{const body=Object.fromEntries(new FormData(form));if(editing)await Projects.update(id,body);else await Projects.create(body);location.assign('/admin/proyectos');}catch(err){showError(err);}});
});
$('#project-delete').onclick=()=>{
 if(!loaded)return;const name=form.elements.nombre.value;
 const modal=openModal({title:'Eliminar proyecto',html:`<p>¿Eliminar <strong>${esc(name)}</strong> del listado?</p><p>Ya no se podrá elegir para tareas nuevas. Las tareas, conversaciones y avisos anteriores no se borrarán.</p><p id="delete-error" role="alert" class="form-message is-error" hidden></p><div class="modal-actions"><button type="button" class="btn outline" data-close>Cancelar</button><button type="button" class="btn outline danger" id="confirm-delete">Eliminar proyecto</button></div>`});
 $('#confirm-delete',modal.el).onclick=e=>withBusy(e.currentTarget,async()=>{try{await Projects.remove(id);location.assign('/admin/proyectos');}catch(err){$('#delete-error',modal.el).textContent=err.message;$('#delete-error',modal.el).hidden=false;}});
};
