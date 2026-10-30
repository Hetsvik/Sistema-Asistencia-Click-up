const colors=['#bd8625','#478b72','#b45b51','#767ca6','#6c8eaa','#a58756'];
export const metricColor=(label,i=0)=>['Alta','Fuera tolerancia','Sin entrada'].includes(label)?'#b45b51':['Media','En revisión'].includes(label)?'#bd8625':['Baja','Puntuales','Completadas'].includes(label)?'#478b72':colors[i%colors.length];
export function drawMetricChart(canvas,data,type='barras',title='Métricas'){
 const {width,height}=canvas.getBoundingClientRect();if(!width||!height)return;
 const dpr=devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);
 const style=getComputedStyle(document.body),text=style.getPropertyValue('--text').trim()||'#eee',dim=style.getPropertyValue('--text-dim').trim()||'#aaa',bg=style.getPropertyValue('--surface').trim()||'#141414';c.fillStyle=bg;c.fillRect(0,0,width,height);c.fillStyle=text;c.font='600 16px system-ui';c.textAlign='left';c.fillText(title,16,26);
 const fs=document.documentElement.dataset.text==='large'?16:14;
 const fit=(text,max)=>{let s=text;while(s.length>1&&c.measureText(s).width>max)s=s.slice(0,-1);return s===text?s:s.slice(0,-1)+'…';};
 const total=data.reduce((n,d)=>n+d.value,0),max=Math.max(1,...data.map(d=>d.value));
 if(type==='dona'){
 const cx=width/2,cy=height*.34+12,r=Math.min(width*.22,height*.23);let angle=-Math.PI/2;
 data.forEach((d,i)=>{const end=angle+(total?d.value/total:0)*2*Math.PI;c.beginPath();c.strokeStyle=metricColor(d.label,i);c.lineWidth=r*.35;c.arc(cx,cy,r*.72,angle,end);if(d.value)c.stroke();angle=end;});
 c.fillStyle=text;c.textAlign='center';c.font='600 28px system-ui';c.fillText(String(total),cx,cy);c.font=fs+'px system-ui';c.fillStyle=dim;c.fillText(total?'Total':'Sin datos',cx,cy+24);data.forEach((d,i)=>{const x=Math.max(16,width/2-90),y=height-90+i*20;c.fillStyle=metricColor(d.label,i);c.fillRect(x,y-10,10,10);c.fillStyle=text;c.textAlign='left';c.font=fs+'px system-ui';c.fillText(d.label+': '+d.value,x+18,y);});
 }else if(type==='horizontal'){
 const left=Math.min(140,width*.4),top=54,slot=(height-top-16)/data.length;
 data.forEach((d,i)=>{const y=top+i*slot;c.fillStyle=dim;c.textAlign='right';c.font=fs+'px system-ui';c.fillText(d.label,left-12,y+18);const w=(width-left-55)*d.value/max;c.fillStyle=metricColor(d.label,i);c.fillRect(left,y+4,w,Math.min(28,slot*.5));c.fillStyle=text;c.textAlign='left';c.fillText(String(d.value),left+w+8,y+23);});
 }else{
 const left=32,top=58,bottom=70,plotH=height-top-bottom,slot=(width-left-16)/data.length;
 data.forEach((d,i)=>{const h=plotH*d.value/max,x=left+i*slot+slot*.2,w=slot*.6,y=top+plotH-h;c.fillStyle=metricColor(d.label,i);c.fillRect(x,y,w,h);c.fillStyle=text;c.textAlign='center';c.font='600 '+fs+'px system-ui';c.fillText(String(d.value),x+w/2,y-10);c.fillStyle=dim;c.font=fs+'px system-ui';const words=d.label.split(' ');words.forEach((word,j)=>c.fillText(fit(word,slot-8),x+w/2,height-bottom+22+j*18));});
 }
 canvas.setAttribute('aria-label',`${title}. ${data.map(d=>d.label+': '+d.value).join(', ')}`);
}
export const drawBarChart=(canvas,data)=>drawMetricChart(canvas,data,'barras');
