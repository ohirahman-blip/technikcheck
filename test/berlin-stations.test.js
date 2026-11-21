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
