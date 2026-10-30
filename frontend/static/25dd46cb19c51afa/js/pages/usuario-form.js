import { initWorkSchedule } from '../work-schedule.js';
import { ManagedUsers } from '../api.js';
import { initPage } from '../layout.js';
import { ROUTES } from '../config.js';
import { $, withBusy } from '../ui.js';
import { enableMenuKeyboard, message, roles } from '../page-tools.js';

async function main(){
  const current=await initPage({role:'admin',page:'usuarios'});
  enableMenuKeyboard();
  const form=$('#user-form'),editing=form.dataset.mode==='edit';
  const schedule=initWorkSchedule($('#work-schedule'));
  const rawId=new URLSearchParams(location.search).get('id');
  const id=rawId && /^\d+$/.test(rawId)?Number(rawId):0;
  if(editing){
    if(!Number.isSafeInteger(id)||id<1){message('Falta el identificador del usuario. Regresa a la lista y pulsa Editar.');return;}
    try{
      const {user}=await ManagedUsers.get(id);
      $('#user-name').value=user.nombres||user.nombre;$('#user-paternal').value=user.apellido_paterno||'';$('#user-maternal').value=user.apellido_materno||'';$('#user-corporate').value=user.correo_corporativo||'';$('#user-email').value=user.correo_personal||'';$('#user-phone').value=user.telefono||'';$('#user-role').value=user.rol;
      schedule.set(user.horario??null);
      $('#user-code').textContent=user.revisar_nombre?'Revisa la distribución de nombres y apellidos del registro anterior antes de guardar.':user.requiere_clave?'Esta cuenta requiere una nueva contraseña para poder ingresar.':'';$('#user-code').hidden=false;
      $('#user-fields').disabled=false;$('#user-submit').disabled=false;
      if(user.id===current.empleado_id){$('#user-role').disabled=true;$('#user-role').title='No puedes cambiar tu propio rol';}
    }catch(err){message(err);return;}
  }
  let previewSeq=0,previewTimer;
  const identityBody=()=>({nombres:$('#user-name').value.trim(),apellido_paterno:$('#user-paternal').value.trim(),apellido_materno:$('#user-maternal').value.trim(),correo_personal:$('#user-email').value.trim(),rol:$('#user-role').value});
  const preview=()=>{clearTimeout(previewTimer);const seq=++previewSeq;previewTimer=setTimeout(async()=>{try{const b=identityBody();delete b.correo_personal;if(!b.nombres){$('#user-corporate').value='';return;}const x=await ManagedUsers.previewEmail({...b,id});if(seq===previewSeq)$('#user-corporate').value=x.correo_corporativo;}catch(e){if(seq===previewSeq)$('#user-corporate').value='';}},500);};
  for(const sel of ['#user-name','#user-role'])$(sel).addEventListener('input',preview);
  form.addEventListener('submit',async e=>{
    e.preventDefault();if($('#user-submit').disabled)return;message(null);
    let horario;try{horario=schedule.get();}catch(err){message(err);return;}
    const body={...identityBody(),horario,pin:$('#user-password').value,rol:$('#user-role').value,telefono:$('#user-phone').value.trim()};
    await withBusy($('#user-submit'),async()=>{
      try{
        const result=editing?await ManagedUsers.update(id,body):await ManagedUsers.create(body);
        $('#user-password').value='';
        if(result.reauthenticate){location.assign(ROUTES.login);return;}
        sessionStorage.setItem('erp-user-notice',editing?`Cambios guardados. Correo de acceso: ${result.user.correo_corporativo}.`:`Usuario creado. Correo corporativo: ${result.user.correo_corporativo}. Comparte la contraseña mediante un canal seguro.`);
        location.assign(ROUTES.admin.usuarios);
      }catch(err){message(err);}
    });
  });
}
main().catch(err=>console.error('Formulario de usuario:',err));
