import {melee} from './engine.mjs';

// Compare allocations after costs; the opponent, profiles and strategy stay fixed.
export function compareAllocations(input){
  const side=input.allocationSide===1?1:0,key=side?'b':'a',total=Number(input.allocationTotal);
  if(!Number.isInteger(total)||total<0||total>16)throw new Error('Choose a total between 0 and 16 dice, after costs.');
  if(input[key].prowessMelee&&total>8)throw new Error('Prowess [Melee] supports at most 8 dice in total.');
  const rows=[];
  for(let attack=Math.max(0,total-8);attack<=Math.min(8,total);attack++){
    const defence=total-attack,result=melee({...input,[key]:{...input[key],attack,defence}});
    rows.push({attack,defence,outgoing:result.results[side],incoming:result.results[1-side]});
  }
  return {side,total,rows};
}
