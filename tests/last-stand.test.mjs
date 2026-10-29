import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultModel,melee,damageOutcomes} from '../src/engine.mjs';
import {calculationInput} from '../src/scenario.mjs';
const model=values=>({...defaultModel(),...values});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('Last Stand allows counterattacks after lethal wounds, but Critical and Prone bypass it',()=>{
  const a=model({attack:1,defence:0,kata:true,brutal:5,strength:6}),b=model({attack:1,defence:0,kata:true,hp:1});
  close(melee({a,b}).results[1].hit,0);
  const last={...b,lastStand:true};
  const result=melee({a,b:last});close(result.results[0].kill,1);close(result.results[1].hit,1);
  close(melee({a:{...a,special:'knockdown'},b:last}).results[1].hit,0);
  close(melee({a:{...a,special:'critical'},b:last}).results[1].hit,5/6);
  assert.equal(calculationInput({advanced:false,a,b:last}).b.lastStand,false);
  assert.equal(calculationInput({advanced:true,a,b:last}).b.lastStand,true);
});

test('Last Stand keeps later Counterstrike/attack events and extra Critical rolls possible',()=>{
  const a=model({attack:1,defence:0,hp:1}),b=model({attack:1,defence:1,parry:5,special:'counterstrike',strength:6});
  const normal=melee({a,b}),last=melee({a:{...a,lastStand:true},b});
  assert.ok(last.results[1].meanWounds>normal.results[1].meanWounds);
  const dual=model({special:'dual',critical:true,strength:6});
  const outcomes=damageOutcomes(6,dual,model({hp:1,lastStand:true}));
  close(outcomes.filter(o=>o.removed).reduce((sum,o)=>sum+o.p,0),1-(5/6)**2);
});
