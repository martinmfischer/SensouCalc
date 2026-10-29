import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultModel,ranged,melee} from '../src/engine.mjs';
import {calculationInput,ADVANCED_FIELDS} from '../src/scenario.mjs';

test('Basic excludes every hidden trait from calculation without mutating saved profiles',()=>{
  const profile={...defaultModel(),adeptAttack:2,adeptDefence:2,sharp:2,unblockable:2,tough:2,pierce:2,armour:2,prowessMelee:2,reach:true,lightning:true,slow:true,durable:true,kata:true,power:'strong',special:'counterstrike',brutal:1,prowessAttack:1};
  const state={advanced:false,a:profile,b:{...profile},friendly:{...profile},range:4};
  const before=structuredClone(state),basic=calculationInput(state),neutral=defaultModel();
  assert.deepEqual(state,before);
  for(const side of ['a','b','friendly'])for(const key of ADVANCED_FIELDS)assert.equal(basic[side][key],neutral[key],key);
  assert.equal(basic.a.brutal,1);assert.equal(basic.a.prowessAttack,1);
  const advanced=calculationInput({...state,advanced:true});
  assert.equal(advanced.a.special,'counterstrike');assert.equal(advanced.a.prowessMelee,2);assert.equal(advanced.a.power,'strong');
  const plain={...defaultModel(),brutal:1,prowessAttack:1};
  for(const calculate of [melee,ranged])assert.deepEqual(calculate(basic).results,calculate({...state,a:plain,b:plain,friendly:plain}).results);
});
