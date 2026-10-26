// Selección en memoria; solo el envío confirmado del formulario publica archivos en R2 privado.
import { $,esc,icon } from './ui.js';
export const ATTACHMENT_LIMITS={count:5,perFile:10*1024*1024,total:25*1024*1024};
const extensions=new Set(['pdf','png','jpg','jpeg','webp','txt','csv','doc','docx','xls','xlsx','ppt','pptx','zip']);
export const fileKey=f=>`${f.name}\u0000${f.size}\u0000${f.lastModified}`;
export function selectFiles(existing,incoming){
 const files=[...existing],errors=[];
 for(const f of incoming){
  if(files.some(x=>fileKey(x)===fileKey(f)))continue;
  const ext=f.name.split('.').pop().toLowerCase();
  if(!extensions.has(ext)||f.name.length>200){errors.push(`${f.name}: tipo o nombre no admitido.`);continue;}
  if(f.size<=0||f.size>ATTACHMENT_LIMITS.perFile){errors.push(`${f.name}: debe pesar entre 1 byte y 10 MB.`);continue;}
  if(files.length>=ATTACHMENT_LIMITS.count){errors.push('Máximo 5 archivos por selección.');continue;}
  if(files.reduce((n,x)=>n+x.size,0)+f.size>ATTACHMENT_LIMITS.total){errors.push('La selección no puede superar 25 MB.');continue;}
  files.push(f);
 }
 return {files,errors};
}
export function initAttachments(root,{onChange=()=>{}}={}){
 const form=$('#chat-form',root),input=document.createElement('input');input.type='file';input.multiple=true;input.hidden=true;input.id='chat-files';input.accept=[...extensions].map(x=>'.'+x).join(',');form.append(input);
 const button=document.createElement('button');button.type='button';button.className='chat-attach';button.setAttribute('aria-label','Adjuntar archivos');button.title='Adjuntar archivos';button.innerHTML='<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m21 11-9 9a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.7 5.7l-9 9a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>';form.prepend(button);
 const panel=document.createElement('div');panel.className='attachment-preview';panel.id='attachment-preview';panel.hidden=true;panel.setAttribute('aria-label','Archivos pendientes de enviar');form.after(panel);
 let files=[],messages=[],busy=false,envelope=null;
 function render(){
  panel.hidden=!files.length&&!messages.length;
  panel.innerHTML=`<p class="attachment-note">${busy?'Subiendo archivos… No cierres la conversación hasta confirmar el envío.':'Archivos pendientes. Pulsa Enviar para subirlos y compartirlos en esta tarea.'}</p><ul>${files.map((f,i)=>`<li><span><strong>${esc(f.name)}</strong><small>${Math.ceil(f.size/1024)} KB · ${busy?'subiendo…':'pendiente, no enviado'}</small></span><button type="button" class="attachment-remove" ${busy?'disabled':''} data-remove="${i}" aria-label="Quitar ${esc(f.name)}">${icon('close')}</button></li>`).join('')}</ul><p class="attachment-errors" role="status">${messages.map(esc).join('<br>')}</p><p class="muted">Máximo 5 archivos · 10 MB cada uno · 25 MB en total. La selección no enviada se pierde al cerrar. Documentos y ZIP: descarga; imágenes y TXT/CSV: vista previa.</p>`;
 }
 button.onclick=()=>input.click();input.onchange=()=>{if(busy)return;envelope=null;const result=selectFiles(files,[...input.files]);files=result.files;messages=result.errors;input.value='';render();onChange();};
 panel.onclick=e=>{const b=e.target.closest('[data-remove]');if(!b||busy)return;envelope=null;const i=Number(b.dataset.remove);files.splice(i,1);messages=[];render();const next=panel.querySelector('[data-remove]');(next||button).focus();onChange();};
 return {
  formData(message){const signature=JSON.stringify([message,...files.map(fileKey)]);if(!envelope||envelope.signature!==signature)envelope={signature,id:crypto.randomUUID()};const f=new FormData();f.append('client_id',envelope.id);f.append('mensaje',message);for(const file of files)f.append('files',file,file.name);return f;},
  setBusy(value){busy=value;button.disabled=value;input.disabled=value;render();},
  clear(){files=[];messages=[];envelope=null;render();onChange();},
  destroy(){files=[];messages=[];input.value='';input.onchange=null;button.onclick=null;panel.onclick=null;},get count(){return files.length;}};
}