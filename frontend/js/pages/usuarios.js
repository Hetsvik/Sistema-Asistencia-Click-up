import { ManagedUsers } from '../api.js';
import { initPage } from '../layout.js';
import { ROUTES } from '../config.js';
import { $, debounce, esc, openModal, withBusy } from '../ui.js';
import { enableMenuKeyboard, message, pager, roles } from '../page-tools.js';

async function main(){
  const current=await initPage({role:'admin',page:'usuarios'});
  enableMenuKeyboard();
  let sequence=0,page=1,rows=[];
  const notice=sessionStorage.getItem('erp-user-notice');
  if(notice){$('#created-message').textContent=notice;$('#created-message').hidden=false;sessionStorage.removeItem('erp-user-notice');}
  const load=async(next=1)=>{
    const seq=++sequence;message(null);$('#user-table').setAttribute('aria-busy','true');
    try{
      const data=await ManagedUsers.list({q:$('#user-search').value.trim(),rol:$('#user-role').value,estado:$('#user-status').value,page:next});
      if(seq!==sequence)return;page=data.page;rows=data.users;
      $('#stat-active').textContent=data.stats.activos;$('#stat-admin').textContent=data.stats.administradores;$('#stat-worker').textContent=data.stats.trabajadores;
      $('#user-list').innerHTML=rows.length?rows.map(u=>`<tr><td data-label="Nombre"><div class="user-identity">${esc(u.nombre)}<small>${esc(u.codigo)}${u.id===current.empleado_id?' · Tu cuenta':''}</small></div><span class="account-badge${u.estado==='Inactivo'?' inactive':''}">${u.estado==='Activo'?'● Activo':'○ Inactivo'}</span></td><td data-label="Rol">${roles[u.rol]}</td><td data-label="Teléfono">${esc(u.telefono || '—')}</td><td data-label="Acciones"><div class="user-row-actions"><a class="btn outline sm" href="${ROUTES.admin.usuarioEditar(u.id)}" aria-label="Editar a ${esc(u.nombre)}">Editar</a><button type="button" class="btn ${u.estado==='Activo'?'danger':'outline'} sm" data-status="${u.id}" ${u.id===current.empleado_id?'disabled title="No puedes desactivar tu propia cuenta"':''} aria-label="${u.estado==='Activo'?'Desactivar':'Activar'} a ${esc(u.nombre)}">${u.estado==='Activo'?'Desactivar':'Activar'}</button></div></td></tr>`).join(''):'<tr><td colspan="4">No se encontraron usuarios con estos filtros.</td></tr>';
      pager(data,load);
    }catch(err){if(seq===sequence){message(err);$('#user-list').innerHTML='<tr><td colspan="4">No se pudo cargar la lista. Cambia los filtros para volver a intentar.</td></tr>';$('#pagination').replaceChildren();}}
    finally{if(seq===sequence)$('#user-table').setAttribute('aria-busy','false');}
  };
  $('#user-search').addEventListener('input',debounce(()=>load()));
  $('#user-role').addEventListener('change',()=>load());$('#user-status').addEventListener('change',()=>load());
  $('#user-list').addEventListener('click',e=>{
    const button=e.target.closest('[data-status]');if(!button)return;
    const account=rows.find(u=>u.id===Number(button.dataset.status));if(!account)return;
    const active=account.estado==='Activo',next=active?'Inactivo':'Activo';
    const modal=openModal({title:active?'Desactivar usuario':'Activar usuario',html:`<p>¿${active?'Desactivar':'Activar'} la cuenta de <strong>${esc(account.nombre)}</strong>? ${active?'Perderá el acceso de inmediato. Su historial se conservará.':'Podrá volver a iniciar sesión con su código y contraseña.'}</p><p class="module-message error" id="status-error" role="alert" hidden></p><div class="module-actions"><button class="btn ${active?'danger':''}" type="button" id="status-confirm">${active?'Desactivar':'Activar'}</button><button class="btn outline" type="button" data-close>Cancelar</button></div>`});
    $('#status-confirm',modal.el).onclick=()=>withBusy($('#status-confirm',modal.el),async()=>{
      try{await ManagedUsers.setStatus(account.id,next);modal.close();await load(page);}
      catch(err){const el=$('#status-error',modal.el);el.textContent=err.message;el.hidden=false;}
    });
  });
  await load();
}
main().catch(err=>console.error('Usuarios:',err));
