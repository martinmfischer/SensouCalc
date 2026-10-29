import test from 'node:test';
import assert from 'node:assert/strict';
import {createCalculator} from '../src/calculator.mjs';

test('Only the newest calculation can render; timeouts terminate work and allow recovery',()=>{
  const timers=new Map(),workers=[],results=[],errors=[];let next=0;
  const run=delay=>{for(const [id,timer] of [...timers])if(timer.delay===delay){timers.delete(id);timer.fn();}};
  const calculator=createCalculator({onResult:r=>results.push(r),onError:e=>errors.push(e),schedule:(fn,delay)=>{timers.set(++next,{fn,delay});return next;},unschedule:id=>timers.delete(id),createWorker:()=>{
    const worker={terminate(){this.stopped=true;},postMessage(message){this.message=message;}};workers.push(worker);return worker;
  }});
  calculator.calculate({mode:'melee'});run(100);
  calculator.calculate({mode:'ranged'});assert.equal(workers[0].stopped,true);
  workers[0].onmessage({data:{id:1,result:'stale'}});assert.deepEqual(results,[]);
  run(100);workers[1].onmessage({data:{id:2,result:'current'}});assert.deepEqual(results,['current']);
  calculator.calculate({mode:'slow'});run(100);run(20000);
  assert.equal(workers[2].stopped,true);assert.match(errors[0],/20 seconds/);
  workers[2].onmessage({data:{id:3,result:'after-timeout'}});assert.deepEqual(results,['current']);
  calculator.calculate({mode:'recovered'});run(100);workers[3].onmessage({data:{id:4,result:'recovered'}});
  assert.deepEqual(results,['current','recovered']);calculator.dispose();assert.equal(timers.size,0);
});
