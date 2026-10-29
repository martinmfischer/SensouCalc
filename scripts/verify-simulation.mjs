// Independent ordered-dice Monte Carlo oracle. Only scenario defaults and the
// exact entry points are imported: scoring, rerolls and damage are reimplemented.
import {defaultModel,melee,ranged} from '../src/engine.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const samples=Number(process.argv[2]||300000),baseSeed=0x5e1150;
if(!Number.isInteger(samples)||samples<10000||samples>10000000)throw new Error('Samples must be an integer between 10,000 and 10,000,000.');
const model=overrides=>({...defaultModel(),...overrides});
let randomState=baseSeed,diceRolled=0;
function d6(){
  // Mulberry32: deterministic, no shared random/scoring code with the engine.
  randomState=(randomState+0x6d2b79f5)>>>0;
  let value=Math.imul(randomState^(randomState>>>15),1|randomState);
  value^=value+Math.imul(value^(value>>>7),61|value);
  diceRolled++;
  return 1+Math.floor(((value^(value>>>14))>>>0)/4294967296*6);
}
const throwDice=n=>Array.from({length:n},d6).sort((a,b)=>a-b);
function poolResult(dice,options){
  const surviving=dice.filter(face=>options.kata||face>1).sort((a,b)=>b-a);
  surviving.splice(0,options.discard||0);
  return {count:surviving.length,score:surviving.length?Math.max(0,surviving[0]+Math.min(surviving.length-1,2+(options.adept||0))+(options.bonus||0)):0};
}
const masksCache=new Map();
function masks(length,budget){
  const key=length+':'+budget;if(masksCache.has(key))return masksCache.get(key);
  const result=[];
  for(let mask=0;mask<2**length;mask++){
    const positions=[];for(let i=0;i<length;i++)if(mask&(1<<i))positions.push(i);
    if(positions.length<=budget)result.push(positions);
  }
  masksCache.set(key,result);return result;
}
function replacementExpectation(dice,positions,evaluate){
  const next=[...dice];
  function enumerate(at){
    if(at===positions.length)return evaluate([...next].sort((a,b)=>a-b));
    let value=0;
    for(let face=1;face<=6;face++){next[positions[at]]=face;value+=enumerate(at+1)/6;}
    return value;
  }
  return enumerate(0);
}
function sampleReplacement(dice,positions){
  const result=[...dice];for(const i of positions)result[i]=d6();return result.sort((a,b)=>a-b);
}
function utility(dice,options){
  const value=poolResult(dice,options);
  return options.challenge===undefined?value.score+value.count*1e-7:(value.score>=options.challenge?1:0)+value.score*1e-7+value.count*1e-9;
}
const oracleCache=new Map();
function rerollOracle(options){
  const cacheKey=JSON.stringify(options);if(oracleCache.has(cacheKey))return oracleCache.get(cacheKey);
  const stages=(options.ownFirst?[{budget:options.own,max:true},{budget:options.enemy,max:false}]:[{budget:options.enemy,max:false},{budget:options.own,max:true}]).filter(s=>s.budget);
  const memo=new Map();
  function policy(dice,stage){
    if(stage===stages.length)return {value:utility(dice,options),positions:[]};
    const key=dice.join('')+':'+stage;if(memo.has(key))return memo.get(key);
    const {budget,max}=stages[stage];let best={value:max?-Infinity:Infinity,positions:[]};
    for(const positions of masks(dice.length,budget)){
      const value=replacementExpectation(dice,positions,next=>policy(next,stage+1).value);
      if(max?value>best.value+1e-12:value<best.value-1e-12)best={value,positions};
    }
    memo.set(key,best);return best;
  }
  const oracle={sample(dice){let value=dice;for(let stage=0;stage<stages.length;stage++)value=sampleReplacement(value,policy(value,stage).positions);return value;}};
  oracleCache.set(cacheKey,oracle);return oracle;
}
const sharedCache=new Map();
function sharedReroll(attack,defence,a,b,attackOptions,defenceOptions){
  if(b.feint||b.dodge)throw new Error('Shared Prowess combined with enemy Feint/Dodge is outside this Monte Carlo fixture set.');
  const key=JSON.stringify([attack,defence,a.prowessMelee,a.rerollGoal,attackOptions,defenceOptions]);
  let choice=sharedCache.get(key);
  if(!choice){
    const dice=[...attack,...defence],weight=a.rerollGoal==='attack'?[1,1e-4]:a.rerollGoal==='defence'?[1e-4,1]:[1,1];
    let best=-Infinity;choice=[];
    for(const positions of masks(dice.length,a.prowessMelee)){
      // Keep the Attack/Defence boundary: only sort within each pool.
      const next=[...dice];
      function enumerate(at){
        if(at===positions.length)return weight[0]*utility(next.slice(0,attack.length),attackOptions)+weight[1]*utility(next.slice(attack.length),defenceOptions);
        let expected=0;for(let face=1;face<=6;face++){next[positions[at]]=face;expected+=enumerate(at+1)/6;}return expected;
      }
      const value=enumerate(0);if(value>best+1e-12){best=value;choice=positions;}
    }
    sharedCache.set(key,choice);
  }
  const dice=[...attack,...defence];for(const i of choice)dice[i]=d6();
  return [dice.slice(0,attack.length),dice.slice(attack.length)];
}
function firstAttacker(a,b,active){
  const effective=m=>m.slow&&(m.lightning||m.reach)?{lightning:false,reach:false,slow:false}:{lightning:m.lightning,reach:m.reach&&m.reachEligible,slow:m.slow};
  const left=effective(a),right=effective(b);
  if(left.lightning!==right.lightning)return left.lightning?0:1;
  if(left.reach!==right.reach)return left.reach?0:1;
  return [left,right][active].slow?1-active:active;
}
function rollModel(a,b,first){
  const attackOptions={kata:a.kata,discard:b.impenetrable?1:0,adept:a.adeptAttack,bonus:a.brutal,own:a.prowessAttack,enemy:b.dodge,ownFirst:!first};
  const defenceOptions={kata:a.kata,discard:b.unblockable,adept:a.adeptDefence,bonus:a.parry,own:a.prowessDefence,enemy:b.feint,ownFirst:!first};
  let attack=throwDice(a.attack),defence=throwDice(a.defence);
  if(a.prowessMelee)[attack,defence]=sharedReroll(attack,defence,a,b,attackOptions,defenceOptions);
  else {attack=rerollOracle(attackOptions).sample(attack);defence=rerollOracle(defenceOptions).sample(defence);}
  const ap=poolResult(attack,attackOptions),dp=poolResult(defence,defenceOptions);
  return {attack:ap.score,defence:dp.score,count:ap.count+dp.count};
}
// Printed table, independently indexed by ordered 2D6/3D6 throws.
const table=[
  [0,0,0,0,1,2,3,4,5,6,7],[0,0,0,1,2,3,4,5,6,7,8],
  [0,0,1,2,3,4,5,6,7,8,9],[0,0,1,2,3,4,5,6,7,8,9],
  [0,1,2,3,4,5,6,7,8,9,10],[0,1,2,3,4,5,6,7,8,9,10],[0,1,2,3,4,5,6,7,8,9,10],
  [1,2,3,4,5,6,7,8,9,10,11],[1,2,3,4,5,6,7,8,9,10,11],
  [2,3,4,5,6,7,8,9,10,11,12],[3,4,5,6,7,8,9,10,11,12,13],
];
function damage(sl,a,b){
  const critical=a.critical||a.special==='critical';
  let wounds=0,removed=false;
  const rolls=a.special==='dual'?2:a.special==='combo'?Math.max(2,Math.floor(sl/2)+1):1;
  for(let i=0;i<rolls&&!removed&&wounds<b.hp;i++){
    const level=a.special==='combo'?Math.max(0,sl-i*2):sl;
    const dice=throwDice(a.power==='normal'?2:3);
    let chosen=a.power==='weak'?dice.slice(0,2):dice.slice(-2);
    if(a.power==='assassin'&&critical){for(let j=0;j<dice.length-1;j++)if(dice[j]===dice[j+1])chosen=[dice[j],dice[j]];}
    removed=critical&&chosen[0]===chosen[1];
    const modified=chosen[0]+chosen[1]+a.strength-Math.max(0,b.armour-a.pierce);
    const row=Math.max(2,Math.min(12,modified))-2;
    let amount=level<=10?table[row][level]:table[row][10]+level-10;
    const reduction=b.tough<0?b.tough:Math.max(0,b.tough-a.sharp);
    amount=Math.max(0,amount-reduction);
    if(a.special==='half'||a.special==='knockdown')amount=Math.floor(amount/2);
    if(b.durable)amount=Math.min(amount,1);
    wounds=Math.min(b.hp,wounds+amount);
  }
  return {wounds,removed,out:removed||wounds>=b.hp};
}
const miss=()=>({hit:false,wounds:0,removed:false,out:false});
function simulateMelee(input){
  const models=[input.a,input.b],active=input.active||0,first=firstAttacker(...models,active),second=1-first;
  const pools=models.map((m,i)=>rollModel(m,models[1-i],first===i)),outcomes=[miss(),miss()];
  for(const i of [first,second]){
    if(i===second&&(outcomes[first].out||outcomes[first].hit&&models[first].special==='knockdown'))break;
    const me=pools[i],other=pools[1-i];
    const tie=me.count>other.count||me.count===other.count&&active===i;
    if(models[i].attack>0&&(me.attack>other.defence||me.attack===other.defence&&tie))outcomes[i]={hit:true,...damage(me.attack-other.defence,models[i],models[1-i])};
  }
  return outcomes;
}
const sizes={tiny:1,small:0,medium:-1,large:-2,huge:-3};
function simulateRanged(input){
  const a=input.a,b=input.b,f=input.conditions||{};
  if(f.shooterBtb)return [miss(),false];
  const challenge=input.range+sizes[b.size]+(input.challengeModifier||0)+(input.rangedDefence||0)+(f.cover?2:0)+(f.moved?1:0)+(f.ran?1:0)-(f.prone?1:0)-(f.surprised?1:0)+(f.repeated?1:0);
  const options={own:a.prowessAttack,enemy:0,adept:a.adeptAttack,bonus:a.brutal};
  const score=poolResult(rerollOracle(options).sample(throwDice(a.ranged)),options).score;
  if(score<challenge)return [miss(),false];
  if(input.inBtb&&b.size!=='huge'){
    const select={...options,bonus:0,challenge:6+sizes[b.size]};
    const result=poolResult(rerollOracle(select).sample(throwDice(a.ranged)),select).score;
    if(result<select.challenge)return [miss(),true];
  }
  return [{hit:true,...damage(score-challenge,a,b)},false];
}

const fixtures=[
  {name:'Melee baseline',mode:'melee',a:model(),b:model()},
  {name:'Active-player ties vs Lightning Reflexes',mode:'melee',active:1,a:model({attack:1,defence:1,lightning:true,hp:3}),b:model({attack:1,defence:1,hp:4})},
  {name:'Kata, Adept, Unblockable, Impenetrable Defence',mode:'melee',a:model({attack:4,defence:2,kata:true,adeptAttack:2,unblockable:1}),b:model({attack:3,defence:2,impenetrable:true,parry:1,unblockable:1})},
  {name:'Reach, Strong/Weak, Armour/Pierce, Tough/Sharp, half damage',mode:'melee',a:model({attack:3,defence:1,power:'weak',special:'half',pierce:2,sharp:1,hp:4}),b:model({attack:3,defence:1,reach:true,power:'strong',armour:3,tough:2,hp:7})},
  {name:'Assassin + granted Critical + Dual vs Durable',mode:'melee',a:model({attack:3,defence:1,power:'assassin',critical:true,special:'dual'}),b:model({tough:1,durable:true,hp:8})},
  {name:'Combo and success levels above 10',mode:'melee',a:model({attack:5,defence:1,adeptAttack:3,brutal:5,power:'weak',special:'combo'}),b:model({attack:2,defence:0,hp:16})},
  {name:'Prone cancels counterattack at zero wounds',mode:'melee',a:model({attack:1,defence:0,special:'knockdown',kata:true,strength:-6}),b:model({attack:1,defence:0,tough:6,durable:true})},
  {name:'Prowess, Feint and Dodge in initiative order',mode:'melee',a:model({attack:2,defence:1,prowessAttack:1,prowessDefence:1,feint:1,dodge:1}),b:model({attack:2,defence:1,prowessAttack:1,prowessDefence:1,feint:1,dodge:1,lightning:true})},
  {name:'Shared Prowess [Melee] 2, balanced',mode:'melee',a:model({prowessMelee:2}),b:model()},
  {name:'Shared Prowess [Melee] 1, defence priority',mode:'melee',a:model({prowessMelee:1,rerollGoal:'defence'}),b:model({attack:2,defence:2,kata:true})},
  ...[4,5,6].map(range=>({name:`Ranged ${['Short','Medium','Long'][range-4]}`,mode:'ranged',range,a:model(),b:model()})),
  ...[4,5,6].map(range=>({name:`Friendly Fire + Prowess + Brutal ${['Short','Medium','Long'][range-4]}`,mode:'ranged',range,inBtb:true,a:model({ranged:3,prowessAttack:1,brutal:1}),b:model({size:'medium',tough:1,armour:1,hp:5})})),
  {name:'Ranged Assassin Critical vs Tiny in Cover',mode:'ranged',range:4,inBtb:true,conditions:{cover:true,moved:true,prone:true},a:model({ranged:4,power:'assassin',critical:true,pierce:1}),b:model({size:'tiny',armour:2,durable:true,hp:8})},
  {name:'Huge target makes friendly selection automatic',mode:'ranged',range:6,inBtb:true,a:model({ranged:2,power:'strong'}),b:model({size:'huge',hp:7})},
];
function accumulator(hp){return {hit:0,wound:0,kill:0,removed:0,mean:0,damage:Array(hp+1).fill(0)};}
function record(acc,outcome){
  acc.hit+=Number(outcome.hit);acc.wound+=Number(outcome.wounds>0);acc.kill+=Number(outcome.out);acc.removed+=Number(outcome.removed);acc.mean+=outcome.wounds;acc.damage[outcome.wounds]++;
}
const reports=[];
for(let index=0;index<fixtures.length;index++){
  const fixture=fixtures[index];randomState=(baseSeed+Math.imul(index,0x9e3779b9))>>>0;
  const seed=randomState,exact=fixture.mode==='melee'?melee(fixture):ranged(fixture);
  const counts=fixture.mode==='melee'?[accumulator(fixture.b.hp),accumulator(fixture.a.hp)]:[accumulator(fixture.b.hp)];
  let friendlyHits=0;
  for(let trial=0;trial<samples;trial++){
    if(fixture.mode==='melee')simulateMelee(fixture).forEach((outcome,i)=>record(counts[i],outcome));
    else {const [outcome,friendly]=simulateRanged(fixture);record(counts[0],outcome);friendlyHits+=Number(friendly);}
  }
  const checks=[];
  function compare(label,expected,observed,variance,kind='probability'){
    const delta=observed-expected,se=Math.sqrt(Math.max(0,variance)/samples),tolerance=6*se+3/samples;
    checks.push({label,kind,expected,observed,delta,standardError:se,z:se>1e-12?Math.abs(delta)/se:0,pass:Math.abs(delta)<=tolerance});
  }
  counts.forEach((count,side)=>{
    const truth=exact.results[side],prefix=fixture.mode==='melee'?(side===0?'A':'B'):'Target';
    for(const key of ['hit','wound','kill','removed'])compare(`${prefix} ${key}`,truth[key],count[key]/samples,truth[key]*(1-truth[key]));
    const variance=truth.damage.reduce((s,p,n)=>s+p*n*n,0)-truth.mean**2;
    compare(`${prefix} mean HP`,truth.mean,count.mean/samples,variance,'mean');
    for(let n=0;n<count.damage.length;n++){
      const expected=truth.damage[n];compare(`${prefix} HP exactly ${n}`,expected,count.damage[n]/samples,expected*(1-expected));
      if(n>0){const expectedTail=truth.damage.slice(n).reduce((s,p)=>s+p,0);compare(`${prefix} HP at least ${n}`,expectedTail,count.damage.slice(n).reduce((s,p)=>s+p,0)/samples,expectedTail*(1-expectedTail));}
    }
  });
  if(fixture.mode==='ranged'){const p=fixture.inBtb?exact.results[1].hit:0;compare('Friendly-fire probability',p,friendlyHits/samples,p*(1-p));}
  const pass=checks.every(c=>c.pass),maxZ=Math.max(...checks.map(c=>c.z)),maxProbabilityDelta=Math.max(...checks.filter(c=>c.kind==='probability').map(c=>Math.abs(c.delta)));
  reports.push({name:fixture.name,mode:fixture.mode,seed,samples,fixture,pass,maxZ,maxProbabilityDelta,checks});
  console.log(`${pass?'PASS':'FAIL'} ${fixture.name}: max delta ${(maxProbabilityDelta*100).toFixed(3)} pp; max ${maxZ.toFixed(2)} sigma`);
  for(const check of checks.filter(c=>!c.pass))console.log('  ',check);
}
const root=resolve(import.meta.dirname,'..'),output=resolve(root,'artifacts');await mkdir(output,{recursive:true});
const sourceHash=createHash('sha256').update(await readFile(resolve(root,'src/engine.mjs'))).digest('hex');
const pass=reports.every(r=>r.pass),report={pass,samplesPerFixture:samples,fixtures:reports.length,totalTrials:samples*reports.length,diceRolled,baseSeed,engineSha256:sourceHash,tolerance:'6 binomial/theoretical standard errors + 3/N continuity allowance per metric; this is a reproducible statistical regression check, not a proof of all rules.',scope:'Independent ordered dice, table lookup, damage, initiative, ties, HP interruption and reroll decisions. Shared Prowess fixtures cover two priorities without simultaneous enemy Feint/Dodge; those combined shared-budget policies remain covered by exact unit checks.',reports};
await writeFile(resolve(output,'simulation-verification.json'),JSON.stringify(report,null,2));
const markdown=`# Dice simulation verification\n\n${pass?'PASS':'FAIL'} · ${reports.length} fixtures × ${samples.toLocaleString('en-GB')} trials = ${report.totalTrials.toLocaleString('en-GB')} simulated attacks/exchanges; ${diceRolled.toLocaleString('en-GB')} sampled D6 rolls.\n\nEngine SHA-256: \`${sourceHash}\`. Base seed: \`${baseSeed}\`.\n\nThe simulator uses its own ordered dice, reroll selection and printed-table lookup. It imports only the exact entry points and input defaults. Every damage bucket and cumulative tail is compared, together with hit, wound, removal, out-of-action and mean HP loss.\n\nTolerance: ${report.tolerance}\n\nScope: ${report.scope}\n\n| Scenario | Result | Largest probability difference | Largest standardised difference |\n|---|---|---:|---:|\n${reports.map(r=>`| ${r.name} | ${r.pass?'PASS':'FAIL'} | ${(r.maxProbabilityDelta*100).toFixed(3)} percentage points | ${r.maxZ.toFixed(2)} σ |`).join('\n')}\n\nDetailed exact/simulated metrics, all fixtures and per-fixture seeds are in simulation-verification.json. Repeat with \`node scripts/verify-simulation.mjs ${samples}\`.\n`;
await writeFile(resolve(output,'simulation-verification.md'),markdown);
console.log(`${pass?'PASS':'FAIL'}: ${reports.length} fixtures, ${report.totalTrials.toLocaleString('en-GB')} trials, ${diceRolled.toLocaleString('en-GB')} dice. Report: ${output}`);
if(!pass)process.exitCode=1;
