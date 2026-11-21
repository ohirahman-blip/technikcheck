// Berlin rail station coordinates, never sends customer locations to the station provider.
(function(){
 'use strict';
 const CACHE='technikcheck-rail-stations-v3', MAX_AGE=7*86400000;
 let stations=[];
 try {const saved=JSON.parse(localStorage.getItem(CACHE)||'null');if(saved&&Date.now()-saved.saved<MAX_AGE&&Array.isArray(saved.stations))stations=saved.stations;}catch{}
 const rad=x=>x*Math.PI/180;
 function distance(lat1,lon1,lat2,lon2){const a=Math.sin(rad(lat2-lat1)/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(a)));}
 window.nearestRailStation=(lat,lng,kind=null)=>{
  lat=Number(lat);lng=Number(lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
  let nearest=null,meters=Infinity;
  for(const s of stations){if(kind&&s.kind!==kind)continue;const d=distance(lat,lng,s.lat,s.lng);if(d<meters){nearest=s;meters=d;}}
  return nearest&&meters<=12000?{...nearest,meters:Math.round(meters)}:null;
 };
 window.nearestRailStations=(lat,lng)=>({U:window.nearestRailStation(lat,lng,'U'),S:window.nearestRailStation(lat,lng,'S')});
 if(stations.some(s=>s.kind==='U')&&stations.some(s=>s.kind==='S'))return;
 // OSM has many S-Bahn stations tagged railway=station/halt without network=S-Bahn.
 // Include named stops in S-Bahn route relations as a second independent signal.
 const bbox='(52.29,12.95,52.74,13.85)';
 const query=`[out:json][timeout:50];(nwr["railway"="station"]${bbox};nwr["railway"="halt"]${bbox};nwr["station"="subway"]${bbox};node["public_transport"="stop_position"]["train"="yes"]${bbox};);out center;`;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 const parse=data=>{
  const found=new Map();
  for(const item of data.elements||[]){
   const t=item.tags||{},name=String(t.name||'').trim(),lat=item.lat??item.center?.lat,lng=item.lon??item.center?.lon;
   if(!name||!Number.isFinite(lat)||!Number.isFinite(lng))continue;
   const meta=[t.network,t.operator,t['network:short'],t['railway:ref'],t.description,t.route].filter(Boolean).join(' ');
   const subway=t.station==='subway'||t.subway==='yes'||/U-Bahn/i.test(meta);
   const sbahn=/S[- ]?Bahn|S-Bahn Berlin/i.test(meta)||/^S\+?U?\s/i.test(name)||/^S\s/i.test(name)||
      (!subway&&['station','halt'].includes(t.railway)&&t.train!=='no'&&t.usage!=='industrial'&&t.passenger!=='no');
   // Railway passenger stations are included as S candidates only where not tagged subway.
   for(const kind of [subway?'U':null,sbahn?'S':null].filter(Boolean)){
    const key=kind+':'+name.toLocaleLowerCase('de-DE');
    const candidate={name:name.replace(/^S\+?U?\s+/,'').trim(),kind,lat,lng};
    if(!found.has(key))found.set(key,candidate);
   }
  }
  return [...found.values()];
 };
 const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter'];
 (async()=>{
  for(const endpoint of endpoints){
   try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:controller.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const candidates=parse(await response.json());
    if(candidates.some(x=>x.kind==='S')&&candidates.some(x=>x.kind==='U')){
     stations=candidates;
     try{localStorage.setItem(CACHE,JSON.stringify({saved:Date.now(),stations}));}catch{}
     window.dispatchEvent(new Event('technikplan-transit-ready'));
     return;
    }
   }catch(error){console.info('Stationsdaten nicht verfügbar:',error.message);}
  }
 })().finally(()=>clearTimeout(timer));
})();
