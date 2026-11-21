import './controls.js';
import { createClient } from '@supabase/supabase-js';
import { createLocalStore, createCloudStore } from './storage.js';
import { createPortalApi } from './portal-api.js';

const panel=document.querySelector('#entryPanel');
const url=import.meta.env.VITE_SUPABASE_URL?.trim();
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const admin=/^\/admin\/?$/.test(location.pathname);
function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Die Anwendung konnte nicht geladen werden. Bitte neu laden.'));document.body.append(s);});}
async function mount(store,client){
  window.technikData=store;window.technikPortal=client?createPortalApi(client):null;window.portalRequests=[];
  panel.replaceChildren();document.body.classList.remove('loading');
  document.querySelector('#storageLabel').textContent=client?'Mit deinem Konto in Supabase gespeichert.':'Lokale Vorschau · nur in diesem Browser gespeichert.';
  const controls=document.querySelector('#accountControls');controls.replaceChildren();
  const button=document.createElement('button');button.className='btn small';button.textContent=client?'Abmelden':'Vorschau verlassen';
  button.onclick=async()=>{if(client){const {error}=await client.auth.signOut();if(error){window.popup?.(error.message,true);return;}}location.href='/admin';};controls.append(button);
  if(!client){const note=document.createElement('div');note.className='mode-note';note.textContent='Lokale Vorschau ohne Anmeldung. Kundenanfragen und Einrichtungscodes benötigen Supabase.';controls.append(note);}
  const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/maplibre-gl.css';document.head.append(css);
  await loadScript('/vendor/maplibre-gl.js');await loadScript('/vendor/pmtiles.js');await loadScript('/map/style.js');await loadScript('/portal-admin.js');await loadScript('/ui.js');
  if(client){client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.href='/admin';});setInterval(()=>{if(!document.hidden)window.dispatchEvent(new Event('technikplan-data-changed'));},30000);}
}
function login(client,message=''){
  panel.innerHTML='<form class="card auth-form"><a class="auth-home" href="/">← Zur Kundenseite</a><div class="wordmark" aria-label="Technik Hilfe"><span>Technik</span><span>Hilfe</span></div><div><div class="eyebrow">NUR FÜR DIE VERWALTUNG</div><h1>Willkommen<br>zurück.</h1></div><p>Melde dich an, um Anfragen, Kunden und Termine zu verwalten.</p><label>E-Mail<input name="email" type="email" autocomplete="username" required></label><label>Passwort<input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary" type="submit">Anmelden</button><button type="button" class="text-button" id="resetPassword">Passwort vergessen?</button><p class="status-note" role="status"></p></form>';
  const form=panel.querySelector('form'),status=form.querySelector('[role=status]');status.textContent=message;
  if(!client)status.textContent='Supabase ist noch nicht verbunden. Bitte .env.local und die Datenbank einrichten. Der Login ist vorbereitet.';
  if(import.meta.env.DEV&&!client){const link=document.createElement('a');link.href='/admin?demo=1';link.className='btn';link.textContent='Lokale Verwaltung ansehen';form.append(link);}
  form.onsubmit=async event=>{
    event.preventDefault();if(!window.validateForm(form)||!client)return;
    const submit=form.querySelector('[type=submit]');submit.disabled=true;status.textContent='Anmeldung läuft …';
    try{const {error}=await client.auth.signInWithPassword(Object.fromEntries(new FormData(form)));if(error)throw error;await authorizedMount(client);}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}
  };
  form.querySelector('#resetPassword').onclick=async()=>{
    if(!client)return;const email=form.elements.email.value.trim();if(!email||!form.elements.email.checkValidity()){status.textContent='Bitte zuerst eine gültige E-Mail-Adresse eingeben.';form.elements.email.focus();return;}
    const b=form.querySelector('#resetPassword');b.disabled=true;
    try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/admin?recovery=1'});if(error)throw error;status.textContent='Falls ein Konto besteht, erhältst du einen Link zum Zurücksetzen.';}catch(error){status.textContent=error.message;}finally{b.disabled=false;}
  };
}
async function authorizedMount(client){
  const {data:{session},error}=await client.auth.getSession();if(error)throw error;if(!session)return login(client);
  const {data:allowed,error:accessError}=await client.rpc('is_technik_admin');
  if(accessError)throw new Error('Die Verwaltungsfreigabe fehlt noch. Bitte die Portal-Migration und die Admin-Einrichtung aus der Anleitung ausführen.');
  if(!allowed){await client.auth.signOut();return login(client,'Dieses Konto ist nicht für die Verwaltung freigegeben.');}
  await mount(createCloudStore(client,session.user.id),client);
}
function resetPassword(client){
  panel.innerHTML='<form class="card auth-form"><div class="eyebrow">VERWALTUNG</div><h1>Neues Passwort.</h1><label>Passwort<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><button class="btn primary">Passwort speichern</button><p role="status"></p><a href="/admin">Zur Anmeldung</a></form>';
  const form=panel.querySelector('form');form.onsubmit=async e=>{e.preventDefault();if(!window.validateForm(form))return;const b=form.querySelector('button');b.disabled=true;try{const {error}=await client.auth.updateUser({password:form.elements.password.value});if(error)throw error;history.replaceState(null,'','/admin');await authorizedMount(client);}catch(error){form.querySelector('[role=status]').textContent=error.message;}finally{b.disabled=false;}};
}
async function start(){
  let client=null;
  if(url||key){
    if(!url||!key||!url.startsWith('https://'))throw new Error('Supabase-Konfiguration unvollständig. Bitte .env.local ergänzen.');
    if(key.startsWith('sb_secret_'))throw new Error('Bitte ausschließlich den öffentlichen Supabase Publishable Key verwenden.');
    if(key.startsWith('eyJ')){let payload;try{payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{}if(payload?.role==='service_role')throw new Error('Service-Role-Schlüssel sind im Browser nicht erlaubt.');}
    client=createClient(url,key);
  }
  if(!admin){document.body.classList.add('customer-page');const {mountCustomerPortal}=await import('./customer.js');await mountCustomerPortal(panel,client?createPortalApi(client):null);return;}
  document.title='Verwaltung · Technikcheck';
  if(!client){if(import.meta.env.DEV&&new URLSearchParams(location.search).get('demo')==='1')return mount(await createLocalStore(),null);return login(null);}
  if(new URLSearchParams(location.search).get('recovery')==='1'){const {data:{session}}=await client.auth.getSession();if(session)return resetPassword(client);return login(client,'Der Link ist abgelaufen. Bitte einen neuen Link anfordern.');}
  await authorizedMount(client);
}
start().catch(error=>{panel.replaceChildren();const note=document.createElement('p');note.className='notice';note.textContent=error.message;panel.append(note);const retry=document.createElement('a');retry.href=admin?'/admin':'/';retry.className='btn';retry.textContent='Neu laden';panel.append(retry);});
if('serviceWorker' in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});});
