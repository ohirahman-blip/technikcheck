// Station locations are loaded for a fixed Berlin bounding box; customer coordinates are never sent.
(function(){
 'use strict';
 const CACHE='technikcheck-rail-stations-v1';
 const MAX_AGE=7*24*60*60*1000;
 let stations=[];
 try{const c=JSON.parse(localStorage.getItem(CACHE)||'null');if(c&&Date.now()-c.saved<MAX_AGE&&Array.isArray(c.stations))stations=c.stations;}catch{}
 const rad=x=>x*Math.PI/180;
 function distance(lat1,lon1,lat2,lon2){
   const a=Math.sin(rad(lat2-lat1)/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;
   return 12742000*Math.asin(Math.min(1,Math.sqrt(a)));
 }
 window.nearestRailStation=(lat,lng)=>{
   if(!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng)))return null;
   let nearest=null,meters=Infinity;
   for(const s of stations){const d=distance(Number(lat),Number(lng),s.lat,s.lng);if(d<meters){nearest=s;meters=d;}}
   return nearest&&meters<=6000?{...nearest,meters:Math.round(meters)}:null;
 };
 if(stations.length)return;
 // Public railway infrastructure only. No addresses, names, or personal pins in this request.
 const query='[out:json][timeout:40];(node["railway"="station"]["station"="subway"](52.29,12.95,52.74,13.85);node["railway"="station"]["network"~"S-Bahn|S Bahn"](52.29,12.95,52.74,13.85);node["railway"="halt"]["network"~"S-Bahn|S Bahn"](52.29,12.95,52.74,13.85);node["station"="subway"](52.29,12.95,52.74,13.85);way["railway"="station"]["station"="subway"](52.29,12.95,52.74,13.85);way["railway"="station"]["network"~"S-Bahn|S Bahn"](52.29,12.95,52.74,13.85););out center;';
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 fetch('https://overpass.kumi.systems/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:controller.signal})
 .then(r=>{if(!r.ok)throw Error('Stationen konnten nicht geladen werden');return r.json();})
 .then(data=>{
   const unique=new Map();
   for(const item of data.elements||[]){
     const tag=item.tags||{},name=tag.name,lat=item.lat??item.center?.lat,lng=item.lon??item.center?.lon;
     if(!name||!Number.isFinite(lat)||!Number.isFinite(lng))continue;
     const kind=(tag.station==='subway'||tag.subway==='yes'||/U-Bahn/i.test(tag.network||''))?'U':(/S-Bahn|S Bahn/i.test(tag.network||'')?'S':null);
     if(!kind)continue;
     const key=kind+':'+name.toLowerCase();if(!unique.has(key))unique.set(key,{name,kind,lat,lng});
   }
   stations=[...unique.values()];if(stations.length){try{localStorage.setItem(CACHE,JSON.stringify({saved:Date.now(),stations}));}catch{}window.dispatchEvent(new Event('technikplan-transit-ready'));}
 }).catch(err=>console.info('ÖPNV-Haltestellen aktuell nicht verfügbar:',err.message)).finally(()=>clearTimeout(timeout));
})();
