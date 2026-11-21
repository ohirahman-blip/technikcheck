const PHONE='0177 4103884',TEL='tel:+491774103884';
const KEY='technikcheck-customer-device-v1';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const secret=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function mountCustomerPortal(root,api){
  document.title='Technikhilfe';
  let device={};try{device=JSON.parse(localStorage.getItem(KEY)||'{}');}catch{}
  if(!device||typeof device!=='object')device={};
  if(!/^[a-f0-9]{64}$/.test(device.secret||''))delete device.secret;
  if(!/^\d{4}$/.test(device.code||''))delete device.code;
  let busy=false,pin='',pending=false,storageWarning=false;
  function save(){try{localStorage.setItem(KEY,JSON.stringify(device));storageWarning=false;}catch{storageWarning=true;}}
  function frame(html){root.innerHTML=`<main class="customer-app"><header><div class="wordmark customer-wordmark" aria-label="Technik Hilfe"><span>Technik</span><span>Hilfe</span></div></header>${html}</main>`;}
  function offline(){frame(`<section class="customer-stage"><h1>Sie haben wahrscheinlich gerade Internetprobleme.</h1><p>Bitte rufen Sie mich unter <strong>${PHONE}</strong> an.</p><a class="btn primary customer-call" href="${TEL}">Jetzt anrufen</a><button class="text-button" id="retry">Erneut versuchen</button></section>`);root.querySelector('#retry').onclick=()=>start();}
  function unavailable(message){frame(`<section class="customer-stage"><h1>Gerade nicht verfügbar.</h1><p>${escape(message)}</p><button class="text-button" id="back">Zurück</button></section>`);root.querySelector('#back').onclick=()=>start();}
  function handleResult(result){
    if(result?.ok)return true;
    if(result?.code==='invalid_device'){device={};save();pinScreen();return false;}
    if(result?.code==='rate_limited'){unavailable('Bitte warten Sie einen Moment und versuchen Sie es später erneut.');return false;}
    if(result?.code==='invalid_setup')throw new Error('Dieser Einrichtungscode ist ungültig oder abgelaufen. Bitte einen neuen Code von mir verwenden.');
    unavailable('Die Online-Anfrage ist gerade nicht verfügbar. Bitte versuchen Sie es später erneut.');return false;
  }
  function failure(error){
    if(!navigator.onLine)offline();
    else unavailable('Die Anfrage konnte nicht bestätigt werden. Bitte versuchen Sie es später erneut.');
  }
  function home(){
    const name=device.secret&&device.greeting?`Hallo ${escape(device.greeting)}.`:'Willkommen.';
    frame(`<section class="customer-stage"><h1>${name}</h1><p>Sie brauchen Unterstützung?<br>Ich helfe Ihnen gerne.</p><button class="help-button" id="requestHelp"><span class="help-plus">+</span><span>Ich brauche<br>Technikhilfe</span><span class="help-caption">Tippen Sie hier für einen Rückruf</span></button>${storageWarning?'<p class="customer-small">Der Zugang konnte auf diesem Gerät nicht dauerhaft gespeichert werden. Bitte bewahren Sie Ihren vierstelligen Code auf.</p>':''}<p class="customer-small">Ihre Rückrufanfrage wird direkt an mich gesendet.</p></section><button class="setup-link" id="changeCode">${device.secret?'Neueinrichtung':'Anderen Code eingeben'}</button>`);
    root.querySelector('#changeCode').onclick=()=>device.secret?setupScreen():pinScreen();
    root.querySelector('#requestHelp').onclick=send;
  }
  function success(){
    frame(`<section class="customer-stage"><div class="customer-symbol success-symbol">✓</div><h1>Vielen Dank für Ihre Anfrage.</h1><p>Sie werden in Kürze angerufen.</p><div class="request-received"><span></span>Rückruf angefragt</div><p class="customer-small">Sie müssen nichts weiter tun.</p></section>`);
  }
  async function send(){
    if(busy)return;if(!navigator.onLine)return offline();if(!api)return unavailable('Die Online-Anfrage ist noch nicht eingerichtet.');
    busy=true;const b=root.querySelector('#requestHelp');b.disabled=true;b.querySelector('.help-caption').textContent='Anfrage wird gesendet …';
    try{const result=await api.send(device);if(handleResult(result)){pending=true;success();}}catch(error){failure(error);}finally{busy=false;if(b.isConnected)b.disabled=false;}
  }
  function pinScreen(){
    pin='';frame(`<section class="customer-stage pin-stage"><h1>Vierstelligen<br>Code eingeben</h1><p>Bitte geben Sie Ihren persönlichen Rückrufcode ein.</p><div class="pin-entry"><div class="pin-boxes" aria-hidden="true"><span>–</span><span>–</span><span>–</span><span>–</span></div><input id="callbackPin" class="pin-keyboard" type="text" inputmode="none" autocomplete="off" maxlength="4" aria-label="Vierstelliger Rückrufcode"></div><div class="senior-keypad" aria-label="Zahlenfeld">${['1','2','3','4','5','6','7','8','9','','0','⌫'].map(n=>n?`<button type="button" data-digit="${n}" aria-label="${n==='⌫'?'Letzte Zahl löschen':n}">${n}</button>`:'<span></span>').join('')}</div><button class="btn primary customer-call" id="pinContinue" disabled>Weiter</button></section><button class="setup-link" id="setup">Neueinrichtung</button>`);
    const field=root.querySelector('#callbackPin'),next=root.querySelector('#pinContinue');
    const update=value=>{pin=value.replace(/\D/g,'').slice(0,4);field.value=pin;root.querySelectorAll('.pin-boxes span').forEach((s,i)=>{s.textContent=pin[i]||'–';s.classList.toggle('filled',i<pin.length);});next.disabled=pin.length!==4;};
    field.oninput=()=>update(field.value);
    root.querySelectorAll('[data-digit]').forEach(b=>b.onclick=()=>update(b.dataset.digit==='⌫'?pin.slice(0,-1):pin+b.dataset.digit));
    field.onkeydown=e=>{if(e.key==='Enter'&&pin.length===4){e.preventDefault();next.click();}};
    next.onclick=()=>{if(pin.length!==4)return;device={code:pin};save();pending=false;home();};root.querySelector('#setup').onclick=setupScreen;
  }
  function setupScreen(){
    frame(`<section class="customer-stage setup-stage"><h1>Neueinrichtung.</h1><p>Dieser Bereich ist für die gemeinsame Einrichtung mit Ihrem Technikberater.</p><form id="setupForm"><label>Einmaliger Einrichtungscode<textarea name="code" autocomplete="off" autocapitalize="none" spellcheck="false" required placeholder="Langen Einrichtungscode hier einfügen"></textarea></label><button class="btn primary customer-call">Gerät einrichten</button><p role="status" class="setup-status"></p></form><button class="text-button" id="back">Zurück</button></section>`);
    root.querySelector('#back').onclick=()=>device.secret||device.code?home():pinScreen();
    const form=root.querySelector('#setupForm');form.onsubmit=async event=>{
      event.preventDefault();if(!window.validateForm(form)||busy)return;
      if(!navigator.onLine)return offline();if(!api)return unavailable('Die Einrichtung ist noch nicht verfügbar.');
      const code=form.elements.code.value.trim().toLowerCase().replace(/\s/g,'');
      if(!/^[a-f0-9]{48}$/.test(code)){form.querySelector('[role=status]').textContent='Bitte den vollständigen langen Einrichtungscode eingeben.';return;}
      // Save the candidate secret before sending: a dropped response can be retried.
      const candidate=device.setupSecret||secret();device.setupSecret=candidate;save();
      busy=true;const b=form.querySelector('button');b.disabled=true;
      try{const result=await api.enroll(code,candidate);if(handleResult(result)){device={secret:candidate,greeting:result.greeting,code:result.callback_code};save();navigator.storage?.persist?.().catch(()=>{});pending=false;home();}}
      catch(error){if(!navigator.onLine)offline();else form.querySelector('[role=status]').textContent=error.message;}
      finally{busy=false;if(b.isConnected)b.disabled=false;}
    };
  }
  async function start(){
    if(!navigator.onLine)return offline();
    if(device.secret&&api){
      frame('<section class="customer-stage"><div class="customer-loader" aria-hidden="true"></div><h1>Einen Moment …</h1><p>Ihre Technikhilfe wird geöffnet.</p></section>');
      try{const result=await api.status(device.secret);if(!handleResult(result))return;device.greeting=result.greeting;save();pending=result.pending;return pending?success():home();}catch(error){return failure(error);}
    }
    if(device.secret||device.code)return pending?success():home();pinScreen();
  }
  window.addEventListener('offline',offline);
  window.addEventListener('online',()=>{if(!busy)start();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy&&device.secret)start();});
  await start();
}
