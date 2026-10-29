import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultModel,ranged} from '../src/engine.mjs';

test('Screenshot comparison: ordered dice reproduce ranged damage with and without a 6 HP cap',()=>{
  // Independent ordered enumeration: 3 initial dice, one possible Prowess die,
  // then 2 damage dice. Unused rerolls still enumerate six identical outcomes.
  const table=[
    [0,0,0,0,1,2,3,4,5,6,7],[0,0,0,1,2,3,4,5,6,7,8],
    [0,0,1,2,3,4,5,6,7,8,9],[0,0,1,2,3,4,5,6,7,8,9],
    [0,1,2,3,4,5,6,7,8,9,10],[0,1,2,3,4,5,6,7,8,9,10],
    [0,1,2,3,4,5,6,7,8,9,10],[1,2,3,4,5,6,7,8,9,10,11],
    [1,2,3,4,5,6,7,8,9,10,11],[2,3,4,5,6,7,8,9,10,11,12],
    [3,4,5,6,7,8,9,10,11,12,13],
  ];
  function score(dice){
    const kept=dice.filter(d=>d>1).sort((a,b)=>b-a);
    return {value:kept.length?kept[0]+kept.length-1+1:0,count:kept.length}; // Brutal 1
  }
  const finalScores=[];
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++){
    const dice=[a,b,c];let best=-Infinity,chosen=-1;
    for(let index=-1;index<3;index++){
      let expected=0;
      for(let face=1;face<=6;face++){
        const candidate=[...dice];if(index>=0)candidate[index]=face;
        const result=score(candidate);expected+=(result.value+result.count*1e-7)/6;
      }
      if(expected>best+1e-12){best=expected;chosen=index;}
    }
    for(let face=1;face<=6;face++){
      const final=[...dice];if(chosen>=0)final[chosen]=face;
      finalScores.push(score(final).value);
    }
  }
  const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
  const rawMeans=[5.991812414266118,4.994577331961591,4.002722050754458];
  const cappedMeans=[5.371442043895748,4.74380572702332,3.928647976680384];
  for(const hp of [6,30])for(const range of [4,5,6]){
    const challenge=range-2,counts=Array(hp+1).fill(0);let hits=0;
    for(const value of finalScores){
      if(value>=challenge)hits++;
      for(let d1=1;d1<=6;d1++)for(let d2=1;d2<=6;d2++){
        // Strength +2 modifies the roll; Tough 1 reduces wounds afterwards.
        const wounds=value<challenge?0:Math.max(0,table[Math.min(12,d1+d2+2)-2][value-challenge]-1);
        counts[Math.min(hp,wounds)]++;
      }
    }
    // Large supplies -2 itself, equivalent to Small with Challenge Modifier -2.
    const input={a:{...defaultModel(),ranged:3,strength:2,brutal:1,prowessAttack:1},b:{...defaultModel(),hp,tough:1,size:'large'},range};
    const result=ranged(input).results[0];
    const manualModifier=ranged({...input,b:{...input.b,size:'small'},challengeModifier:-2}).results[0];
    close(result.hit,hits/1296);
    counts.forEach((count,wounds)=>close(result.damage[wounds],count/46656));
    close(result.mean,(hp===6?cappedMeans:rawMeans)[range-4]);
    close(result.meanWounds,rawMeans[range-4]);
    close(result.medianWounds,[6,5,4][range-4]);
    close(result.meanWounds,manualModifier.meanWounds);
  }
});
