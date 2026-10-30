import test from 'node:test';
import assert from 'node:assert/strict';
import {compareAllocations} from '../src/allocations.mjs';
import {melee} from '../src/engine.mjs';
import {defaults,sanitize,calculationInput} from '../src/scenario.mjs';

test('Allocation comparison enumerates legal splits without changing the scenario',()=>{
  const state=defaults(),input={...calculationInput(state),allocationSide:1,allocationTotal:4},before=structuredClone(input),result=compareAllocations(input);
  assert.deepEqual(input,before);assert.equal(result.rows.length,5);assert.equal(result.side,1);
  for(const row of result.rows){
    assert.equal(row.attack+row.defence,4);
    const exact=melee({...input,b:{...input.b,attack:row.attack,defence:row.defence}});
    assert.deepEqual(row.outgoing,exact.results[1]);assert.deepEqual(row.incoming,exact.results[0]);
  }
  assert.equal(result.rows[0].outgoing.hit,0);
  assert.throws(()=>compareAllocations({...input,allocationTotal:17}),/between 0 and 16/);
  assert.throws(()=>compareAllocations({...input,b:{...input.b,prowessMelee:1},allocationTotal:9}),/at most 8/);
});
test('Basic is the first-visit default, while saved explicit choices are preserved',()=>{
  assert.equal(defaults().advanced,false);assert.equal(sanitize({}).advanced,false);
  for(const advanced of [true,false])assert.equal(sanitize(JSON.parse(JSON.stringify({...defaults(),advanced}))).advanced,advanced);
});
