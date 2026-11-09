import {Photo} from './api.js';import {$,openModal,withBusy} from './ui.js';
const MAX_BYTES=2*1024*1024,OUTPUT=512;
export async function validateProfilePhoto(file){
 if(!file||file.type!=='image/jpeg'&&!/\.jpe?g$/i.test(file.name))throw new Error('Selecciona un archivo JPG.');
 if(file.size<4096||file.size>MAX_BYTES)throw new Error('La foto debe pesar entre 4 KB y 2 MB.');
 let image;try{image=await createImageBitmap(file);}catch{throw new Error('El archivo no es una imagen JPG válida.');}
 const valid=image.width<=OUTPUT&&image.height<=OUTPUT&&image.width>0&&image.height>0;image.close();
 if(!valid)throw new Error('La imagen debe medir como máximo 512 × 512 píxeles.');
}
export async function cropProfilePhoto(file){
 await validateProfilePhoto(file);const source=await createImageBitmap(file);let scale=1,x=0,y=0,drag=null;
 const fit=Math.max(OUTPUT/source.width,OUTPUT/source.height),max=fit*3;scale=fit;
 const clamp=()=>{const w=source.width*scale,h=source.height*scale;x=Math.min(0,Math.max(OUTPUT-w,x));y=Math.min(0,Math.max(OUTPUT-h,y));};x=(OUTPUT-source.width*scale)/2;y=(OUTPUT-source.height*scale)/2;clamp();
 return new Promise((resolve,reject)=>{
  const modal=openModal({title:'Ajustar foto de perfil',html:`<p class="crop-help">Arrastra la imagen para centrarla en el círculo. Usa el control para acercar o alejar.</p><div class="photo-crop-frame"><canvas id="photo-crop-canvas" width="512" height="512" aria-label="Vista previa de la foto"></canvas></div><label class="crop-zoom">Zoom<input id="photo-crop-zoom" type="range" min="${fit}" max="${max}" step="0.001" value="${scale}"></label><p class="muted">Se guardará como JPG cuadrado de 512 × 512 píxeles.</p><div class="modal-actions"><button type="button" class="btn outline" data-close>Cancelar</button><button type="button" class="btn" id="photo-crop-confirm">Usar esta foto</button></div>`});
  const canvas=$('#photo-crop-canvas',modal.el),ctx=canvas.getContext('2d'),zoom=$('#photo-crop-zoom',modal.el);
  const draw=()=>{ctx.clearRect(0,0,OUTPUT,OUTPUT);ctx.fillStyle='#151515';ctx.fillRect(0,0,OUTPUT,OUTPUT);ctx.drawImage(source,x,y,source.width*scale,source.height*scale);};draw();
  const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*OUTPUT/r.width,y:(e.clientY-r.top)*OUTPUT/r.height};};
  canvas.onpointerdown=e=>{drag={...point(e),x,y};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;const p=point(e);x=drag.x+p.x-drag.x;y=drag.y+p.y-drag.y;clamp();draw();};canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
  zoom.oninput=()=>{const previous=scale;scale=Number(zoom.value);x=OUTPUT/2-(OUTPUT/2-x)*scale/previous;y=OUTPUT/2-(OUTPUT/2-y)*scale/previous;clamp();draw();};
  let done=false;const finish=value=>{if(done)return;done=true;source.close();value?resolve(value):reject(new Error('Se canceló el ajuste de la foto.'));};
  $('#photo-crop-confirm',modal.el).onclick=()=>canvas.toBlob(blob=>{if(!blob){finish();return;}finish(new File([blob],'foto-perfil.jpg',{type:'image/jpeg'}));modal.close();},'image/jpeg',.9);
  modal.el.addEventListener('close',()=>finish(),{once:true});
 });
}
export function initProfilePhoto(root,id,hasPhoto){
 root.innerHTML=`<h3>Foto de perfil</h3><p>JPG de hasta 512 × 512 píxeles y hasta 2 MB. Al seleccionarla podrás posicionarla dentro del marco circular.</p><img id="own-photo-preview" alt="Tu foto de perfil" width="120" height="120" ${hasPhoto?'':'hidden'}><label for="own-photo">Seleccionar JPG</label><input id="own-photo" class="input plain" type="file" accept=".jpg,.jpeg,image/jpeg"><div class="module-actions"><button class="btn sm" type="button" id="own-photo-save" disabled>Guardar foto</button><button class="btn outline sm" type="button" id="own-photo-delete" ${hasPhoto?'':'hidden'}>Eliminar foto</button></div><p id="own-photo-message" role="status"></p>`;
 const image=$('#own-photo-preview',root),input=$('#own-photo',root),msg=$('#own-photo-message',root),save=$('#own-photo-save',root),del=$('#own-photo-delete',root);let selected=null;if(hasPhoto)image.src=`/api/user-photo/${id}?v=${Date.now()}`;
 input.onchange=async()=>{const file=input.files[0];if(!file)return;msg.textContent='';try{selected=await cropProfilePhoto(file);image.src=URL.createObjectURL(selected);image.hidden=false;save.disabled=false;msg.textContent='Foto lista para guardar.';}catch(err){selected=null;input.value='';if(err.message!=='Se canceló el ajuste de la foto.')msg.textContent=err.message;}};
 save.onclick=e=>withBusy(e.currentTarget,async()=>{try{if(!selected)throw new Error('Selecciona una foto primero.');const r=await Photo.upload(id,selected);if(image.src.startsWith('blob:'))URL.revokeObjectURL(image.src);image.src=`/api/user-photo/${id}?v=${Date.now()}`;image.hidden=false;del.hidden=false;input.value='';selected=null;save.disabled=true;msg.textContent=r.message;document.dispatchEvent(new CustomEvent('erp:photo-changed',{detail:{hasPhoto:true}}));}catch(err){msg.textContent=err.message;}});
 del.onclick=e=>{if(!confirm('¿Eliminar tu foto?'))return;withBusy(e.currentTarget,async()=>{try{const r=await Photo.remove(id);image.hidden=true;del.hidden=true;input.value='';selected=null;save.disabled=true;msg.textContent=r.message;document.dispatchEvent(new CustomEvent('erp:photo-changed',{detail:{hasPhoto:false}}));}catch(err){msg.textContent=err.message;}});};
}
