// Custom controls keep their original named values for the existing forms.
let activePicker = null;
let sequence = 0;
const pad = n => String(n).padStart(2, '0');
const dateValue = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
function button(text, cls, action) {
  const b = el('button', cls, text); b.type = 'button';
  if (action) b.addEventListener('click', e => { e.preventDefault(); action(e); });
  return b;
}
function labelFor(input) { return input.closest('label')?.childNodes[0]?.textContent?.trim() || input.name || 'Auswahl'; }
function emit(input) { input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }
function closePicker(focus = false) {
  if (!activePicker) return;
  const { panel, trigger } = activePicker; activePicker = null; panel.remove(); trigger.setAttribute('aria-expanded', 'false');
  if (focus && trigger.isConnected) trigger.focus();
}
window.closeCustomPicker = closePicker;
function openPicker(trigger, width, role = 'dialog') {
  closePicker();
  const panel = el('div', 'custom-popover'); panel.id = `picker-${++sequence}`; panel.setAttribute('role', role); panel.setAttribute('aria-label', trigger.getAttribute('aria-label'));
  const parent = trigger.closest('dialog[open]') || document.body; parent.append(panel);
  trigger.setAttribute('aria-expanded', 'true'); trigger.setAttribute('aria-controls', panel.id);
  activePicker = { panel, trigger };
  const position = () => {
    if (!trigger.isConnected) return closePicker();
    const r = trigger.getBoundingClientRect(), viewport = window.visualViewport;
    const vh = viewport?.height || innerHeight, vy = viewport?.offsetTop || 0;
    const w = Math.min(width || r.width, innerWidth - 24); panel.style.width = `${w}px`;
    panel.style.left = `${Math.max(12, Math.min(r.left, innerWidth - w - 12))}px`;
    panel.style.maxHeight = `${Math.max(140, vh - 24)}px`;
    const height = panel.offsetHeight;
    let top = r.bottom + 8;
    if (top + height > vy + vh - 12) top = Math.max(vy + 12, r.top - height - 8);
    panel.style.top = `${Math.max(vy + 12, Math.min(top, vy + vh - height - 12))}px`;
  };
  activePicker.position = position; requestAnimationFrame(position);
  panel.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(true); }
    if (e.key === 'Tab') {
      const controls = [...panel.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
      const first = controls[0], last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  });
  return panel;
}
document.addEventListener('pointerdown', e => { if (activePicker && !activePicker.panel.contains(e.target) && !activePicker.trigger.contains(e.target)) closePicker(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && activePicker) { e.preventDefault(); e.stopImmediatePropagation(); closePicker(true); } }, true);
window.addEventListener('resize', () => activePicker?.position());
window.visualViewport?.addEventListener('resize', () => activePicker?.position());
document.addEventListener('scroll', e => { if (activePicker && !activePicker.panel.contains(e.target)) activePicker.position(); }, true);
function baseControl(input) {
  input.dataset.enhanced = 'true';
  const label = labelFor(input), wrapper = el('div', 'control'); input.before(wrapper); wrapper.append(input);
  const trigger = button('', 'control-trigger'); trigger.setAttribute('aria-label', label); trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-haspopup', 'dialog');
  wrapper.append(trigger); input.hidden = true; input.tabIndex = -1;
  input.customTrigger = trigger;
  return { wrapper, trigger, label };
}
function triggerText(trigger, text, placeholder, icon = '⌄') {
  trigger.replaceChildren(el('span', text ? '' : 'placeholder', text || placeholder), el('span', 'control-chevron', icon));
}
function enhanceSelect(input) {
  const { trigger, label } = baseControl(input); trigger.setAttribute('aria-haspopup', 'listbox');
  const sync = () => triggerText(trigger, input.value ? input.selectedOptions[0]?.textContent : '', input.options[0]?.textContent || 'Auswählen');
  sync(); input.addEventListener('change', sync);
  trigger.onclick = e => {
    e.preventDefault(); if (activePicker?.trigger === trigger) return closePicker();
    const panel = openPicker(trigger, Math.max(240, trigger.offsetWidth), 'listbox');
    const options = [...input.options];
    options.forEach(option => {
      const b = button('', 'select-option', () => { input.value = option.value; sync(); closePicker(true); emit(input); });
      b.append(el('span', '', option.textContent), el('span', '', option.selected ? '✓' : ''));
      b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(option.selected)); b.disabled = option.disabled;
      panel.append(b);
    });
    const choices = [...panel.querySelectorAll('button:not(:disabled)')];
    panel.addEventListener('keydown', event => {
      const i = choices.indexOf(document.activeElement); let next;
      if (event.key === 'ArrowDown') next = (i + 1) % choices.length;
      if (event.key === 'ArrowUp') next = (i - 1 + choices.length) % choices.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = choices.length - 1;
      if (next !== undefined) { event.preventDefault(); choices[next]?.focus(); }
      else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        const reordered = choices.slice(i + 1).concat(choices.slice(0, i + 1));
        reordered.find(b => b.textContent.trim().toLowerCase().startsWith(event.key.toLowerCase()))?.focus();
      }
    });
    requestAnimationFrame(() => (panel.querySelector('[aria-selected=true]:not(:disabled)') || choices[0])?.focus());
  };
  trigger.addEventListener('keydown', e => { if (['ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); trigger.click(); } });
}
function enhanceDate(input) {
  const withTime = input.type === 'datetime-local'; input.dataset.dateType = input.type;
  const { trigger } = baseControl(input); input.type = 'hidden';
  const sync = () => {
    let text = '';
    if (input.value) { const d = new Date(withTime ? input.value : input.value + 'T12:00'); if (!isNaN(d)) text = new Intl.DateTimeFormat('de-DE', { day:'2-digit', month:'short', year:'numeric', ...(withTime ? { hour:'2-digit', minute:'2-digit' } : {}) }).format(d); }
    triggerText(trigger, text, withTime ? 'Datum & Uhrzeit wählen' : 'Datum wählen', '⌄');
  };
  sync(); input.addEventListener('change', sync);
  trigger.onclick = e => {
    e.preventDefault(); if (activePicker?.trigger === trigger) return closePicker();
    const panel = openPicker(trigger, 326);
    const initial = input.value ? new Date(withTime ? input.value : input.value + 'T12:00') : new Date();
    let selected = isNaN(initial) ? new Date() : initial;
    let month = new Date(selected.getFullYear(), selected.getMonth(), 1);
    let hours = selected.getHours(), minutes = selected.getMinutes();
    const commit = () => { input.value = dateValue(selected) + (withTime ? `T${pad(hours)}:${pad(minutes)}` : ''); sync(); closePicker(true); emit(input); };
    function renderCalendar(focusDate) {
      panel.replaceChildren();
      const head = el('div', 'calendar-head');
      const previous = button('‹', '', () => { month.setMonth(month.getMonth() - 1); renderCalendar(); panel.querySelector('.calendar-head button')?.focus(); }); previous.setAttribute('aria-label','Vorheriger Monat');
      const next = button('›', '', () => { month.setMonth(month.getMonth() + 1); renderCalendar(); panel.querySelector('.calendar-head button:last-child')?.focus(); }); next.setAttribute('aria-label','Nächster Monat');
      head.append(previous, el('span', '', new Intl.DateTimeFormat('de-DE', { month:'long', year:'numeric' }).format(month)), next); panel.append(head);
      const grid = el('div', 'calendar-grid');
      ['Mo','Di','Mi','Do','Fr','Sa','So'].forEach(d => grid.append(el('span', 'calendar-weekday', d)));
      const first = new Date(month); first.setDate(1 - (month.getDay() + 6) % 7);
      for (let i = 0; i < 42; i++) {
        const d = new Date(first); d.setDate(first.getDate() + i); const key = dateValue(d);
        const classes = ['calendar-day', d.getMonth() !== month.getMonth() ? 'outside' : '', key === dateValue(selected) ? 'selected' : '', key === dateValue(new Date()) ? 'today' : ''].join(' ');
        const day = button(d.getDate(), classes, () => { selected = d; month = new Date(d.getFullYear(), d.getMonth(), 1); renderCalendar(key); });
        day.dataset.date = key; day.setAttribute('aria-label', new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d)); day.setAttribute('aria-pressed', String(key === dateValue(selected)));
        day.tabIndex = key === dateValue(selected) ? 0 : -1;
        day.onkeydown = event => {
          const offsets = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7 };
          if (event.key in offsets) { event.preventDefault(); const target = new Date(d); target.setDate(target.getDate() + offsets[event.key]); selected = target; month = new Date(target.getFullYear(),target.getMonth(),1); renderCalendar(dateValue(target)); }
        };
        grid.append(day);
      }
      panel.append(grid);
      if (withTime) {
        const time = el('div', 'picker-time'); time.append(el('span', '', 'Uhrzeit')); const parts = el('div', 'time-parts');
        function part(label, max, get, set) {
          const wrap = el('div','time-part'); const field = el('input'); field.type = 'text'; field.inputMode = 'numeric'; field.maxLength = 2; field.value = pad(get()); field.setAttribute('aria-label',label);
          const change = n => { set((n + max + 1) % (max + 1)); field.value = pad(get()); };
          const minus = button('−','',()=>change(get()-1)), plus = button('+','',()=>change(get()+1)); minus.setAttribute('aria-label',label+' verringern'); plus.setAttribute('aria-label',label+' erhöhen');
          field.oninput = () => { field.value = field.value.replace(/\D/g,'').slice(0,2); set(Math.min(max,Number(field.value)||0)); }; field.onblur = () => field.value=pad(get());
          field.onkeydown = event => { if (event.key==='ArrowUp'||event.key==='ArrowDown') {event.preventDefault();change(get()+(event.key==='ArrowUp'?1:-1));} if(event.key==='Enter'){event.preventDefault();commit();} };
          wrap.append(minus,field,plus); return wrap;
        }
        parts.append(part('Stunden',23,()=>hours,n=>hours=n),el('span','',':'),part('Minuten',59,()=>minutes,n=>minutes=n));time.append(parts);panel.append(time);
      }
      const footer=el('div','picker-footer');
      footer.append(button('Heute','btn ghost',()=>{selected=new Date();month=new Date(selected.getFullYear(),selected.getMonth(),1);renderCalendar(dateValue(selected));}));
      if (!input.required) footer.append(button('Leeren','btn ghost',()=>{input.value='';sync();closePicker(true);emit(input);}));
      footer.append(button('Übernehmen','btn primary',commit));panel.append(footer);
      requestAnimationFrame(()=>{activePicker?.position();if(focusDate)panel.querySelector(`[data-date="${focusDate}"]`)?.focus();});
    }
    renderCalendar(); requestAnimationFrame(()=>panel.querySelector('.calendar-day.selected')?.focus());
  };
}
function enhanceNumber(input) {
  input.dataset.enhanced='true';input.dataset.numeric='true'; input.type='text';input.inputMode='decimal';
  const wrapper=el('div','control number-control');input.before(wrapper);wrapper.append(input);
  const controls=el('div','step-controls');const step=Number(input.getAttribute('step'))||1;const min=input.getAttribute('min'),max=input.getAttribute('max');const name=labelFor(input);
  function change(direction){let value=Number(input.value.replace(',','.'))||0;value+=direction*step;if(min!==null)value=Math.max(Number(min),value);if(max!==null)value=Math.min(Number(max),value);input.value=String(Number(value.toFixed(5)));emit(input);input.focus();}
  const minus=button('−','',()=>change(-1)),plus=button('+','',()=>change(1));minus.setAttribute('aria-label',name+' verringern');plus.setAttribute('aria-label',name+' erhöhen');controls.append(minus,plus);wrapper.append(controls);
  input.addEventListener('change',()=>{input.value=input.value.replace(',','.').trim();});
  input.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();change(e.key==='ArrowUp'?1:-1);}});
}
function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach(n=>n.remove());form.querySelectorAll('.invalid').forEach(n=>n.classList.remove('invalid'));
  form.querySelectorAll('[aria-invalid]').forEach(n=>{n.removeAttribute('aria-invalid');n.removeAttribute('aria-describedby');});
}
window.validateForm = form => {
  clearErrors(form);let first=null;
  for(const input of form.querySelectorAll('input,select,textarea')) {
    if(input.disabled||input.type==='file')continue;
    let error='';
    if(input.dataset.numeric){input.value=input.value.replace(',','.').trim();if(input.value&&(!Number.isFinite(Number(input.value))||(input.hasAttribute('min')&&Number(input.value)<Number(input.min))||(input.hasAttribute('max')&&Number(input.value)>Number(input.max))))error='Bitte einen gültigen Wert eingeben.';}
    if(input.required&&(!input.value.trim()||(input.type==='checkbox'&&!input.checked)))error='Bitte dieses Feld ausfüllen.';
    if(!error&&input.type!=='hidden'&&!input.checkValidity())error=input.type==='email'?'Bitte eine gültige E-Mail-Adresse eingeben.':input.minLength>0&&input.value.length<input.minLength?`Bitte mindestens ${input.minLength} Zeichen eingeben.`:'Bitte die Eingabe korrigieren.';
    if(!error)continue;
    const target=input.customTrigger||input,wrapper=input.closest('.control')||input;const message=el('span','field-error',error);message.id=`error-${++sequence}`;wrapper.after(message);wrapper.classList.add('invalid');target.setAttribute('aria-invalid','true');target.setAttribute('aria-describedby',message.id);first ||= target;
  }
  first?.focus();return !first;
};
document.addEventListener('submit',e=>{if(e.target instanceof HTMLFormElement&&!window.validateForm(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
window.enhanceControls = (root=document) => {
  root.querySelectorAll('form').forEach(f=>f.noValidate=true);
  root.querySelectorAll('select:not([data-enhanced]),input[type=date]:not([data-enhanced]),input[type=datetime-local]:not([data-enhanced]),input[type=number]:not([data-enhanced])').forEach(input=>{
    if(input.tagName==='SELECT')enhanceSelect(input);else if(input.type==='number')enhanceNumber(input);else enhanceDate(input);
  });
};
new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length))window.enhanceControls();if(activePicker&&!activePicker.trigger.isConnected)closePicker();}).observe(document.body,{childList:true,subtree:true});
window.enhanceControls();
window.askConfirmation = message => new Promise(resolve=>{
  closePicker();const dialog=el('dialog','confirm-sheet');const heading=el('h2','','Kurz bestätigen');heading.id=`confirm-${++sequence}`;dialog.setAttribute('aria-labelledby',heading.id);
  const actions=el('div','actions');let settled=false;
  const finish=value=>{if(settled)return;settled=true;dialog.close();dialog.remove();resolve(value);};
  actions.append(button('Abbrechen','btn',()=>finish(false)),button('Bestätigen','btn primary',()=>finish(true)));dialog.append(heading,el('p','',message),actions);document.body.append(dialog);
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});dialog.addEventListener('click',e=>{if(e.target===dialog)finish(false);});dialog.showModal();actions.firstChild.focus();
});
