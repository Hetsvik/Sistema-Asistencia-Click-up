import { cropProfilePhoto } from '../profile-photo.js';
import { initWorkSchedule } from '../work-schedule.js';
import { ManagedUsers, WorkAreas, Photo } from '../api.js';
import { initPage } from '../layout.js';
import { ROUTES } from '../config.js';
import { $, esc, openModal, withBusy } from '../ui.js';
import { enableMenuKeyboard, message, roles } from '../page-tools.js';

async function main(){
  const current=await initPage({role:'admin',page:'usuarios'});
  enableMenuKeyboard();
  const form=$('#user-form'),editing=form.dataset.mode==='edit';
  const areaSelect=$('#user-area');
  async function loadAreas(selected=''){
    const {areas,has_more}=await WorkAreas.list();
    areaSelect.replaceChildren(new Option('Selecciona un área…',''),...areas.map(a=>new Option(a.nombre,String(a.id))));
    areaSelect.value=String(selected||'');
    if(has_more)throw new Error('Hay demasiadas áreas para mostrarlas. Contacta al soporte.');
  }
  try{await loadAreas();}catch(err){message(err);$('#user-fields').disabled=true;$('#user-submit').disabled=true;return;}
  $('#area-toggle').onclick=()=>{const box=$('#area-create');box.hidden=!box.hidden;if(!box.hidden)$('#area-name').focus();};
  $('#area-save').onclick=async()=>{const nombre=$('#area-name').value.trim();if(!nombre){message('Escribe el nombre del área.');return;}message(null);await withBusy($('#area-save'),async()=>{try{const {area}=await WorkAreas.create(nombre);await loadAreas(area.id);$('#area-name').value='';$('#area-create').hidden=true;}catch(err){message(err);}});};

  const schedule=initWorkSchedule($('#work-schedule'));
  const rawId=new URLSearchParams(location.search).get('id');
  const id=rawId && /^\d+$/.test(rawId)?Number(rawId):0;
  if(editing){
    if(!Number.isSafeInteger(id)||id<1){message('Falta el identificador del usuario. Regresa a la lista y pulsa Editar.');return;}
    try{
      const {user}=await ManagedUsers.get(id);
      $('#user-name').value=user.nombres||user.nombre;$('#user-paternal').value=user.apellido_paterno||'';$('#user-maternal').value=user.apellido_materno||'';$('#user-corporate').value=user.correo_corporativo||'';$('#user-email').value=user.correo_personal||'';$('#user-phone').value=user.telefono||'';$('#user-role').value=user.rol;
      schedule.set(user.horario??null);areaSelect.value=user.area_id?String(user.area_id):'';$('#user-cargo').value=user.cargo||'';if(user.tiene_foto){$('#user-photo-preview').src='/api/user-photo/'+id+'?v='+Date.now();$('#user-photo-preview').hidden=false;$('#user-photo-delete').hidden=false;}
      $('#user-code').textContent=user.revisar_nombre?'Revisa la distribución de nombres y apellidos del registro anterior antes de guardar.':user.requiere_clave?'Esta cuenta requiere una nueva contraseña para poder ingresar.':'';$('#user-code').hidden=false;
      $('#user-fields').disabled=false;$('#user-submit').disabled=false;
      if(user.id===current.empleado_id){$('#user-role').disabled=true;$('#user-role').title='No puedes cambiar tu propio rol';}
      const remove=$('#user-remove');
      if(user.id!==current.empleado_id){remove.disabled=false;remove.onclick=()=>{
        const modal=openModal({title:'Eliminar usuario',html:`<p>¿Eliminar a <strong>${esc(user.nombre)}</strong> de la lista de usuarios?</p><p>La cuenta perderá el acceso y sus sesiones se cerrarán. Se conservarán sus datos, foto, tareas, asistencia y demás historial; no se borrarán de forma permanente. No podrá reactivarse desde la interfaz.</p><p class="module-message error" id="remove-user-error" role="alert" hidden></p><div class="module-actions"><button type="button" class="btn outline" data-close>Cancelar</button><button type="button" class="btn danger" id="confirm-user-remove">Eliminar usuario</button></div>`});
        $('#confirm-user-remove',modal.el).onclick=e=>withBusy(e.currentTarget,async()=>{try{await ManagedUsers.remove(id);sessionStorage.setItem('erp-user-notice','Usuario eliminado de la lista. Su historial se conserva.');location.assign(ROUTES.admin.usuarios);}catch(err){const el=$('#remove-user-error',modal.el);el.hidden=false;el.textContent=err.message;}});
      };}else{remove.title='No puedes eliminar tu propia cuenta';}

    }catch(err){message(err);return;}
  }
  if(!editing){$('#user-fields').disabled=false;$('#user-submit').disabled=false;}
  $('#user-photo-delete').onclick=async()=>{if(!editing||!confirm('¿Eliminar la foto de perfil?'))return;await withBusy($('#user-photo-delete'),async()=>{try{const r=await Photo.remove(id);$('#user-photo-preview').hidden=true;$('#user-photo-delete').hidden=true;$('#user-photo').value='';message(r.message);}catch(err){message(err);}});};
  let selectedPhoto=null;
  $('#user-photo').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{selectedPhoto=await cropProfilePhoto(file);const preview=$('#user-photo-preview');if(preview.src.startsWith('blob:'))URL.revokeObjectURL(preview.src);preview.src=URL.createObjectURL(selectedPhoto);preview.hidden=false;message(null);}catch(err){selectedPhoto=null;e.target.value='';if(err.message!=='Se canceló el ajuste de la foto.')message(err);}});
  const photoNotice=sessionStorage.getItem('erp-photo-notice');if(photoNotice){message(photoNotice);sessionStorage.removeItem('erp-photo-notice');}
  let previewSeq=0,previewTimer;
  const identityBody=()=>({nombres:$('#user-name').value.trim(),apellido_paterno:$('#user-paternal').value.trim(),apellido_materno:$('#user-maternal').value.trim(),correo_personal:$('#user-email').value.trim(),rol:$('#user-role').value});
  const preview=()=>{clearTimeout(previewTimer);const seq=++previewSeq;previewTimer=setTimeout(async()=>{try{const b=identityBody();delete b.correo_personal;if(!b.nombres){$('#user-corporate').value='';return;}const x=await ManagedUsers.previewEmail({...b,id});if(seq===previewSeq)$('#user-corporate').value=x.correo_corporativo;}catch(e){if(seq===previewSeq)$('#user-corporate').value='';}},500);};
  for(const sel of ['#user-name','#user-role'])$(sel).addEventListener('input',preview);
  form.addEventListener('submit',async e=>{
    e.preventDefault();if($('#user-submit').disabled)return;message(null);
    let horario;try{horario=schedule.get();}catch(err){message(err);return;}
    const photo=selectedPhoto;
    const body={...identityBody(),cargo:$('#user-cargo').value.trim(),area_id:Number(areaSelect.value),horario,pin:$('#user-password').value,rol:$('#user-role').value,telefono:$('#user-phone').value.trim()};
    await withBusy($('#user-submit'),async()=>{
      try{
        const result=editing?await ManagedUsers.update(id,body):await ManagedUsers.create(body);
        $('#user-password').value='';
        if(result.reauthenticate){if(photo)alert('Los cambios se guardaron. Inicia sesión nuevamente para subir tu foto desde Configuración.');location.assign(ROUTES.login);return;}
        if(photo){try{await Photo.upload(result.user.id,photo);}catch(err){sessionStorage.setItem('erp-photo-notice','Usuario guardado; no se pudo subir la foto: '+err.message);location.assign(ROUTES.admin.usuarioEditar(result.user.id));return;}}
        sessionStorage.setItem('erp-user-notice',editing?`Cambios guardados. Correo de acceso: ${result.user.correo_corporativo}.`:`Usuario creado. Correo corporativo: ${result.user.correo_corporativo}. Comparte la contraseña mediante un canal seguro.`);
        location.assign(ROUTES.admin.usuarios);
      }catch(err){message(err);}
    });
  });
}
main().catch(err=>console.error('Formulario de usuario:',err));
