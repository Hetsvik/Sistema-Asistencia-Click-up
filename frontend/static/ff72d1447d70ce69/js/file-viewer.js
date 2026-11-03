import {openModal,esc,toast} from './ui.js';
const base=(task,id)=>`/api/tasks/${encodeURIComponent(task)}/attachments/${encodeURIComponent(id)}/download`;
export function renderFiles(files=[]){return files.map(f=>`<div class="sent-file"><span><strong>${esc(f.nombre)}</strong><small>${Math.ceil(f.bytes/1024)} KB · ${f.preview==='image'?'Imagen':f.preview==='text'?'Texto':'Documento'} · enviado</small></span><div class="sent-file-actions">${f.preview?`<button type="button" class="file-action" data-file="${esc(f.id)}" data-action="preview">Ver</button>`:''}<button type="button" class="file-action" data-file="${esc(f.id)}" data-action="download">Descargar</button></div></div>`).join('');}
export async function fileAction(task,f,action){
 try{
  if(action==='preview'&&f.preview==='text'&&f.bytes>1024*1024)throw new Error('La vista previa de texto se limita a 1 MiB. Descarga el archivo para leerlo completo.');
  const res=await fetch(base(task,f.id)+(action==='preview'?'?preview=1':''),{credentials:'same-origin'});
  if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.detail||'No se pudo abrir el archivo.');}
  const blob=await res.blob();
  if(action==='download'){
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=f.nombre;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);return;
  }
  if(f.preview==='text'){
   const m=openModal({title:f.nombre,wide:true,html:'<pre class="file-text" tabindex="0"></pre>'});m.el.querySelector('pre').textContent=await blob.text();
  }else if(f.preview==='image'){
   const url=URL.createObjectURL(blob);openModal({title:f.nombre,wide:true,html:`<img class="file-image" src="${url}" alt="${esc(f.nombre)}">`,onClose:()=>URL.revokeObjectURL(url)});
  }
 }catch(err){toast(err.message,'error');}
}
