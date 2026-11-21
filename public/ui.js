
'use strict';
let state={customers:[],appointments:[],tasks:[]},view='dashboard',search='',filter='aktuell',period='monat',calendarMode='woche',calendarDate=new Date(),map=null,editMap=null,editMarker=null,toastTimer;
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format((c||0)/100);
const fmt=d=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(d));
const clock=d=>new Intl.DateTimeFormat('de-DE',{hour:'2-digit',minute:'2-digit'}).format(new Date(d));
const now=()=>new Date(), localISO=d=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,16)};
const customer=id=>state.customers.find(c=>c.id===Number(id))||{name:'Unbekannt',address:'',phone:''};
const active=()=>state.appointments.filter(a=>!['erledigt','abgesagt'].includes(a.status));
function popup(message,bad=false){const t=$('#toast');t.textContent=message;t.classList.toggle('error',bad);t.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),3500)}
async function api(path,method='GET',body){return window.technikData.request(path,method,body);}
async function refresh(){try{state=await api('data');await loadPortalRequests();render()}catch(e){popup(e.message,true);if(!$('#content').innerHTML)$('#content').innerHTML='<div class="notice">'+esc(e.message)+'</div>';}}
function setView(v){window.closeCustomPicker?.();view=v;search='';document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));render();const content=$('#content');content.classList.remove('page-enter');void content.offsetWidth;content.classList.add('page-enter')}
const titles={requests:['Deine Anfragen.','Rückrufe und neue Aufträge übersichtlich abarbeiten.'],dashboard:['Guten Überblick.','Dein Tag, deine Kunden, dein nächster Schritt.'],calendar:['Deine Termine.','Plane deine Besuche mit genügend Zeit dazwischen.'],customers:['Deine Kunden.','Kontaktdaten und bisherige Arbeiten an einem Ort.'],tasks:['Offene Aufgaben.','Was noch erledigt werden muss.'],finance:['Deine Zahlen.','Vereinbarte Beträge, Zahlungen und direkte Kosten.'],archive:['Einsatzarchiv.','Abgeschlossene und abgesagte Termine.']};
function render(){if(map){map.remove();map=null}$('#pageTitle').textContent=titles[view][0];$('#pageSub').textContent=titles[view][1];let f={requests:requestsView,dashboard:dashboard,calendar:calendar,customers:customers,tasks:tasks,finance:finance,archive:archive}[view];$('#content').innerHTML=f();window.enhanceControls?.($('#content'));if((view==='dashboard'||view==='calendar')&&$('#mainMap'))setTimeout(drawMap,50)}
function metric(label,value,note){return `<div class="card metric"><div class="label">${label}</div><b>${value}</b><small>${note}</small></div>`}
function nextVisits(){return active().filter(a=>new Date(a.ends_at)>=now()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))}
function stationBadge(c){const s=window.nearestRailStation?.(c.lat,c.lng);return s?`<span class="station-inline"><span class="rail-icon ${s.kind==='U'?'rail-u':'rail-s'}">${s.kind}</span> ${esc(s.name)} · ca. ${s.meters} m Luftlinie</span>`:'';}
function dashEntry(a){let c=customer(a.customer_id);return `<div class="entry"><div class="time">${fmt(a.starts_at)}<br>${clock(a.starts_at)}</div><main><b>${esc(a.title)}</b> <span class="badge ${esc(a.status)}">${esc(a.status)}</span><p>${esc(c.name)} · ${esc(c.address||'Keine Adresse')}</p>${stationBadge(c)}</main><div class="rowactions">${c.phone?`<a class="btn small" href="tel:${encodeURIComponent(c.phone)}">Anrufen</a>`:''}${c.address?`<a class="btn small" href="https://www.openstreetmap.org/directions?route=;${encodeURIComponent(c.address)}" target="_blank" rel="noopener">Route <svg class="ui-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></a>`:''}<button class="btn small" onclick="appointmentForm(${a.id})">Öffnen</button></div></div>`}
function progressSummary(){const tasksDone=state.tasks.filter(t=>t.done).length,taskTotal=state.tasks.length,finished=state.appointments.filter(a=>a.status==='erledigt'),billed=finished.reduce((n,a)=>n+a.price_cents,0),paid=finished.reduce((n,a)=>n+a.paid_cents,0),outer=taskTotal?tasksDone/taskTotal*100:0,inner=billed?Math.min(100,paid/billed*100):0;return `<section class="card progress-hero"><div><div class="eyebrow">Schritt für Schritt</div><h2>Alles im Blick.<br>Mehr geschafft.</h2><p>Deine Aufgaben und Zahlungen. Ein Überblick, der mit dir wächst.</p></div><svg class="progress-rings" viewBox="0 0 200 200" role="img" aria-label="${tasksDone} von ${taskTotal} Aufgaben erledigt, ${Math.round(inner)} Prozent der vereinbarten Beträge bezahlt"><circle class="track" cx="100" cy="100" r="78"/><circle class="arc" cx="100" cy="100" r="78" pathLength="100" stroke="#bcbcbc" stroke-dasharray="${outer} 100" style="opacity:${outer?1:0}"/><circle class="track" cx="100" cy="100" r="51"/><circle class="arc" cx="100" cy="100" r="51" pathLength="100" stroke="#17151a" stroke-dasharray="${inner} 100" style="opacity:${inner?1:0}"/></svg><div class="ring-stats"><div class="ring-stat"><div><span><i class="legend-dot"></i>Aufgaben erledigt</span><span>${tasksDone} <span class="muted">/ ${taskTotal}</span></span></div><small>${taskTotal-tasksDone} noch offen</small></div><div class="ring-stat"><div><span><i class="legend-dot dark"></i>Zahlungen erhalten</span><span>${Math.round(inner)} %</span></div><small>${money(paid)} von ${money(billed)} · erledigte Einsätze</small></div></div></section>`}
function dashboard(){let upcoming=nextVisits(),open=state.tasks.filter(t=>!t.done),done=state.appointments.filter(a=>a.status==='erledigt'),earned=done.reduce((n,a)=>n+a.paid_cents,0);return `${progressSummary()}<div class="grid metrics">${metric('Nächste Termine',upcoming.length,'Geplant oder bestätigt')}${metric('Offene Aufgaben',open.length,'Bei deinen Kunden')}${metric('Erhalten',money(earned),'Aus erledigten Einsätzen')}${metric('Offene Zahlungen',money(done.reduce((n,a)=>n+a.price_cents-a.paid_cents,0)),'Aus erledigten Einsätzen')}</div><div class="grid feature"><section class="card"><div class="sectionhead"><h2>Als Nächstes</h2><button class="btn small ghost" onclick="setView('calendar')">Alle Termine <svg class="ui-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button></div><div class="stack">${upcoming.length?upcoming.slice(0,5).map(dashEntry).join(''):'<div class="empty">Noch keine anstehenden Termine. Lege deinen ersten Termin an.</div>'}</div></section><section class="card"><div class="sectionhead"><h2>Deine Karte</h2><span>Alle Kundenstandorte</span></div><div id="mainMap" class="map"></div><p class="mapinfo">Alle gesetzten Kunden-Pins erscheinen hier automatisch. Die Basiskarte ist offline; ÖPNV-Stationen werden separat abgefragt.</p></section></div><section class="card" style="margin-top:17px"><div class="sectionhead"><h2>Das ist noch offen</h2><button class="btn small ghost" onclick="setView('tasks')">Alle Aufgaben <svg class="ui-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button></div><div class="stack">${open.length?open.slice(0,4).map(taskEntry).join(''):'<div class="empty">Keine offenen Aufgaben. Gut so.</div>'}</div></section>`}
function applyLightMapTheme(style){
 const colors={background:'#ffffff',earth:'#fafbfc',landcover:'#f6f8f5',landuse_park:'#eaf5e9',landuse_urban_green:'#eaf5e9',landuse_hospital:'#f8eeee',landuse_industrial:'#f3f4f6',landuse_school:'#f3f6fa',landuse_beach:'#fff7e7',landuse_zoo:'#eef5eb',landuse_aerodrome:'#f3f4f6',water:'#d9edf7',waterway:'#b8dceb'};
 for(const layer of style.layers){
  const id=layer.id,paint=layer.paint||{},type=layer.type;
  if(type==='background'){paint['background-color']='#ffffff';continue;}
  if(type==='fill'){
   if(id.includes('building'))paint['fill-color']='#e9edf1';
   else if(id.includes('water'))paint['fill-color']='#d9edf7';
   else paint['fill-color']=colors[id]|| (id.includes('park')||id.includes('green')?'#eaf5e9':'#f6f7f9');
   if(paint['fill-outline-color'])paint['fill-outline-color']='#d9dee3';
  }
  if(type==='line'){
   if(id==='roads_rail'){paint['line-color']='#426d9b';paint['line-opacity']=.9;paint['line-width']=['interpolate',['linear'],['zoom'],9,1.2,13,2.2,17,3.4];}
   else if(id.includes('water'))paint['line-color']='#b8dceb';
   else if(id.includes('road')||id.includes('bridge')||id.includes('tunnel')){
    paint['line-color']=id.includes('highway')||id.includes('major')?'#d4dbe1':'#e4e9ed';
   } else paint['line-color']='#d7dde2';
  }
  if(type==='symbol'){
   if(paint['text-color'])paint['text-color']='#55616c';
   if(paint['text-halo-color'])paint['text-halo-color']='#ffffff';
   if(paint['icon-color'])paint['icon-color']='#617180';
  }
  if(type==='circle'){
   if(paint['circle-color'])paint['circle-color']='#758799';
   if(paint['circle-stroke-color'])paint['circle-stroke-color']='#ffffff';
  }
 }
 return style;
}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-map-customer]');if(btn)showCustomer(Number(btn.dataset.mapCustomer));});
const berlinBounds=[[13.075,52.335],[13.765,52.685]];
if(window.maplibregl&&window.pmtiles){const protocol=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',protocol.tile);}
function makeOfflineMap(container,center=[13.405,52.52],zoom=10){
 const style=applyLightMapTheme(JSON.parse(JSON.stringify(window.offlineMapStyle)));
 style.sources.berlin.url='pmtiles://'+location.origin+'/map/berlin.pmtiles';
 style.glyphs=location.origin+style.glyphs;style.sprite=location.origin+style.sprite;
 const m=new maplibregl.Map({container,style,center,zoom,minZoom:9,maxZoom:18,maxBounds:berlinBounds,attributionControl:true});
 m.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
 m.on('error',e=>{console.warn('Kartenfehler',e.error);if(!document.querySelector('#'+container+' .offline-error')){let note=document.createElement('div');note.className='offline-error';note.style.cssText='position:absolute;bottom:28px;left:10px;right:10px;z-index:5;background:#392b26;padding:8px;border-radius:8px;color:#f0c9b2;font-size:11px';note.textContent='Ein Kartenteil konnte nicht geladen werden. Prüfe, ob der vollständige map-Ordner neben der App liegt.';document.getElementById(container).append(note)}});
 return m;
}
function formatVisitDate(value){return new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(value));}
function mapPopup(c,station){
 const visits=state.appointments.filter(a=>a.customer_id===c.id&&!['abgesagt','erledigt'].includes(a.status)).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 const next=visits.find(a=>new Date(a.ends_at)>=now());
 const appointment=next?`<div class="map-popup-visit"><div class="map-popup-label">NÄCHSTER TERMIN</div><strong>${esc(next.title)}</strong><div>${esc(formatVisitDate(next.starts_at))}</div><div class="map-popup-time">${clock(next.starts_at)} – ${clock(next.ends_at)} Uhr</div><span class="map-popup-status">${esc(next.status)}</span></div>`:'<div class="map-popup-no-visit">Kein bevorstehender Termin</div>';
 const stationLine=station?`<div class="map-popup-transit"><span class="rail-icon ${station.kind==='U'?'rail-u':'rail-s'}">${station.kind}</span><span>${esc(station.name)}<small>ca. ${station.meters} m Luftlinie</small></span></div>`:'';
 return `<div class="map-popup-card"><span class="map-popup-label">KUNDENSTANDORT</span><h3>${esc(c.name)}</h3><p>${esc(c.address||'Keine Adresse')}</p>${appointment}${stationLine}<button class="map-popup-action" type="button" data-map-customer="${c.id}">Kundenprofil öffnen</button></div>`;
}
function drawMap(){let el=$('#mainMap');if(!el)return;if(!window.maplibregl||!window.offlineMapStyle){el.innerHTML='<div class="empty">Kartendateien fehlen. Bitte das gesamte Paket entpacken.</div>';return}
 map=makeOfflineMap('mainMap');let ids=new Set(active().map(a=>a.customer_id)),bounds=new maplibregl.LngLatBounds(),stationKeys=new Set();let count=0;
 state.customers.filter(c=>(view==='dashboard'?!c.archived:ids.has(c.id))&&c.lat!=null&&c.lng!=null).forEach(c=>{
  const point=[Number(c.lng),Number(c.lat)],station=window.nearestRailStation?.(c.lat,c.lng);
  
  new maplibregl.Marker({color:'#c62828'}).setLngLat(point).setPopup(new maplibregl.Popup({offset:22,maxWidth:'330px',className:'technik-map-popup'}).setHTML(mapPopup(c,station))).addTo(map);
  if(station&&!stationKeys.has(station.kind+station.name)){
    stationKeys.add(station.kind+station.name);
    const marker=document.createElement('div');marker.className='rail-map-marker '+(station.kind==='U'?'rail-u':'rail-s');marker.textContent=station.kind;
    marker.setAttribute('aria-label',station.kind+'-Bahnhof '+station.name);
    new maplibregl.Marker({element:marker,anchor:'center'}).setLngLat([station.lng,station.lat]).setPopup(new maplibregl.Popup().setText(station.kind+'-Bahnhof '+station.name)).addTo(map);
  }
  bounds.extend(point);count++;
 });
 if(count)map.fitBounds(bounds,{padding:55,maxZoom:14,duration:0});
}

function shiftCalendar(n){let d=new Date(calendarDate);if(calendarMode==='tag')d.setDate(d.getDate()+n);else if(calendarMode==='woche')d.setDate(d.getDate()+7*n);else {d.setDate(1);d.setMonth(d.getMonth()+n)}calendarDate=d;render()}
function calendar(){
 let begin=new Date(calendarDate);begin.setHours(0,0,0,0);
 if(calendarMode==='woche')begin.setDate(begin.getDate()-(begin.getDay()+6)%7);
 if(calendarMode==='monat')begin.setDate(1);
 let end=new Date(begin);
 if(calendarMode==='tag')end.setDate(end.getDate()+1);
 else if(calendarMode==='woche')end.setDate(end.getDate()+7);
 else end.setMonth(end.getMonth()+1);
 let rows=active().filter(a=>{let d=new Date(a.starts_at),q=search.toLowerCase();return d>=begin&&d<end&&(!q||(`${a.title} ${customer(a.customer_id).name} ${customer(a.customer_id).address}`).toLowerCase().includes(q))}).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
 let groups=new Map();for(let a of rows){let key=a.starts_at.slice(0,10);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a)}
 let label=calendarMode==='monat'?new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(begin):calendarMode==='tag'?fmt(begin):`${fmt(begin)} – ${fmt(new Date(end.getTime()-86400000))}`;
 return `<div class="filterbar"><input id="search" placeholder="Termin, Kunde oder Adresse suchen" value="${esc(search)}"><button class="btn small" onclick="taskForm()">+ Aufgabe</button><div class="tabs" style="margin:0">${['tag','woche','monat'].map(m=>`<button class="${calendarMode===m?'active':''}" onclick="calendarMode='${m}';render()">${{tag:'Tag',woche:'Woche',monat:'Monat'}[m]}</button>`).join('')}</div></div><div class="filterbar"><button class="btn small" onclick="shiftCalendar(-1)"><svg class="ui-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H5m6-6-6 6 6 6"/></svg></button><button class="btn small" onclick="calendarDate=new Date();render()">Heute</button><button class="btn small" onclick="shiftCalendar(1)"><svg class="ui-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button><strong>${esc(label)}</strong></div><div class="split"><section class="card"><div class="sectionhead"><h2>Geplant & bestätigt</h2><span>${rows.length} Termine</span></div>${rows.length?[...groups].map(([day,items])=>`<div class="day">${fmt(day+'T12:00')}</div><div class="stack">${items.map(dashEntry).join('')}</div>`).join(''):'<div class="empty">Keine passenden Termine in diesem Zeitraum.</div>'}</section><section class="card"><div class="sectionhead"><h2>Auf der Karte</h2></div><div id="mainMap" class="map"></div><p class="mapinfo">Kunden-Pins zeigen beim Antippen die nächste U- oder S-Bahn-Station.</p></section></div>`
}
function customers(){let rows=state.customers.filter(c=>(filter==='archiviert'?c.archived:!c.archived)&&(`${c.name} ${c.phone} ${c.address}`).toLowerCase().includes(search.toLowerCase()));return `<div class="filterbar"><input id="search" placeholder="Name, Telefon oder Adresse suchen" value="${esc(search)}"><div class="tabs" style="margin:0"><button class="${filter==='aktuell'?'active':''}" onclick="filter='aktuell';render()">Aktive Kunden</button><button class="${filter==='archiviert'?'active':''}" onclick="filter='archiviert';render()">Archivierte Kunden</button></div></div><div class="customergrid">${rows.map(c=>`<article class="card customer" onclick="showCustomer(${c.id})"><div class="customerline"><div class="avatar">${esc(c.name[0]?.toUpperCase())}</div><div><h3>${esc(c.name)}</h3><span class="muted">${esc(c.phone||'Keine Telefonnummer')}</span></div></div><p>${esc(c.address||'Noch keine Adresse')}</p><div class="chips"><span class="badge">${state.appointments.filter(a=>a.customer_id===c.id).length} Termine</span><span class="badge">${state.tasks.filter(t=>t.customer_id===c.id&&!t.done).length} offen</span>${c.lat==null?'<span class="badge">Kein Kartenpunkt</span>':''}</div></article>`).join('')||'<div class="empty">Noch keine Kunden gefunden.</div>'}</div>`}
function taskEntry(t){let c=customer(t.customer_id);return `<div class="entry"><label class="check"><input type="checkbox" ${t.done?'checked':''} onchange="toggleTask(${t.id},this.checked)"><span class="${t.done?'done':''}"><b>${esc(t.title)}</b><p>${esc(c.name)}${t.due_date?' · Fällig '+fmt(t.due_date+'T12:00'):''}</p></span></label><div class="rowactions"><button class="btn small" onclick="taskForm(${t.id})">Bearbeiten</button></div></div>`}
function tasks(){let rows=state.tasks.filter(t=>(filter==='erledigt'?t.done:!t.done)&&(`${t.title} ${customer(t.customer_id).name}`).toLowerCase().includes(search.toLowerCase()));return `<div class="narrow"><div class="filterbar"><input id="search" placeholder="Aufgabe oder Kunde suchen" value="${esc(search)}"><button class="btn primary" onclick="taskForm()">+ Aufgabe</button><div class="tabs" style="margin:0"><button class="${filter!=='erledigt'?'active':''}" onclick="filter='aktuell';render()">Offen</button><button class="${filter==='erledigt'?'active':''}" onclick="filter='erledigt';render()">Erledigt</button></div></div><section class="card"><div class="stack">${rows.map(taskEntry).join('')||'<div class="empty">Hier gibt es gerade keine Aufgaben.</div>'}</div></section></div>`}
function finance(){let finished=state.appointments.filter(a=>a.status==='erledigt'),start=new Date(),target=period==='monat'?start.getFullYear()+'-'+String(start.getMonth()+1).padStart(2,'0'):String(start.getFullYear());let rows=finished.filter(a=>a.starts_at.startsWith(target)).sort((a,b)=>b.starts_at.localeCompare(a.starts_at));let total=k=>rows.reduce((n,a)=>n+a[k],0),revenue=total('price_cents'),paid=total('paid_cents'),cost=total('cost_cents');return `<div class="filterbar"><div class="tabs"><button class="${period==='monat'?'active':''}" onclick="period='monat';render()">Dieser Monat</button><button class="${period==='jahr'?'active':''}" onclick="period='jahr';render()">Dieses Jahr</button></div></div><div class="grid metrics">${metric('Vereinbart',money(revenue),'Abgeschlossene Einsätze')}${metric('Erhalten',money(paid),'Tatsächlich bezahlt')}${metric('Noch offen',money(revenue-paid),'Nicht bezahlt')}${metric('Direkte Kosten',money(cost),'Material und andere Kosten')}</div><section class="card narrow"><div class="sectionhead"><h2>Einsätze im Zeitraum</h2><span>${rows.length} abgeschlossen</span></div><div class="stack">${rows.map(a=>`<div class="entry"><main><b>${esc(a.title)}</b><p>${esc(customer(a.customer_id).name)} · ${fmt(a.starts_at)}</p></main><div style="text-align:right"><b>${money(a.price_cents)}</b><p class="muted" style="margin:5px 0">Bezahlt ${money(a.paid_cents)}</p><button class="btn small" onclick="appointmentForm(${a.id})">Details</button></div></div>`).join('')||'<div class="empty">In diesem Zeitraum gibt es noch keine abgeschlossenen Einsätze.</div>'}</div><p class="mapinfo">Überschuss vor weiteren Ausgaben und Steuern: <strong>${money(paid-cost)}</strong>. Nur direkte Kosten aus abgeschlossenen Einsätzen sind abgezogen.</p><div class="actions" style="margin-top:15px"><a class="btn small" href="/api/backup" download>Backup herunterladen</a><button class="btn small" onclick="document.querySelector('#restoreButton').click()">Backup wiederherstellen</button></div></section>`}
function archive(){let rows=state.appointments.filter(a=>['erledigt','abgesagt'].includes(a.status)).sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).filter(a=>(`${a.title} ${customer(a.customer_id).name}`).toLowerCase().includes(search.toLowerCase()));return `<div class="narrow"><div class="filterbar"><input id="search" placeholder="Einsatz oder Kunde suchen" value="${esc(search)}"></div><section class="card"><div class="sectionhead"><h2>Vergangene Einsätze</h2><span>${rows.length} Einträge</span></div><div class="stack">${rows.map(a=>`<div class="entry"><div class="time">${fmt(a.starts_at)}</div><main><b>${esc(a.title)}</b> <span class="badge ${esc(a.status)}">${esc(a.status)}</span><p>${esc(customer(a.customer_id).name)} · ${esc(a.result||'Kein Ergebnis notiert')}</p></main><div class="rowactions"><span>${money(a.price_cents)}</span><button class="btn small" onclick="appointmentForm(${a.id})">Öffnen</button></div></div>`).join('')||'<div class="empty">Noch keine archivierten Einsätze.</div>'}</div></section></div>`}
function openModal(title,html){window.closeCustomPicker?.();if(editMap){editMap.remove();editMap=null;editMarker=null;}$('#modalTitle').textContent=title;$('#modalBody').innerHTML=html;window.enhanceControls?.($('#modalBody'));if(!$('#modal').open)$('#modal').showModal()}
function closeModal(){window.closeCustomPicker?.();if(editMap){editMap.remove();editMap=null;editMarker=null}$('#modal').close()}
function customerOptions(selected){return `<option value="">Kunde wählen</option>`+state.customers.filter(c=>!c.archived||c.id===selected).map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${esc(c.name)}</option>`).join('')}
const GEO_CACHE='technikcheck-address-geocoding-v1';
async function resolveAddress(address){
 const q=String(address||'').trim();
 if(q.length<8)throw new Error('Bitte Straße, Hausnummer und Ort eingeben.');
 const match=q.match(/\b\d{1,4}[a-zA-Z]?\b/);
 if(!match)throw new Error('Bitte eine Hausnummer ergänzen.');
 let cache={};try{cache=JSON.parse(sessionStorage.getItem(GEO_CACHE)||'{}');}catch{}
 const key=q.toLocaleLowerCase('de-DE').replace(/\s+/g,' ');
 if(cache[key]&&Date.now()-cache[key].at<86400000)return cache[key].point;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
 try{
  const url=new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q',q.toLowerCase().includes('berlin')?q:q+', Berlin');
  url.searchParams.set('limit','5');url.searchParams.set('lang','de');url.searchParams.set('lat','52.52');url.searchParams.set('lon','13.405');
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw new Error('Adresssuche derzeit nicht verfügbar.');
  const data=await response.json();
  const house=match[0].toLowerCase();
  const candidates=(data.features||[]).filter(f=>{
   const p=f.properties||{},xy=f.geometry?.coordinates;
   return Array.isArray(xy)&&xy.length===2&&xy[0]>=12.95&&xy[0]<=13.85&&xy[1]>=52.29&&xy[1]<=52.74&&
    String(p.housenumber||'').toLowerCase()===house&&/berlin/i.test([p.city,p.state,p.county].join(' '));
  });
  if(!candidates.length)throw new Error('Keine eindeutige Berliner Hausnummer gefunden. Bitte den Pin selbst setzen.');
  const point={lng:candidates[0].geometry.coordinates[0],lat:candidates[0].geometry.coordinates[1]};
  cache[key]={point,at:Date.now()};try{sessionStorage.setItem(GEO_CACHE,JSON.stringify(cache));}catch{}
  return point;
 }finally{clearTimeout(timeout);}
}
function customerForm(id){
 let c=id?customer(id):{},current=c.id;
 openModal(current?'Kunde bearbeiten':'Neuer Kunde',`<form id="customerForm" class="fields"><label>Name *<input name="name" required maxlength="120" value="${esc(c.name||'')}"></label><label>Telefonnummer<input name="phone" type="tel" value="${esc(c.phone||'')}"></label><label>E-Mail<input name="email" type="email" value="${esc(c.email||'')}"></label><label>Adresse<input name="address" placeholder="Straße, Hausnummer, PLZ, Berlin" value="${esc(c.address||'')}"></label><label class="wide">Notizen<textarea name="notes">${esc(c.notes||'')}</textarea></label><div class="wide"><label>Automatischer Kartenstandort</label><p class="hint">Die Adresse wird nach der Eingabe automatisch gesucht. Dafür wird die eingegebene Adresse an Photon (komoot/OpenStreetMap) übermittelt. Du kannst den Punkt auf der Karte jederzeit manuell korrigieren.</p><p class="geocode-status" id="geocodeStatus" role="status"></p><button type="button" class="btn small" id="findAddress">Adresse auf Karte finden</button><div class="map smallmap" id="editMap"></div><input type="hidden" name="lat" value="${c.lat??''}"><input type="hidden" name="lng" value="${c.lng??''}"></div>${current?`<label class="wide" style="display:flex;align-items:center"><input type="checkbox" name="archived" style="width:auto" ${c.archived?'checked':''}> Kunde archivieren</label>`:''}<div class="wide dialogfoot"><button type="button" class="btn" onclick="closeModal()">Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div></form>`);
 const form=$('#customerForm'),status=$('#geocodeStatus'),address=form.elements.address;
 let lastAddress=(c.address||'').trim(),manual=false,lookupPromise=null,sequence=0;
 function place(lat,lng,isManual=false){
  form.elements.lat.value=lat;form.elements.lng.value=lng;
  if(isManual)manual=true;
  if(editMap){editMap.flyTo({center:[lng,lat],zoom:15});if(editMarker)editMarker.setLngLat([lng,lat]);else editMarker=new maplibregl.Marker({color:'#c62828'}).setLngLat([lng,lat]).addTo(editMap);}
 }
 async function findAddress(force=false){
  const text=address.value.trim();
  if(!text||(!force&&text===lastAddress))return true;
  const currentSequence=++sequence;lastAddress=text;status.textContent='Adresse wird gesucht …';
  const request=resolveAddress(text).then(point=>{
   if(currentSequence!==sequence)return false;
   place(point.lat,point.lng);manual=false;status.textContent='Adresse gefunden. Der Pin wurde automatisch gesetzt.';return true;
  }).catch(error=>{if(currentSequence===sequence)status.textContent=error.message;return false;});
  lookupPromise=request;
  return request;
 }
 address.addEventListener('input',()=>{sequence++;manual=false;lastAddress='';form.elements.lat.value='';form.elements.lng.value='';status.textContent='Standort wird nach der Eingabe ermittelt.';});
 address.addEventListener('blur',()=>{findAddress();});
 $('#findAddress').onclick=()=>findAddress(true);
 form.onsubmit=async e=>{
  e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
  try{
   if(!manual&&address.value.trim()&&(!form.elements.lat.value||address.value.trim()!==lastAddress))await findAddress(true);
   else if(lookupPromise)await lookupPromise;
   const d=Object.fromEntries(new FormData(form));d.archived=!!form.elements.archived?.checked;
   await api('customers'+(current?'/'+current:''),current?'PUT':'POST',d);
   closeModal();await refresh();popup('Kunde gespeichert');
  }catch(err){popup(err.message,true)}finally{if(button.isConnected)button.disabled=false;}
 };
 setTimeout(()=>{
  if(!$('#editMap'))return;
  if(!window.maplibregl||!window.offlineMapStyle){$('#editMap').innerHTML='<div class="empty">Kartendateien fehlen.</div>';return;}
  editMap=makeOfflineMap('editMap',[c.lng??13.405,c.lat??52.52],c.lat!=null?15:10);
  if(c.lat!=null)editMarker=new maplibregl.Marker({color:'#c62828'}).setLngLat([c.lng,c.lat]).addTo(editMap);
  editMap.on('click',e=>{const {lat,lng}=e.lngLat;place(lat,lng,true);status.textContent='Standort manuell gesetzt.';});
  editMap.resize();
 },100);
}

function appointmentForm(id,selectedCustomer){let a=id?state.appointments.find(x=>x.id===id):null,t=now(),start=new Date(Math.ceil(t.getTime()/1800000)*1800000),end=new Date(start.getTime()+90*60000);openModal(a?'Termin bearbeiten':'Neuer Termin',`<form id="appointmentForm" class="fields"><label class="wide">Kunde *<select name="customer_id" required>${customerOptions(a?.customer_id||selectedCustomer)}</select></label><label class="wide">Worum geht es? *<input name="title" required placeholder="z. B. Drucker einrichten" value="${esc(a?.title||'')}"></label><label>Beginn *<input type="datetime-local" name="starts_at" required value="${esc(a?.starts_at||localISO(start))}"></label><label>Ende *<input type="datetime-local" name="ends_at" required value="${esc(a?.ends_at||localISO(end))}"></label><label class="wide">Status<select name="status">${['geplant','bestätigt','erledigt','abgesagt'].map(s=>`<option ${a?.status===s?'selected':''}>${s}</option>`).join('')}</select></label><label class="wide">Aufgaben beim Termin<textarea name="description" placeholder="Was soll vor Ort gemacht werden?">${esc(a?.description||'')}</textarea></label><label class="wide">Ergebnis / was noch offen ist<textarea name="result" placeholder="Nach dem Termin ergänzen">${esc(a?.result||'')}</textarea></label><label>Preis (€)<input name="price" type="number" min="0" step="0.01" value="${a?(a.price_cents/100).toFixed(2):''}" placeholder="0,00"></label><label>Bereits bezahlt (€)<input name="paid" type="number" min="0" step="0.01" value="${a?(a.paid_cents/100).toFixed(2):''}" placeholder="0,00"></label><label>Direkte Kosten (€)<input name="cost" type="number" min="0" step="0.01" value="${a?(a.cost_cents/100).toFixed(2):''}" placeholder="0,00"></label><label>Gefahrene Kilometer<input name="distance_km" type="number" min="0" step="0.1" value="${a?.distance_km||''}" placeholder="0"></label><div class="wide" id="conflict"></div><div class="wide dialogfoot">${a?`<button type="button" class="btn danger" onclick="removeEntry('appointments',${a.id})" style="margin-right:auto">Löschen</button>`:''}<button type="button" class="btn" onclick="closeModal()">Abbrechen</button><button class="btn primary" type="submit">Speichern</button></div></form>`);let form=$('#appointmentForm');function conflicts(){let from=form.starts_at.value,to=form.ends_at.value;if(!from||!to)return;let hits=state.appointments.filter(x=>x.id!==a?.id&&x.status!=='abgesagt'&&x.starts_at<to&&x.ends_at>from);$('#conflict').innerHTML=hits.length?`<div class="notice">Achtung: ${hits.length} anderer Termin überschneidet sich mit diesem Zeitraum.</div>`:''}form.starts_at.onchange=conflicts;form.ends_at.onchange=conflicts;conflicts();form.onsubmit=async e=>{e.preventDefault();let d=Object.fromEntries(new FormData(form));try{await api('appointments'+(a?'/'+a.id:''),a?'PUT':'POST',d);closeModal();await refresh();popup('Termin gespeichert')}catch(err){popup(err.message,true)}}}
function taskForm(id,selectedCustomer){let t=id?state.tasks.find(x=>x.id===id):null;openModal(t?'Aufgabe bearbeiten':'Neue Aufgabe',`<form id="taskForm" class="fields"><label class="wide">Kunde *<select name="customer_id" required>${customerOptions(t?.customer_id||selectedCustomer)}</select></label><label class="wide">Aufgabe *<input name="title" required placeholder="z. B. Router-Einstellungen prüfen" value="${esc(t?.title||'')}"></label><label>Fällig am (optional)<input name="due_date" type="date" value="${esc(t?.due_date||'')}"></label><label style="display:flex;align-items:center"><input type="checkbox" name="done" style="width:auto" ${t?.done?'checked':''}> Erledigt</label><div class="wide dialogfoot">${t?`<button type="button" class="btn danger" onclick="removeEntry('tasks',${t.id})" style="margin-right:auto">Löschen</button>`:''}<button type="button" class="btn" onclick="closeModal()">Abbrechen</button><button class="btn primary">Speichern</button></div></form>`);$('#taskForm').onsubmit=async e=>{e.preventDefault();let d=Object.fromEntries(new FormData(e.target));d.done=!!e.target.done.checked;try{await api('tasks'+(t?'/'+t.id:''),t?'PUT':'POST',d);closeModal();await refresh();popup('Aufgabe gespeichert')}catch(err){popup(err.message,true)}}}
async function toggleTask(id,done){let t=state.tasks.find(x=>x.id===id);try{await api('tasks/'+id,'PUT',{...t,done});await refresh()}catch(e){popup(e.message,true)}}
async function removeEntry(type,id){if(!await window.askConfirmation('Diesen Eintrag wirklich löschen? Diese Aktion lässt sich nur mit einem Backup rückgängig machen.'))return;try{await api(type+'/'+id,'DELETE');closeModal();await refresh();popup('Eintrag gelöscht')}catch(e){popup(e.message,true)}}
function showCustomer(id){let c=customer(id),visits=state.appointments.filter(a=>a.customer_id===id).sort((a,b)=>b.starts_at.localeCompare(a.starts_at)),tasks=state.tasks.filter(t=>t.customer_id===id&&!t.done);openModal(c.name,`<div class="detailinfo"><span>${esc(c.address||'Keine Adresse')}</span>${c.phone?`<a href="tel:${encodeURIComponent(c.phone)}">${esc(c.phone)} <svg class="ui-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></a>`:''}${c.email?`<a href="mailto:${encodeURIComponent(c.email)}">${esc(c.email)}</a>`:''}${c.notes?`<p>${esc(c.notes).replace(/\n/g,'<br>')}</p>`:''}</div><div class="actions" style="margin-bottom:22px"><button class="btn primary" onclick="appointmentForm(null,${id})">+ Termin</button><button class="btn" onclick="taskForm(null,${id})">+ Aufgabe</button><button class="btn" onclick="customerForm(${id})">Bearbeiten</button><button class="btn" onclick="setupCustomerAccess(${id})">Handy einrichten</button>${c.address?`<a class="btn" href="https://www.openstreetmap.org/directions?route=;${encodeURIComponent(c.address)}" target="_blank" rel="noopener">Route <svg class="ui-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg></a>`:''}</div><div class="sectionhead"><h2>Offene Aufgaben</h2><span>${tasks.length}</span></div><div class="stack">${tasks.map(taskEntry).join('')||'<p class="muted">Keine offenen Aufgaben.</p>'}</div><div class="sectionhead" style="margin-top:28px"><h2>Termine & Einsätze</h2><span>${visits.length}</span></div><div class="stack">${visits.map(a=>`<div class="entry"><main><b>${esc(a.title)}</b> <span class="badge ${esc(a.status)}">${esc(a.status)}</span><p>${fmt(a.starts_at)} · ${clock(a.starts_at)} · ${money(a.price_cents)}</p></main><button class="btn small" onclick="appointmentForm(${a.id})">Öffnen</button></div>`).join('')||'<p class="muted">Noch keine Termine.</p>'}</div>`)}
$('#nav').onclick=e=>{let b=e.target.closest('[data-view]');if(b)setView(b.dataset.view)};$('#newCustomer').onclick=()=>customerForm();$('#newAppointment').onclick=()=>appointmentForm();$('#content').addEventListener('input',e=>{if(e.target.id==='search'){search=e.target.value;let focus=e.target.selectionStart;render();let n=$('#search');n?.focus();n?.setSelectionRange(focus,focus)}});$('#modal').addEventListener('cancel',e=>{e.preventDefault();closeModal()});$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))closeModal()});
document.addEventListener('click',async e=>{let link=e.target.closest('a[href="/api/backup"]');if(!link)return;e.preventDefault();try{const backup=await window.technikData.backup();const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='technikplan-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}catch(err){popup(err.message,true)}});
$('#restoreButton').onclick=()=>$('#restoreFile').click();$('#restoreFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!await window.askConfirmation('Dieses Backup ersetzt deine aktuellen Daten. Bitte vorher eine Sicherung herunterladen. Fortfahren?')){e.target.value='';return}try{await window.technikData.restore(JSON.parse(await file.text()));await refresh();popup('Backup wiederhergestellt')}catch(err){popup(err.message,true)}e.target.value=''};
window.addEventListener('technikplan-transit-ready',()=>{if(!$('#modal').open)render()});
window.addEventListener('focus',()=>{if(!$('#modal').open)refresh()});
window.addEventListener('technikplan-data-changed',()=>{if(!$('#modal').open)refresh()});
refresh();
