import {compareAllocations} from './allocations.mjs';
import {simulate} from './simulator.mjs';
import {melee,rangedComparison} from './engine.mjs';
self.onmessage=({data})=>{
  try { self.postMessage({id:data.id,result:data.operation==='allocations'?compareAllocations(data.state):data.operation==='simulate'?simulate(data.state):(data.state.mode==='melee'?melee:rangedComparison)(data.state)}); }
  catch (error) {self.postMessage({id:data.id,error:error.message});}
};
