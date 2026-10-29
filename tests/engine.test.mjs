import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreDice,poolDistribution,defaultModel,normalizeModel,initiative,woundResult,damageDistribution,damageOutcomes,melee,ranged,rangedComparison,WOUND_TABLE} from '../src/engine.mjs';
const close=(actual,expected,tolerance=1e-9)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} ≠ ${expected}`);
const total=a=>a.reduce((a,b)=>a+b,0);
const mean=a=>a.reduce((s,p,n)=>s+p*n,0);
const model=overrides=>({...defaultModel(),...overrides});

test('Pool scoring: ones, Kata, Adept, removed highest dice, empty-pool modifiers',()=>{
  assert.deepEqual(scoreDice([6,5,4,3,1]),{score:8,count:4});
  assert.deepEqual(scoreDice([6,5,4,3,1],{adept:2}),{score:9,count:4});
  assert.deepEqual(scoreDice([1,1,1],{kata:true}),{score:3,count:3});
  assert.deepEqual(scoreDice([6,5,1],{discard:1}),{score:5,count:1});
  assert.deepEqual(scoreDice([1,1],{modifier:3}),{score:0,count:0});
  assert.deepEqual(scoreDice([],{modifier:3}),{score:0,count:0});
});

test('Weighted multisets equal independent ordered enumeration for a four-die pool',()=>{
  const expected=new Map();
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)for(let d=1;d<=6;d++){
    const valid=[a,b,c,d].filter(n=>n>1).sort((a,b)=>b-a).slice(1);
    const key=`${valid.length?valid[0]+Math.min(3,valid.length-1):0}:${valid.length}`;
    expected.set(key,(expected.get(key)||0)+1/1296);
  }
  const actual=poolDistribution({dice:4,adept:1,discard:1});
  close(total(actual.map(s=>s.p)),1);
  for(const s of actual)close(s.p,expected.get(`${s.score}:${s.count}`));
});

test('Optimal one-die Prowess rerolls 1, 2 and 3; enemy rerolls high values',()=>{
  const actual=poolDistribution({dice:1,ownRerolls:1});
  const expected=new Map();
  for(let a=1;a<=6;a++)for(let r=1;r<=6;r++){
    const final=a<=3?r:a,key=final===1?'0:0':`${final}:1`;
    expected.set(key,(expected.get(key)||0)+1/36);
  }
  for(const s of actual)close(s.p,expected.get(`${s.score}:${s.count}`));
  const base=poolDistribution({dice:1}).reduce((s,x)=>s+x.score*x.p,0);
  assert.ok(actual.reduce((s,x)=>s+x.score*x.p,0)>base);
  assert.ok(poolDistribution({dice:1,enemyRerolls:1}).reduce((s,x)=>s+x.score*x.p,0)<base);
});

test('Both initiative-dependent reroll orders retain probability mass',()=>{
  for(const ownFirst of [false,true]){
    const dist=poolDistribution({dice:3,ownRerolls:2,enemyRerolls:1,ownFirst,kata:true,discard:1,adept:1});
    close(total(dist.map(s=>s.p)),1);
    assert.ok(dist.every(s=>s.p>=0&&s.count===2));
  }
});

test('Wound shortcut reproduces every printed cell and extends past SL10',()=>{
  for(let row=2;row<=12;row++)for(let sl=0;sl<=10;sl++)close(woundResult(row,sl,model(),model()),WOUND_TABLE[row-2][sl]);
  close(woundResult(12,14,model(),model()),17);
  close(woundResult(7,14,model(),model()),14);
  close(woundResult(2,14,model(),model()),11);
});

test('Damage order: armour/pierce, Tough/sharp, halve down, then Durable',()=>{
  close(woundResult(12,0,model({special:'half'}),model({tough:1,durable:true})),1);
  close(woundResult(12,0,model({special:'half'}),model({tough:2,durable:true})),0);
  close(woundResult(12,2,model({pierce:2,sharp:1}),model({armour:2,tough:2})),4);
  close(woundResult(12,2,model(),model({armour:2,tough:2})),1);
  close(woundResult(2,0,model(),model({tough:-1})),1);
});

test('Dual and Combo apply Durable per damage roll, not to their sum',()=>{
  const defender=model({durable:true,hp:20});
  const single=damageDistribution(0,model(),defender);
  const dual=damageDistribution(0,model({special:'dual'}),defender);
  const combo=damageDistribution(1,model({special:'combo'}),defender);
  close(mean(single),10/36);
  close(mean(dual),20/36);
  assert.ok(dual[2]>0);close(total(dual),1);
  assert.ok(combo[2]>0);close(total(combo),1);
  const normal=mean(damageDistribution(3,model(),model({hp:30})));
  assert.ok(mean(damageDistribution(3,model({power:'strong'}),model({hp:30})))>normal);
  assert.ok(mean(damageDistribution(3,model({power:'weak'}),model({hp:30})))<normal);
});

test('Initiative differs from active-player tiebreaks; Slow cancels Reach/LR',()=>{
  assert.equal(initiative(model(),model({reach:true}),0),1);
  assert.equal(initiative(model({lightning:true}),model({reach:true}),1),0);
  assert.equal(initiative(model({reach:true,reachEligible:false}),model(),1),1);
  assert.equal(initiative(model({lightning:true,slow:true}),model(),1),1);
  assert.equal(initiative(model({slow:true}),model(),0),1);
  const r=melee({a:model({attack:1,defence:0}),b:model({attack:0,defence:0,lightning:true}),active:0});
  assert.equal(r.first,1);close(r.results[0].hit,1);
  const inactive=melee({a:model({attack:1,defence:0}),b:model({attack:0,defence:0,lightning:true}),active:1});
  close(inactive.results[0].hit,5/6);
});

test('Melee matches brute-force joint attacks/defences, shared tiebreak counts, and lethal interruption',()=>{
  const a=model({attack:1,defence:1,hp:2}),b=model({attack:1,defence:1,hp:3});
  const result=melee({a,b,active:0});
  const expected=[{hit:0,mean:0,kill:0},{hit:0,mean:0,kill:0}];
  // Independent ordered-dice reference, with direct 36-outcome damage rolls.
  for(let aa=1;aa<=6;aa++)for(let ad=1;ad<=6;ad++)for(let ba=1;ba<=6;ba++)for(let bd=1;bd<=6;bd++){
    const as=aa===1?0:aa,ads=ad===1?0:ad,bs=ba===1?0:ba,bds=bd===1?0:bd;
    const ac=(aa>1)+(ad>1),bc=(ba>1)+(bd>1);
    const ah=as>bds||(as===bds&&ac>=bc),bh=bs>ads||(bs===ads&&bc>ac);
    const p=1/1296;
    let alive=1;
    if(ah){
      expected[0].hit+=p;
      let kill=0;
      for(let d1=1;d1<=6;d1++)for(let d2=1;d2<=6;d2++){
        const w=WOUND_TABLE[d1+d2-2][as-bds];
        expected[0].mean+=p/36*Math.min(b.hp,w);if(w>=b.hp)kill+=1/36;
      }
      expected[0].kill+=p*kill;alive-=kill;
    }
    if(bh){
      expected[1].hit+=p*alive;
      for(let d1=1;d1<=6;d1++)for(let d2=1;d2<=6;d2++){
        const w=WOUND_TABLE[d1+d2-2][bs-ads];
        expected[1].mean+=p*alive/36*Math.min(a.hp,w);if(w>=a.hp)expected[1].kill+=p*alive/36;
      }
    }
  }
  result.results.forEach((r,i)=>{close(total(r.damage),1);for(const key of ['hit','mean','kill'])close(r[key],expected[i][key]);});
});

test('Prone prevents counterattack on success even at zero wounds',()=>{
  const r=melee({a:model({attack:1,defence:0,special:'knockdown',kata:true,strength:-6}),b:model({attack:1,defence:0,durable:true,tough:6}),active:0});
  close(r.results[0].hit,1);close(r.results[0].mean,0);close(r.results[1].hit,0);close(r.results[1].damage[0],1);
});

test('Prowess [Melee] shares one budget and preserves correlated outcome mass',()=>{
  const a=model({attack:1,defence:1,prowessMelee:1}),b=model({attack:1,defence:1});
  const balanced=melee({a,b,active:0});
  const attack=melee({a:{...a,rerollGoal:'attack'},b,active:0});
  const defence=melee({a:{...a,rerollGoal:'defence'},b,active:0});
  for(const result of [balanced,attack,defence])for(const r of result.results)close(total(r.damage),1);
  assert.ok(attack.results[0].hit>=defence.results[0].hit);
  assert.ok(defence.results[1].hit<=attack.results[1].hit);
  const ignoredSplit=melee({a:{...a,prowessAttack:3,prowessDefence:3},b,active:0});
  close(ignoredSplit.results[0].hit,balanced.results[0].hit);
});

test('Friendly Fire uses independent size-adjusted Ranged challenge and original SL',()=>{
  const r=ranged({a:model({ranged:1}),b:model({size:'small'}),friendly:model(),range:4,inBtb:true});
  close(r.hit,3/6);close(r.selection,1/6);close(r.results[0].hit,1/12);close(r.results[1].hit,5/12);
  r.results.forEach(m=>close(total(m.damage),1));
  const huge=ranged({a:model({ranged:1}),b:model({size:'huge'}),friendly:model(),range:4,inBtb:true});
  close(huge.selection,1);close(huge.results[1].hit,0);
  const blocked=ranged({a:model(),b:model(),friendly:model(),conditions:{shooterBtb:true}});
  close(blocked.hit,0);close(blocked.results[0].damage[0],1);
});

test('Friendly Fire excludes Brutal; Prowess optimizes the binary targeting challenge',()=>{
  const base={a:model({ranged:1,brutal:1}),b:model(),friendly:model(),range:4,inBtb:true};
  const brutal=ranged(base);
  close(brutal.hit,4/6);close(brutal.selection,1/6);
  const prowess=ranged({...base,a:{...base.a,prowessAttack:1}});
  // Keep a natural six. Reroll every other face: 1/6 + (5/6)*(1/6).
  close(prowess.selection,11/36);
  const noBrutal=ranged({...base,a:{...base.a,brutal:0,prowessAttack:1}});
  close(noBrutal.selection,prowess.selection);
});

test('SL greater than 10 survives Melee and Ranged without clamping',()=>{
  const a=model({attack:8,ranged:8,adeptAttack:6,brutal:5}),b=model({attack:0,defence:0,hp:30});
  for(const r of [melee({a,b}).results[0],ranged({a,b,range:4,challengeModifier:-6}).results[0]])assert.ok(r.success.slice(11).some(p=>p>0));
});

test('Imported model values are bounded and unknown properties dropped',()=>{
  const m=normalizeModel({hp:-4,attack:500,tough:-100,power:'<script>',name:'x'.repeat(100),reach:'true'});
  assert.equal(m.hp,1);assert.equal(m.attack,8);assert.equal(m.tough,-3);assert.equal(m.power,'normal');assert.equal(m.name.length,60);assert.equal(m.reach,false);
  assert.throws(()=>poolDistribution({dice:9}));
});

test('Critical removes on selected doubles, even when Tough/Durable prevent every wound',()=>{
  const outcomes=damageOutcomes(0,model({special:'critical'}),model({hp:30,tough:6,durable:true}));
  close(total(outcomes.map(o=>o.p)),1);
  close(total(outcomes.filter(o=>o.removed).map(o=>o.p)),1/6);
  assert.ok(outcomes.every(o=>o.wounds===0));
});

test('Critical uses forced Strong/Weak dice; Assassin can select any pair',()=>{
  for(const power of ['strong','weak','assassin']){
    let count=0;
    for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++){
      const dice=[a,b,c].sort((a,b)=>a-b);
      const removed=power==='assassin'?new Set(dice).size<3:power==='strong'?dice[1]===dice[2]:dice[0]===dice[1];
      if(removed)count++;
    }
    const outcomes=damageOutcomes(0,model({special:'critical',power}),model({hp:30}));
    close(total(outcomes.filter(o=>o.removed).map(o=>o.p)),count/216);
    close(count/216,power==='assassin'?4/9:51/216);
  }
  const target=model({hp:30});
  close(mean(damageDistribution(2,model({power:'assassin'}),target)),mean(damageDistribution(2,model({power:'strong'}),target)));
});

test('Critical removal interrupts counterattack without inflating the HP-loss plot',()=>{
  const a=model({hp:30,attack:1,defence:0,kata:true,strength:-6,special:'critical'});
  const b=model({hp:30,attack:1,defence:0,tough:6,durable:true});
  const r=melee({a,b,active:0});
  close(r.results[0].hit,1);close(r.results[0].removed,1/6);close(r.results[0].kill,1/6);
  close(r.results[0].mean,0);close(r.results[0].damage[0],1);
  close(r.results[0].meanWounds,0);
  close(r.results[1].hit,25/36);
});

test('Uncapped average preserves overkill while HP still interrupts counterattacks and Critical stops extra rolls',()=>{
  const a=model({attack:1,defence:0,kata:true,brutal:5,strength:6,special:'dual'});
  const b=model({attack:1,defence:0,hp:1});
  const low=melee({a,b}),high=melee({a,b:{...b,hp:30}});
  close(low.results[0].mean,1);close(low.results[0].kill,1);close(low.results[1].hit,0);
  close(low.results[0].meanWounds,high.results[0].meanWounds);
  assert.ok(low.results[0].meanWounds>low.results[0].mean);
  for(const special of ['dual','combo']){
    const attack=model({ranged:1,special,critical:true,strength:6});
    const target=model({hp:1});
    const result=ranged({a:attack,b:target,range:4}).results[0];
    const expected=poolDistribution({dice:1}).reduce((s,state)=>s+(state.score<4?0:state.p*damageOutcomes(state.score-4,attack,{...target,hp:Infinity}).reduce((sum,o)=>sum+o.wounds*o.p,0)),0);
    close(result.meanWounds,expected);
    assert.ok(result.meanWounds>result.mean);
  }
});

test('Granted Critical works with Dual/Combo and stops further rolls after removal',()=>{
  const target=model({hp:30,tough:6,durable:true});
  const dual=damageOutcomes(0,model({special:'dual',critical:true,strength:-6}),target);
  close(total(dual.filter(o=>o.removed).map(o=>o.p)),11/36);
  const combo=damageOutcomes(4,model({special:'combo',critical:true,strength:-6}),target);
  close(total(combo.filter(o=>o.removed).map(o=>o.p)),1-(5/6)**3);
  const rangedResult=ranged({a:model({ranged:1,critical:true}),b:target,friendly:target,range:4,inBtb:true});
  close(rangedResult.results[0].removed,rangedResult.results[0].hit/6);
  close(rangedResult.results[1].removed,rangedResult.results[1].hit/6);
});

test('Ranged comparison calculates Short, Medium and Long with common modifiers',()=>{
  const input={a:model({ranged:1}),b:model(),range:6,conditions:{cover:true}};
  const comparison=rangedComparison(input);
  assert.deepEqual(comparison.bands.map(b=>b.range),[4,5,6]);
  assert.deepEqual(comparison.bands.map(b=>b.challenge),[6,7,8]);
  close(comparison.bands[0].results[0].hit,1/6);
  close(comparison.bands[1].results[0].hit,0);close(comparison.bands[2].results[0].hit,0);
  for(const band of comparison.bands)close(band.results[0].mean,ranged({...input,range:band.range}).results[0].mean);
});

test('Friendly fire is a zero-damage outcome against the intended target at every range',()=>{
  const input={a:model({ranged:3}),b:model({hp:8}),friendly:model()};
  const plain=rangedComparison(input),friendly=rangedComparison({...input,inBtb:true});
  for(let i=0;i<3;i++){
    const band=friendly.bands[i],normal=plain.bands[i],p=band.selection;
    close(band.results[0].mean,normal.results[0].mean*p);
    close(band.results[0].damage[0],1-p*(1-normal.results[0].damage[0]));
    close(band.results[0].hit+band.results[1].hit,band.hit);
    close(total(band.results[0].damage),1);
  }
});
