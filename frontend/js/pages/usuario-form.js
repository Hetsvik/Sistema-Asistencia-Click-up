import { ManagedUsers } from '../api.js';
import { initPage } from '../layout.js';
import { ROUTES } from '../config.js';
import { $, withBusy } from '../ui.js';
import { enableMenuKeyboard, message, roles } from '../page-tools.js';

async function main(){
  const current=await initPage({role:'admin',page:'usuarios'});
  enableMenuKeyboard();
  const form=$('#user-form'),editing=form.dataset.mode==='edit';
  const rawId=new URLSearchParams(location.search).get('id');
  const id=rawId && /^\d+$/.test(rawId)?Number(rawId):0;
  if(editing){
    if(!Number.isSafeInteger(id)||id<1){message('Falta el identificador del usuario. Regresa a la lista y pulsa Editar.');return;}
    try{
      const {user}=await ManagedUsers.get(id);
      $('#user-name').value=user.nombre;$('#user-email').value=user.correo||'';$('#user-phone').value=user.telefono||'';$('#user-role').value=user.rol;
      $('#user-code').textContent=`Código de acceso: ${user.codigo}`;$('#user-code').hidden=false;
      $('#user-fields').disabled=false;$('#user-submit').disabled=false;
      if(user.id===current.empleado_id){$('#user-role').disabled=true;$('#user-role').title='No puedes cambiar tu propio rol';}
    }catch(err){message(err);return;}
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();if($('#user-submit').disabled)return;message(null);
    const body={nombre:$('#user-name').value.trim(),correo:$('#user-email').value.trim(),pin:$('#user-password').value,rol:$('#user-role').value,telefono:$('#user-phone').value.trim()};
    await withBusy($('#user-submit'),async()=>{
      try{
        const result=editing?await ManagedUsers.update(id,body):await ManagedUsers.create(body);
        $('#user-password').value='';
        if(result.reauthenticate){location.assign(ROUTES.login);return;}
        sessionStorage.setItem('erp-user-notice',editing?'Cambios guardados correctamente.':`Usuario creado. Código de acceso: ${result.user.codigo}. Perfil de ingreso: ${roles[result.user.rol]}. Comparte el código y la contraseña de forma segura con la persona.`);
        location.assign(ROUTES.admin.usuarios);
      }catch(err){message(err);}
    });
  });
}
main().catch(err=>console.error('Formulario de usuario:',err));
