import {defaultModel,normalizeModel} from './engine.mjs';

export const ADVANCED_FIELDS=new Set(['adeptAttack','adeptDefence','sharp','unblockable','impenetrable','size','tough','pierce','armour','prowessMelee','rerollGoal','reach','lightning','slow','durable','lastStand','kata','power','special']);

// Derive calculation inputs without changing the saved complete profiles.
export function calculationInput(state){
  const input=structuredClone(state),neutral=defaultModel();
  for(const side of ['a','b','friendly']){
    input[side]=normalizeModel(input[side]);
    input[side].critical=false;
    input[side].reachEligible=true;
    if(state.advanced===false)for(const key of ADVANCED_FIELDS)input[side][key]=neutral[key];
  }
  if(state.advanced===false&&input.mode==='ranged'){input.inBtb=false;input.conditions={};input.rangedDefence=0;}
  return input;
}

export const defaults=()=>({version:1,advanced:true,mode:'melee',active:0,a:defaultModel('Model A'),b:defaultModel('Model B'),friendly:defaultModel('Friendly model'),range:4,challengeModifier:0,rangedDefence:0,inBtb:false,conditions:{}});
export function sanitize(value) {
  if (!value || typeof value!=='object') throw new Error('Invalid scenario');
  const result=defaults();
  result.advanced=value.advanced!==false;result.mode=value.mode==='ranged'?'ranged':'melee';result.active=value.active===1?1:0;
  const legacyNames={'Modell A':'Model A','Modell B':'Model B','Befreundetes Modell':'Friendly model'};
  for (const key of ['a','b','friendly']) {result[key]=normalizeModel(value[key]||result[key]);if(Object.hasOwn(legacyNames,result[key].name))result[key].name=legacyNames[result[key].name];result[key].critical=false;result[key].reachEligible=true;}
  result.range=[4,5,6].includes(Number(value.range))?Number(value.range):4;
  for (const key of ['challengeModifier','rangedDefence']) {const limit=key==='challengeModifier'?20:6;result[key]=Math.max(-limit,Math.min(limit,Math.round(Number(value[key])||0)));}
  result.inBtb=value.inBtb===true;
  for (const key of ['cover','moved','ran','prone','surprised','repeated','shooterBtb']) result.conditions[key]=value.conditions?.[key]===true;
  return result;
}

export function parseScenario(text){
  if(typeof text!=='string'||text.length>16384)throw new Error('Scenario is too large.');
  return sanitize(JSON.parse(text));
}

export function parseSharedHash(hash){
  if(!hash.startsWith('#s='))return null;
  if(hash.length>49155)throw new Error('Scenario is too large.');
  return parseScenario(decodeURIComponent(hash.slice(3)));
}
