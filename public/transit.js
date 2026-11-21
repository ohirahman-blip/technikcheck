// Berlin stations: public fixed-bounding-box queries never include customer coordinates.
(function(){
 'use strict';
 const PREFIX='technikcheck-rail-stations-v7-',MAX_AGE=7*86400000;
 const bounds='(52.29,12.95,52.74,13.85)';
 const kinds=['U','S'];
 const stationLists={U:[],S:[]};
 const rad=x=>x*Math.PI/180;
 const distance=(a,b,c,d)=>{const h=Math.sin(rad(c-a)/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));};
 const validStation=x=>x&&typeof x.name==='string'&&Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&['U','S'].includes(x.kind);
 function readCache(key){
  try{
   const saved=JSON.parse(localStorage.getItem(key)||'null');
   if(saved&&Date.now()-saved.saved<MAX_AGE&&Array.isArray(saved.stations))return saved.stations.filter(validStation);
  }catch{}
  return [];
 }
 function update(kind,items){
  if(!items.length)return;
  stationLists[kind]=items;
  try{localStorage.setItem(PREFIX+kind,JSON.stringify({saved:Date.now(),stations:items}));}catch{}
  window.dispatchEvent(new Event('technikplan-transit-ready'));
 }
 for(const kind of kinds)stationLists[kind]=readCache(PREFIX+kind);
 // Restore older offline-cached stations, rather than losing previously displayed U-Bahn.
 if(!stationLists.U.length){
  const recent=readCache('technikcheck-rail-stations-v4-U');
  if(recent.length)stationLists.U=recent.filter(s=>s.kind==='U');
 }
 if(!stationLists.U.length){
  const legacy=readCache('technikcheck-rail-stations-v1');
  if(legacy.length)stationLists.U=legacy.filter(s=>s.kind==='U');
 }
 if(!stationLists.U.length||!stationLists.S.length){
  const legacy=readCache('technikcheck-rail-stations-v3');
  if(!stationLists.U.length)stationLists.U=legacy.filter(s=>s.kind==='U');
 }
 window.nearestRailStation=(lat,lng,kind=null)=>{
  lat=Number(lat);lng=Number(lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  const candidates=kind?stationLists[kind]||[]:[...stationLists.U,...stationLists.S];
  let nearest=null,meters=Infinity;
  for(const s of candidates){const d=distance(lat,lng,s.lat,s.lng);if(d<meters){nearest=s;meters=d;}}
  return nearest&&meters<=12000?{...nearest,meters:Math.round(meters)}:null;
 };
 window.nearestRailStations=(lat,lng)=>({U:window.nearestRailStation(lat,lng,'U'),S:window.nearestRailStation(lat,lng,'S')});
 window.railStationsStatus=()=>({U:stationLists.U.length,S:stationLists.S.length});
 // Both kinds are served from the same deployment. Production and localhost use identical files.
 for(const kind of kinds){
  fetch('/data/berlin-'+(kind==='U'?'ubahn':'sbahn')+'-stations.json',{cache:'no-cache'})
   .then(response=>{if(!response.ok)throw new Error('Bahnhofsdaten fehlen: '+response.status);return response.json();})
   .then(data=>{
    const valid=(data.stations||[]).filter(x=>validStation(x)&&x.kind===kind);
    if(valid.length)update(kind,valid);
    else console.warn('Keine gültigen '+kind+'-Bahnhöfe in der lokalen Datei');
   })
   .catch(error=>console.warn('Lokale '+kind+'-Bahnhofsdaten konnten nicht geladen werden:',error.message));
 }
})();
