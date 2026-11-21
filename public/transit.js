// Berlin stations: public fixed-bounding-box queries never include customer coordinates.
(function(){
 'use strict';
 const PREFIX='technikcheck-rail-stations-v6-',MAX_AGE=7*86400000;
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
 // Bundled S-Bahn coordinates ship with this app; no Overpass call for S-Bahn.
 fetch('/data/berlin-sbahn-stations.json',{cache:'force-cache'})
  .then(response=>{if(!response.ok)throw Error('Bundled S-Bahn JSON missing');return response.json();})
  .then(data=>{const valid=(data.stations||[]).filter(x=>validStation(x)&&x.kind==='S');if(valid.length)update('S',valid);})
  .catch(error=>console.warn('Lokale S-Bahn-Stationsdatei fehlt:',error.message));
 const queries={
  U:[`[out:json][timeout:25];(nwr["station"="subway"]${bounds};nwr["railway"="station"]["subway"="yes"]${bounds};);out center;`],
  // S-Bahn stations frequently have NO network/operator tag. Route membership is a stronger signal.
  S:[
   `[out:json][timeout:30];relation["type"="route"]["route"="train"]["ref"~"^S[0-9]+$"]${bounds}->.routes;(node(r.routes:"stop");node(r.routes:"stop_entry_only");node(r.routes:"stop_exit_only");node(r.routes:"platform");way(r.routes:"platform"););out center;`,
   `[out:json][timeout:25];(nwr["railway"~"station|halt"]["network"~"S[- ]?Bahn",i]${bounds};nwr["railway"~"station|halt"]["operator"~"S[- ]?Bahn",i]${bounds};);out center;`
  ]
 };
 function parse(data,kind){
  const unique=new Map();
  for(const item of data.elements||[]){
   const t=item.tags||{},name=String(t.name||'').trim();
   const lat=Number(item.lat??item.center?.lat),lng=Number(item.lon??item.center?.lon);
   if(!name||!Number.isFinite(lat)||!Number.isFinite(lng))continue;
   const isU=t.station==='subway'||t.subway==='yes';
   if(kind==='U'&&!isU)continue;
   if(kind==='S'){
    const meta=[t.network,t.operator,t['network:short']].filter(Boolean).join(' ');
    if(isU)continue; // Route-member results are confirmed S-Bahn stops, even without network tags.
   }
   const cleanName=name;
   const key=cleanName.toLocaleLowerCase('de-DE');
   if(!unique.has(key))unique.set(key,{name:cleanName,kind,lat,lng});
  }
  return [...unique.values()];
 }
 async function load(kind){
  if(stationLists[kind].length)return;
  const urls=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
  for(const query of queries[kind]){
   for(const endpoint of urls){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),22000);
    try{
     const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:controller.signal});
     if(!response.ok)throw new Error('HTTP '+response.status);
     const result=parse(await response.json(),kind);
     if(result.length){update(kind,result);return;}
    }catch(error){console.info(kind+'-Bahnhöfe konnten nicht geladen werden:',error.message);}
    finally{clearTimeout(timeout);}
   }
  }
 }
 // Only the existing U-Bahn fallback is queried externally; S-Bahn is bundled.
 load('U');
})();
