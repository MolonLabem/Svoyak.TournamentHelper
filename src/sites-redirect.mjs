export function redirectBrowser(){
const destination='https://svoyak.sardarka-300.workers.dev';
const path=/^\/t\/[a-zA-Z0-9-]{1,100}$/.test(location.pathname)?location.pathname:'/';
let managementKey=path!=='/'?location.hash.match(/^#manage=([A-Za-z0-9_-]{43})$/)?.[1]:null;
// Keep the capability only in transient memory. Never forward it automatically.
history.replaceState(null,'',location.pathname);
const publicLink=document.querySelector('#public-destination');
publicLink.href=destination+path;
if(managementKey){
  document.querySelector('#recovery-note').hidden=false;
  const button=document.querySelector('#continue-management');button.hidden=false;
  button.addEventListener('click',()=>{
    const fragment='#manage='+managementKey;managementKey=null;
    location.replace(destination+path+fragment);
  },{once:true});
  publicLink.textContent='Открыть только результаты';
}
publicLink.addEventListener('click',()=>{managementKey=null;});
}
