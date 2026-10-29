import {melee,rangedComparison} from './engine.mjs';
self.onmessage=({data})=>{
  try { self.postMessage({id:data.id,result:(data.state.mode==='melee'?melee:rangedComparison)(data.state)}); }
  catch (error) {self.postMessage({id:data.id,error:error.message});}
};
