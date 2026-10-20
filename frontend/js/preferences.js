export const DEFAULT_PREFERENCES={assignments:true,status:true,text:'normal'};
const key=user=>`erp:preferences:${user.empleado_id}`;
export function readPreferences(user){try{const p=JSON.parse(localStorage.getItem(key(user))||'{}');return {assignments:p.assignments!==false,status:p.status!==false,text:p.text==='large'?'large':'normal'};}catch{return {...DEFAULT_PREFERENCES};}}
export function savePreferences(user,p){try{localStorage.setItem(key(user),JSON.stringify(p));applyPreferences(user);document.dispatchEvent(new Event('erp:preferences'));return true;}catch{return false;}}
export function applyPreferences(user){document.documentElement.dataset.text=readPreferences(user).text;}
export function noticeVisible(n,p){return n.tipo==='Asignada'?p.assignments:p.status;}
