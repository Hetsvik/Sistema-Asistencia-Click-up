// Solo apariencia: no copia datos personales ni credenciales al inicio de sesión.
try{const p=JSON.parse(localStorage.getItem('erp:appearance')||'{}');document.documentElement.dataset.theme=p.theme==='light'?'light':'dark';document.documentElement.dataset.text=p.text==='large'?'large':'normal';document.documentElement.style.colorScheme=p.theme==='light'?'light':'dark';}catch{}
