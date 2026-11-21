// Public Berlin U-Bahn and S-Bahn route geometry from OpenStreetMap.
// Fetches one fixed Berlin area: customer names, addresses and coordinates are never sent.
(function(){
 'use strict';
 const key='technikcheck-transit-routes-v2',ttl=7*86400000;
 let features=[];
 try{const item=JSON.parse(localStorage.getItem(key)||'null');if(item&&Date.now()-item.saved<ttl&&Array.isArray(item.features))features=item.features;}catch{}
 const fallback={U:'#1767bc',S:'#198352'};
 const bbox='(52.29,12.95,52.74,13.85)';
 const routes=[
  {kind:'U',query:`[out:json][timeout:35];relation["type"="route"]["route"="subway"]["operator"~"BVG|Berliner Verkehrsbetriebe",i]${bbox};out body geom;`},
  {kind:'S',query:`[out:json][timeout:35];relation["type"="route"]["route"="train"]["operator"~"S-Bahn Berlin",i]${bbox};out body geom;`}
 ];
 function parse(data,kind){
  const seen=new Set(),result=[];
  for(const rel of data.elements||[]){
   const tags=rel.tags||{},ref=String(tags.ref||'').trim().toUpperCase();
   if(rel.type!=='relation'||!(kind==='U'?/^U(?:[1-9]|1[0-9])$/:/^S(?:[1-9][0-9]?)$/).test(ref))continue;
   const osmColor=String(tags.colour||tags.color||'');
   const color=/^#[0-9a-f]{6}$/i.test(osmColor)?osmColor:fallback[kind];
   for(const member of rel.members||[]){
    if(member.type!=='way'||!Array.isArray(member.geometry)||member.geometry.length<2)continue;
    const id=kind+':'+member.ref;
    if(seen.has(id))continue;seen.add(id);
    const coords=member.geometry.filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat)).map(p=>[Math.round(p.lon*1e5)/1e5,Math.round(p.lat*1e5)/1e5]);
    if(coords.length>1)result.push({type:'Feature',properties:{kind,ref,color},geometry:{type:'LineString',coordinates:coords}});
   }
  }
  return result;
 }
 window.berlinTransitRoutes=()=>({type:'FeatureCollection',features});
 const notify=()=>window.dispatchEvent(new Event('technikcheck-transit-lines-ready'));
 if(features.length){queueMicrotask(notify);return;}
 Promise.all(routes.map(async route=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
  try{
   const resp=await fetch('https://overpass.kumi.systems/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:route.query}),signal:controller.signal});
   if(!resp.ok)throw new Error('Status '+resp.status);
   return parse(await resp.json(),route.kind);
  }catch(error){console.info(route.kind+'-Bahnlinien derzeit nicht verfügbar:',error.message);return [];}finally{clearTimeout(timer);}
 })).then(parts=>{
  features=parts.flat();
  if(features.length){try{localStorage.setItem(key,JSON.stringify({saved:Date.now(),features}));}catch{}notify();}
 });
})();
