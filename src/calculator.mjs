// Cancel obsolete calculations rather than queue expensive work from old inputs.
export function createCalculator({onResult,onError,createWorker=()=>new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'}),schedule=setTimeout,unschedule=clearTimeout,timeout=20000}){
  let worker=null,debounce=null,deadline=null,generation=0;
  function cancel(){
    unschedule(debounce);unschedule(deadline);
    worker?.terminate();worker=null;
  }
  return {
    calculate(input,operation='calculate'){
      const id=++generation,state=structuredClone(input);cancel();
      debounce=schedule(()=>{
        let settled=false;
        function fail(message){if(id!==generation||settled)return;settled=true;cancel();onError(message);}
        try{
          worker=createWorker();
          worker.onmessage=({data})=>{
            if(id!==generation||data.id!==id||settled)return;
            settled=true;
            cancel();
            if(data.error)onError(data.error);else onResult(data.result);
          };
          worker.onerror=event=>{event.preventDefault?.();fail('The calculation worker failed. Try a smaller dice or reroll pool.');};
          deadline=schedule(()=>fail('This calculation exceeded 20 seconds. Reduce the dice or opposing rerolls and try again.'),timeout);
          worker.postMessage({id,state,operation});
        }catch{fail('The calculation worker could not start. Please reload the app.');}
      },100);
    },
    dispose(){generation++;cancel();}
  };
}
