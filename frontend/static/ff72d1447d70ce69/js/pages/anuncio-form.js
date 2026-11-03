import { Announcements } from '../api.js';
import { initPage } from '../layout.js';
import { ROUTES } from '../config.js';
import { $, withBusy } from '../ui.js';
import { enableMenuKeyboard, message } from '../page-tools.js';

async function main(){
  await initPage({role:'admin',page:'anuncios'});
  enableMenuKeyboard();
  $('#announcement-form').addEventListener('submit',async e=>{
    e.preventDefault();if($('#announcement-submit').disabled)return;message(null);
    await withBusy($('#announcement-submit'),async()=>{
      try{
        await Announcements.create({nombre:$('#announcement-name').value.trim(),motivo:$('#announcement-reason').value.trim()});
        location.assign(ROUTES.admin.anuncios);
      }catch(err){message(err);}
    });
  });
}
main().catch(err=>console.error('Crear anuncio:',err));
