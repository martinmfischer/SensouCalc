import {defaultModel,normalizeModel} from './engine.mjs';

export const ADVANCED_FIELDS=new Set(['adeptAttack','adeptDefence','sharp','unblockable','tough','pierce','armour','prowessMelee','rerollGoal','reach','lightning','slow','durable','kata','power','special']);

// Derive calculation inputs without changing the saved complete profiles.
export function calculationInput(state){
  const input=structuredClone(state),neutral=defaultModel();
  for(const side of ['a','b','friendly']){
    input[side]=normalizeModel(input[side]);
    input[side].critical=false;
    input[side].reachEligible=true;
    if(state.advanced===false)for(const key of ADVANCED_FIELDS)input[side][key]=neutral[key];
  }
  return input;
}
