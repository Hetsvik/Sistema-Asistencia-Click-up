// Scripts externos locales; estilos inline necesarios para componentes existentes.
export const CSP="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";
export function secureResponse(response){
 const headers=new Headers(response.headers);
 if(!headers.has('Content-Security-Policy'))headers.set('Content-Security-Policy',CSP);
 headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');
 headers.set('Referrer-Policy','no-referrer');headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
