import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {defaultModel,melee,rangedComparison} from '../src/engine.mjs';
import {defaults,sanitize,calculationInput} from '../src/scenario.mjs';
import {simulate} from '../src/simulator.mjs';

const seed=0x30cafe;let random=seed;
const pick=n=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return Math.floor(random/4294967296*n);};
const die=()=>pick(6)+1,flag=()=>Boolean(pick(2));
function model(){return {...defaultModel(),hp:pick(12)+1,attack:pick(3),defence:pick(3),ranged:pick(3)+1,strength:pick(7)-3,brutal:pick(3),parry:pick(3),adeptAttack:pick(3),adeptDefence:pick(3),prowessAttack:pick(2),prowessDefence:pick(2),prowessMelee:pick(5)===0?1:0,feint:pick(2),dodge:pick(2),unblockable:pick(3),impenetrable:flag(),kata:flag(),reach:flag(),lightning:flag(),slow:flag(),armour:pick(4),pierce:pick(4),tough:pick(6)-2,sharp:pick(3),durable:flag(),lastStand:flag(),power:['normal','strong','weak','assassin'][pick(4)],special:['normal','critical','counterstrike','dual','combo','half','knockdown'][pick(7)],size:['tiny','small','medium','large','huge'][pick(5)]};}
let rolls=0,metrics=0;const start=Date.now();
for(let n=0;n<300;n++){
  const state=sanitize({...defaults(),mode:flag()?'melee':'ranged',advanced:flag(),active:pick(2),a:model(),b:model(),challengeModifier:pick(41)-20,rangedDefence:pick(13)-6,range:4+pick(3),inBtb:flag(),conditions:{cover:flag(),moved:flag(),ran:flag(),prone:flag(),surprised:flag(),repeated:flag(),shooterBtb:flag()}});
  const stored=structuredClone(state),input=calculationInput(state),exact=(input.mode==='melee'?melee:rangedComparison)(input);
  assert.deepEqual(state,stored);
  const groups=input.mode==='melee'?[exact]:exact.bands;
  for(const group of groups)for(const m of group.results){
    metrics++;
    for(const list of [m.damage,m.wounds]){assert.ok(list.every(p=>Number.isFinite(p)&&p>=-1e-9));assert.ok(Math.abs(list.reduce((a,b)=>a+b,0)-1)<1e-8);}
    for(const p of [m.hit,m.kill,m.wound,m.removed])assert.ok(p>=-1e-8&&p<=1+1e-8);
    assert.ok(m.mean<=m.meanWounds+1e-8);assert.ok(m.removed<=m.kill+1e-8);
  }
  for(let k=0;k<12;k++){
    const run=simulate(input,die);rolls++;
    run.hp.forEach((hp,i)=>assert.ok(Number.isInteger(hp)&&hp>=0&&hp<=run.models[i].hp));
    for(const pool of run.pools)assert.ok(pool.final.every(face=>face>=1&&face<=6));
    for(const event of run.events)assert.ok(event.lost<=event.wounds&&event.lost>=0);
  }
}
const report={seed,scenarios:300,simulationRuns:rolls,checkedMetrics:metrics,failures:0,elapsedMs:Date.now()-start};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/monkey-engine.json',JSON.stringify(report,null,2));console.log(report);
