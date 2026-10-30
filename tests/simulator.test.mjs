import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultModel,melee,ranged,poolDistribution,samplePool} from '../src/engine.mjs';
import {simulate,d6} from '../src/simulator.mjs';
import {defaults,calculationInput} from '../src/scenario.mjs';
const model=overrides=>({...defaultModel(),...overrides});
const sequence=values=>{let i=0;return ()=>{assert.ok(i<values.length,'unexpected extra die');return values[i++];};};

test('Basic ranged neutralises all hidden conditions while preserving the complete scenario',()=>{
  const state={...defaults(),advanced:false,mode:'ranged',inBtb:true,rangedDefence:4,challengeModifier:-2,conditions:{cover:true,shooterBtb:true},a:model({impenetrable:true}),b:model({size:'large'})},before=structuredClone(state),input=calculationInput(state);
  assert.deepEqual(state,before);assert.equal(input.b.size,'small');assert.equal(input.a.impenetrable,false);
  assert.equal(input.inBtb,false);assert.equal(input.rangedDefence,0);assert.deepEqual(input.conditions,{});assert.equal(input.challengeModifier,-2);
});
test('Actual melee rolls stop at lethal wounds, except Last Stand; Prone and Critical still stop it',()=>{
  const input={mode:'melee',a:model({attack:1,defence:0}),b:model({attack:1,defence:0,hp:1})};
  assert.equal(simulate(input,sequence([6,6,6,6])).events.length,1);
  input.b.lastStand=true;
  assert.equal(simulate(input,sequence([6,6,6,6,2,2])).events.length,2);
  input.a.special='knockdown';assert.equal(simulate(input,sequence([6,6,6,6])).events.length,1);
  input.a.special='critical';const critical=simulate(input,sequence([6,6,2,2]));assert.equal(critical.events.length,1);assert.equal(critical.removed[1],true);
});
test('Counterstrike requires allocated enemy attack and can precede its own normal attack',()=>{
  const input={mode:'melee',a:model({attack:1,defence:0,hp:30}),b:model({attack:1,defence:1,special:'counterstrike'})};
  const run=simulate(input,sequence([1,6,6,4,4,4,4]));assert.equal(run.events.length,2);assert.equal(run.events[0].counterstrike,true);assert.equal(run.events[0].sl,4);
  input.a.attack=0;assert.equal(simulate(input,()=>6).events.filter(e=>e.counterstrike).length,0);
});
test('Ranged selection excludes Brutal and records friendly fire as zero intended damage',()=>{
  const run=simulate({mode:'ranged',range:6,inBtb:true,a:model({ranged:1,brutal:5}),b:model()},sequence([6,1]));
  assert.equal(run.friendlyFire,true);assert.equal(run.events.length,0);assert.equal(run.hp[1],6);assert.equal(run.pools[1].score,0);
});
test('Strong enforces selected dice; Assassin may select a critical pair',()=>{
  const input={mode:'ranged',a:model({ranged:1,special:'critical',power:'strong'}),b:model({hp:30}),range:4};
  assert.equal(simulate(input,sequence([6,2,2,6])).removed[1],false);
  input.a.power='assassin';assert.equal(simulate(input,sequence([6,2,2,6])).removed[1],true);
});
test('D6 source returns legal faces; invalid pool dice are rejected',()=>{
  for(let i=0;i<1000;i++)assert.ok(d6()>=1&&d6()<=6);
  assert.throws(()=>samplePool({dice:1},()=>7),/invalid face/);
});

// Seeded statistical regression: the visible sampler must match the exact engine.
test('Single-run sampler agrees with exact damage and reroll distributions',()=>{
  let seed=0x5e1150;const die=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return 1+Math.floor(seed/4294967296*6);};
  const fixtures=[
    {mode:'ranged',range:6,challengeModifier:-2,inBtb:true,a:model({ranged:3,prowessAttack:1,brutal:1,strength:2}),b:model({hp:6,tough:1})},
    {mode:'melee',a:model({attack:1,defence:1,prowessMelee:1}),b:model({attack:1,defence:1,feint:1,dodge:1,lastStand:true,hp:2})},
    {mode:'melee',active:1,a:model({attack:1,defence:1,prowessMelee:1,special:'counterstrike'}),b:model({attack:1,defence:1,feint:1,dodge:1,hp:3})},
    {mode:'melee',a:model({attack:2,defence:0,special:'knockdown'}),b:model({attack:2,defence:0,lastStand:true,hp:2})},
  ];
  for(const input of fixtures){
    const exact=(input.mode==='ranged'?ranged:melee)(input),n=6000,totals=[0,0],kills=[0,0];
    for(let k=0;k<n;k++){
      const run=simulate(input,die);
      for(let i=0;i<2;i++){const target=1-i;totals[i]+=run.models[target].hp-run.hp[target];kills[i]+=Number(run.removed[target]||run.hp[target]===0);}
    }
    for(let i=0;i<(input.mode==='ranged'?1:2);i++){
      assert.ok(Math.abs(totals[i]/n-exact.results[i].mean)<0.15,JSON.stringify({input,i,sampled:totals[i]/n,exact:exact.results[i].mean}));
      assert.ok(Math.abs(kills[i]/n-exact.results[i].kill)<0.04);
    }
  }
  const options={dice:2,ownRerolls:1,enemyRerolls:1},exact=poolDistribution(options).reduce((sum,x)=>sum+x.score*x.p,0);
  let total=0;for(let n=0;n<3000;n++)total+=samplePool(options,die).score;
  assert.ok(Math.abs(total/3000-exact)<0.12);
});
