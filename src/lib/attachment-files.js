import {HttpError} from './http.js';
export const LIMITS={count:5,file:10*1024*1024,total:25*1024*1024,request:26*1024*1024,task:250*1024*1024,user:1024*1024*1024,taskCount:1000,userCount:5000};
const bad=message=>{throw new HttpError(400,message);};
export function safeName(value){
 if(typeof value!=='string')bad('Nombre de archivo inválido.');
 const n=value.normalize('NFC');
 if(!n.trim()||n.length>200||/[\\/\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/u.test(n)||n==='.'||n==='..')bad('Nombre de archivo no admitido.');
 return n;
}
const starts=(a,b)=>b.every((v,i)=>a[i]===v);
const ascii=(a,start,end)=>new TextDecoder('ascii').decode(a.subarray(start,end));
/** Solo inspección acotada del directorio ZIP: no se extraen ni ejecutan archivos. */
function zipNames(a){
 if(!starts(a,[80,75,3,4]))bad('El contenido no corresponde a un archivo ZIP válido.');
 const v=new DataView(a.buffer,a.byteOffset,a.byteLength);let end=-1;
 for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===a.length){end=i;break;}
 if(end<0||v.getUint16(end+4,true)!==0||v.getUint16(end+6,true)!==0)bad('ZIP multipartido o incompleto no admitido.');
 const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true),size=v.getUint32(end+12,true);
 if(count>5000||offset+size!==end)bad('Directorio ZIP inválido o demasiado grande.');
 let p=offset;const names=[];
 for(let i=0;i<count;i++){
  if(p+46>end||v.getUint32(p,true)!==0x02014b50)bad('Directorio ZIP inválido.');
  const len=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),flags=v.getUint16(p+8,true),next=p+46+len+extra+comment;
  if(next>end||flags&1)bad('No se admiten ZIP cifrados o inválidos.');
  const name=new TextDecoder().decode(a.subarray(p+46,p+46+len));
  if(name.includes('\\')||name.startsWith('/')||name.split('/').includes('..')||/[\x00-\x1f]/.test(name))bad('El ZIP contiene rutas inseguras.');
  names.push(name);p=next;
 }
 if(p!==end)bad('Directorio ZIP inválido.');return names;
}
export function detectType(name,a){
 const ext=name.split('.').pop().toLowerCase();let mime;
 if(ext==='pdf'&&ascii(a,0,5)==='%PDF-')mime='application/pdf';
 else if(ext==='png'&&starts(a,[137,80,78,71,13,10,26,10]))mime='image/png';
 else if(['jpg','jpeg'].includes(ext)&&starts(a,[255,216,255]))mime='image/jpeg';
 else if(ext==='webp'&&ascii(a,0,4)==='RIFF'&&ascii(a,8,12)==='WEBP')mime='image/webp';
 else if(['txt','csv'].includes(ext)){
  let s;try{s=new TextDecoder('utf-8',{fatal:true}).decode(a);}catch{bad('Los archivos TXT/CSV deben estar codificados en UTF-8.');}
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s))bad('El archivo no contiene texto UTF-8 válido.');
  mime=ext==='csv'?'text/csv':'text/plain';
 }else if(['doc','xls','ppt'].includes(ext)&&starts(a,[208,207,17,224,161,177,26,225]))mime={doc:'application/msword',xls:'application/vnd.ms-excel',ppt:'application/vnd.ms-powerpoint'}[ext];
 else if(['zip','docx','xlsx','pptx'].includes(ext)){
  const names=zipNames(a);if(ext==='zip')mime='application/zip';else{
   const root={docx:'word/document.xml',xlsx:'xl/workbook.xml',pptx:'ppt/presentation.xml'}[ext];
   if(!names.includes('[Content_Types].xml')||!names.includes(root)||names.some(n=>/vbaProject\.bin$/i.test(n)))bad('El archivo Office no coincide con su extensión o contiene macros.');
   mime={docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[ext];
  }
 }
 if(!mime)bad('Tipo no admitido o contenido distinto de la extensión: '+name);
 return mime;
}
export const previewKind=mime=>mime.startsWith('image/')?'image':['text/plain','text/csv'].includes(mime)?'text':null;
export function disposition(name,inline=false){
 const plain=name.replace(/[^a-zA-Z0-9._ -]/g,'_');
 return `${inline?'inline':'attachment'}; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`;
}
export async function limitedForm(request){
 const type=request.headers.get('Content-Type')||'';
 if(!/^multipart\/form-data;\s*boundary=/i.test(type))throw new HttpError(415,'Usa multipart/form-data para adjuntar archivos.');
 const length=request.headers.get('Content-Length');if(length&&Number(length)>LIMITS.request)throw new HttpError(413,'La solicitud supera 26 MiB.');
 if(!request.body)bad('Solicitud vacía.');
 const reader=request.body.getReader();let size=0;
 const stream=new ReadableStream({async pull(controller){
  try{const {done,value}=await reader.read();if(done){reader.releaseLock();controller.close();return;}size+=value.byteLength;if(size>LIMITS.request){reader.releaseLock();controller.error(new HttpError(413,'La solicitud supera 26 MiB.'));return;}controller.enqueue(value);}catch(err){controller.error(err);}
 },cancel(reason){return reader.cancel(reason);}});
 try{return await new Response(stream,{headers:{'Content-Type':type}}).formData();}catch(err){if(err instanceof HttpError)throw err;bad('Formulario de archivos inválido.');}
}
