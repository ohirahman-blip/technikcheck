import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../public/data/berlin-sbahn-stations.json',import.meta.url),'utf8'));
test('bundled S-Bahn stations include validated Berlin stops',()=>{
 assert.ok(data.stations.length>=150,'Expected substantial Berlin S-Bahn coverage');
 const seen=new Set();
 for(const station of data.stations){
  assert.equal(station.kind,'S');
  assert.ok(station.name.length>1);
  assert.ok(station.lat>=52.29&&station.lat<=52.74,station.name);
  assert.ok(station.lng>=12.95&&station.lng<=13.85,station.name);
  assert.ok(!seen.has(station.name),station.name);
  seen.add(station.name);
 }
 for(const name of ['Alexanderplatz','Hauptbahnhof','Ostkreuz','Südkreuz','Bornholmer Straße','Adlershof','Neukölln'])assert.ok(seen.has(name),name);
});

test('local U-Bahn file is present and independent of browser cache',()=>{
 const ubahn=JSON.parse(readFileSync(new URL('../public/data/berlin-ubahn-stations.json',import.meta.url),'utf8'));
 assert.ok(ubahn.stations.length>=150);
 const names=new Set();
 for(const station of ubahn.stations){
  assert.equal(station.kind,'U');
  assert.ok(station.lat>=52.29&&station.lat<=52.74);
  assert.ok(station.lng>=12.95&&station.lng<=13.85);
  assert.ok(!names.has(station.name),station.name);
  names.add(station.name);
 }
 for(const name of ['Rudow','Alexanderplatz','Hermannplatz','Hauptbahnhof','Wittenau','Alt-Tegel'])assert.ok(names.has(name),name);
 const loader=readFileSync(new URL('../public/transit.js',import.meta.url),'utf8');
 assert.match(loader,/berlin-.*ubahn/);
 assert.doesNotMatch(loader,/overpass\.kumi|overpass-api\.de/);
});
