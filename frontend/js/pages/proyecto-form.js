import { Projects } from '../api.js';
import { initPage } from '../layout.js';
import { enableMenuKeyboard } from '../page-tools.js';
import { initDateTimePicker } from '../date-time-picker.js';
import { $, withBusy } from '../ui.js';
await initPage({role:'admin',page:'inicio'});enableMenuKeyboard();
const form=$('#project-form'),picker=initDateTimePicker($('#project-datetime'),{label:'Fecha y hora del proyecto',hour:9,period:'AM'});
form.addEventListener('submit',e=>{
 e.preventDefault();const values=Object.fromEntries(new FormData(form)),error=$('#project-error');error.hidden=true;
 withBusy($('[type=submit]',form),async()=>{
  try{await Projects.create({...values,fecha:picker.getValue()});location.assign('/admin/proyectos');}
  catch(err){error.textContent=err.message;error.hidden=false;}
 });
});
