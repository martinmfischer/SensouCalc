// Rules: GCT Studios Risen Sun live text + JwarRef + FAQ, checked 2026-10-29.
// No random sampling: weighted dice multisets enumerate every possible outcome.
export const WOUND_TABLE = [
  [0,0,0,0,1,2,3,4,5,6,7],
  [0,0,0,1,2,3,4,5,6,7,8],
  [0,0,1,2,3,4,5,6,7,8,9],
  [0,0,1,2,3,4,5,6,7,8,9],
  [0,1,2,3,4,5,6,7,8,9,10],
  [0,1,2,3,4,5,6,7,8,9,10],
  [0,1,2,3,4,5,6,7,8,9,10],
  [1,2,3,4,5,6,7,8,9,10,11],
  [1,2,3,4,5,6,7,8,9,10,11],
  [2,3,4,5,6,7,8,9,10,11,12],
  [3,4,5,6,7,8,9,10,11,12,13],
];
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const add = (map, key, p) => map.set(key, (map.get(key) || 0) + p);
const sum = values => values.reduce((a,b) => a+b, 0);
const factorial = n => n < 2 ? 1 : n * factorial(n-1);
const rollsCache = new Map();
export const DAMAGE_OFFSETS=[-3,-2,-1,-1,0,0,0,1,1,2,3];
function rolls(n) {
  if (rollsCache.has(n)) return rollsCache.get(n);
  const result = [];
  function walk(counts, face, left) {
    if (face === 5) {
      const c = [...counts, left];
      result.push({counts:c, p:factorial(n) / c.reduce((a,v) => a * factorial(v),1) / 6**n});
      return;
    }
    for (let i=0;i<=left;i++) walk([...counts,i],face+1,left-i);
  }
  walk([],0,n);
  rollsCache.set(n,result);
  return result;
}

export function scoreDice(dice, {kata=false, adept=0, discard=0, modifier=0}={}) {
  const kept = dice.filter(d => kata || d !== 1).sort((a,b)=>b-a).slice(discard);
  return {score: kept.length ? Math.max(0, kept[0]+Math.min(2+adept,kept.length-1)+modifier) : 0, count:kept.length};
}
function scoreCounts(counts, options) {
  return scoreDice(counts.flatMap((n,i)=>Array(n).fill(i+1)), options);
}
function selections(counts, limit) {
  const result=[];
  function walk(i,left,chosen) {
    if (i===6) {result.push(chosen);return;}
    for (let n=0;n<=Math.min(counts[i],left);n++) walk(i+1,left-n,[...chosen,n]);
  }
  walk(0,limit,[]);
  return result;
}
const poolCache = new Map();
export function poolDistribution(options={}) {
  const opts={dice:0,kata:false,adept:0,discard:0,modifier:0,ownRerolls:0,enemyRerolls:0,ownFirst:false,...options};
  if (!Number.isInteger(opts.dice) || opts.dice<0 || opts.dice>8) throw new Error('Dice pools must contain between 0 and 8 dice.');
  for (const key of ['ownRerolls','enemyRerolls']) if (!Number.isInteger(opts[key]) || opts[key]<0 || opts[key]>3) throw new Error('Rerolls must be between 0 and 3.');
  const cacheKey=JSON.stringify(opts);
  if (poolCache.has(cacheKey)) return poolCache.get(cacheKey);
  const stages = (opts.ownFirst ? [{n:opts.ownRerolls,max:true},{n:opts.enemyRerolls,max:false}] : [{n:opts.enemyRerolls,max:false},{n:opts.ownRerolls,max:true}]).filter(s=>s.n);
  const memo = new Map();
  // Reroll choices optimize expected final pool score, then surviving dice.
  // They deliberately do not use the other three pools to choose a tactic.
  function policy(counts, stage) {
    const key=counts.join(',')+':'+stage;
    if (memo.has(key)) return memo.get(key);
    if (stage===stages.length) {
      const s=scoreCounts(counts,opts);
      return {value:opts.challenge===undefined ? s.score+s.count*1e-7 : (s.score>=opts.challenge?1:0)+s.score*1e-7+s.count*1e-9};
    }
    const {n,max}=stages[stage];
    let best={value:max ? -Infinity:Infinity, selected:null};
    for (const selected of selections(counts,n)) {
      const left=counts.map((c,i)=>c-selected[i]);
      let value=0;
      for (const roll of rolls(sum(selected))) {
        const next=left.map((c,i)=>c+roll.counts[i]);
        value+=roll.p*policy(next,stage+1).value;
      }
      if (max ? value>best.value+1e-12 : value<best.value-1e-12) best={value,selected};
    }
    memo.set(key,best);
    return best;
  }
  const output=new Map();
  function resolve(counts,stage,p) {
    if (stage===stages.length) {
      const s=scoreCounts(counts,opts);
      add(output,opts.raw ? counts.join(',') : `${s.score}:${s.count}`,p);
      return;
    }
    const {selected}=policy(counts,stage);
    const left=counts.map((c,i)=>c-selected[i]);
    for (const roll of rolls(sum(selected))) resolve(left.map((c,i)=>c+roll.counts[i]),stage+1,p*roll.p);
  }
  for (const roll of opts.initialCounts ? [{counts:opts.initialCounts,p:1}] : rolls(opts.dice)) resolve(roll.counts,0,roll.p);
  const result=[...output].map(([key,p])=>{if (opts.raw) return {counts:key.split(',').map(Number),p}; const [score,count]=key.split(':').map(Number);return {score,count,p};});
  // Bound memory during long sessions with many different scenarios.
  if (poolCache.size>10000) poolCache.clear();
  poolCache.set(cacheKey,result);
  return result;
}

export const defaultModel = (name='Model') => ({name,hp:6,attack:3,defence:1,ranged:3,strength:0,brutal:0,parry:0,adeptAttack:0,adeptDefence:0,prowessAttack:0,prowessDefence:0,prowessMelee:0,rerollGoal:'balanced',feint:0,dodge:0,unblockable:0,impenetrable:false,kata:false,reach:false,reachEligible:true,lightning:false,slow:false,armour:0,pierce:0,tough:0,sharp:0,durable:false,critical:false,power:'normal',special:'normal',size:'small'});
const numberLimits={hp:[1,30],attack:[0,8],defence:[0,8],ranged:[1,8],strength:[-6,6],brutal:[0,5],parry:[0,5],adeptAttack:[0,6],adeptDefence:[0,6],prowessAttack:[0,3],prowessDefence:[0,3],prowessMelee:[0,3],feint:[0,3],dodge:[0,3],unblockable:[0,5],armour:[0,6],pierce:[0,6],tough:[-3,6],sharp:[0,6]};
export function normalizeModel(input={}) {
  const result=defaultModel();
  result.name=typeof input.name==='string' ? input.name.slice(0,60) : result.name;
  for (const [key,[min,max]] of Object.entries(numberLimits)) {
    const value=Number(input[key]);
    result[key]=Number.isFinite(value) ? clamp(Math.round(value),min,max) : result[key];
  }
  for (const key of ['impenetrable','kata','reach','reachEligible','lightning','slow','durable','critical']) if (typeof input[key]==='boolean') result[key]=input[key];
  for (const [key,allowed] of Object.entries({power:['normal','strong','weak','assassin'],special:['normal','combo','dual','critical','half','knockdown'],size:['tiny','small','medium','large','huge'],rerollGoal:['balanced','attack','defence']})) if (allowed.includes(input[key])) result[key]=input[key];
  return result;
}

export function initiative(a,b,active=0) {
  // Slow cancels that model's Lightning Reflexes and Reach, and itself.
  const cancelled=m=>m.slow&&(m.lightning||m.reach);
  const al=a.lightning&&!cancelled(a), bl=b.lightning&&!cancelled(b);
  if (al!==bl) return al ? 0:1;
  const ar=a.reach&&a.reachEligible&&!cancelled(a), br=b.reach&&b.reachEligible&&!cancelled(b);
  if (ar!==br) return ar ? 0:1;
  if ([a,b][active].slow&&!cancelled([a,b][active])) return 1-active;
  return active;
}
export function woundResult(roll,sl,attacker,defender) {
  const armour=Math.max(0,defender.armour-attacker.pierce);
  const row=clamp(roll+attacker.strength-armour,2,12)-2;
  // User-confirmed extension of the printed table beyond SL 10.
  let wounds=Math.max(0,sl+DAMAGE_OFFSETS[row]);
  const half=['half','knockdown'].includes(attacker.special);
  // Negative Tough increases wounds. Sharp only reduces positive Tough.
  const tough=defender.tough<0 ? defender.tough : Math.max(0,defender.tough-attacker.sharp);
  wounds=Math.max(0,wounds-tough);
  // Table convention confirmed by user: Tough → halve (floor) → Durable.
  if (half) wounds=Math.floor(wounds/2);
  if (defender.durable) wounds=Math.min(1,wounds);
  return wounds;
}
export function damageOutcomes(sl,attacker,defender) {
  const cap=defender.hp;
  let result=[{wounds:0,removed:false,p:1}];
  const levels=[sl];
  if (attacker.special==='dual') levels.push(sl);
  if (attacker.special==='combo') {
    if (sl<2) levels.push(0);
    else for (let level=sl-2;level>=0;level-=2) levels.push(level);
  }
  const raw=rolls(attacker.power==='normal' ? 2:3);
  const critical=attacker.critical||attacker.special==='critical';
  for (const level of levels) {
    const hit=new Map();
    for (const r of raw) {
      const dice=r.counts.flatMap((n,i)=>Array(n).fill(i+1));
      let selected=['strong','assassin'].includes(attacker.power) ? dice.slice(-2):dice.slice(0,2);
      // Assassin may freely choose a pair; Strong/Weak enforce their selection.
      const pair=dice.find((die,i)=>dice[i+1]===die);
      if (critical&&attacker.power==='assassin'&&pair!==undefined) selected=[pair,pair];
      const removed=critical&&selected[0]===selected[1];
      const wounds=Math.min(cap,woundResult(sum(selected),level,attacker,defender));
      add(hit,`${wounds}:${removed?1:0}`,r.p);
    }
    const next=new Map();
    for (const previous of result) {
      if (previous.removed||previous.wounds===cap) {add(next,`${previous.wounds}:${previous.removed?1:0}`,previous.p);continue;}
      for (const [key,p] of hit) {
        const [wounds,removed]=key.split(':').map(Number);
        add(next,`${Math.min(cap,previous.wounds+wounds)}:${removed}`,previous.p*p);
      }
    }
    result=[...next].map(([key,p])=>{const [wounds,removed]=key.split(':').map(Number);return {wounds,removed:Boolean(removed),p};});
  }
  return result;
}
export function damageDistribution(sl,attacker,defender) {
  const result=Array(defender.hp+1).fill(0);
  for (const outcome of damageOutcomes(sl,attacker,defender)) result[outcome.wounds]+=outcome.p;
  return result;
}
function sideStates(model,enemy,first) {
  const common={kata:model.kata,ownFirst:!first};
  const attackOptions={...common,dice:model.attack,modifier:model.brutal,adept:model.adeptAttack,discard:enemy.impenetrable?1:0,ownRerolls:model.prowessAttack,enemyRerolls:enemy.dodge};
  const defenceOptions={...common,dice:model.defence,modifier:model.parry,adept:model.adeptDefence,discard:enemy.unblockable,ownRerolls:model.prowessDefence,enemyRerolls:enemy.feint};
  if (model.prowessMelee) return sharedProwess(model,attackOptions,defenceOptions,first);
  const attacks=poolDistribution(attackOptions);
  const defences=poolDistribution(defenceOptions);
  return attacks.flatMap(a=>defences.map(d=>({attack:a.score,defence:d.score,count:a.count+d.count,p:a.p*d.p})));
}
function sharedProwess(model,attackOptions,defenceOptions,first) {
  if (model.attack+model.defence>8) throw new Error('Prowess [Melee]: maximum 8 dice in total. Please reduce the pools.');
  const budget=model.prowessMelee;
  const weights=model.rerollGoal==='attack' ? [1,1e-4] : model.rerollGoal==='defence' ? [1e-4,1] : [1,1];
  function prepare(options) {
    // Opponent's Feint/Dodge uses the documented independent pool policy.
    // The shared owner allocates their budget after seeing both own pools.
    const seed=poolDistribution({...options,ownRerolls:0,enemyRerolls:first?options.enemyRerolls:0,raw:true});
    const terminalCache=new Map();
    function terminal(counts) {
      const key=counts.join(',');
      if (!terminalCache.has(key)) terminalCache.set(key,poolDistribution({...options,ownRerolls:0,enemyRerolls:first?0:options.enemyRerolls,initialCounts:counts}));
      return terminalCache.get(key);
    }
    return seed.map(state=>{
      const choices=Array(budget+1).fill(null);
      for (const selected of selections(state.counts,budget)) {
        const used=sum(selected),left=state.counts.map((n,i)=>n-selected[i]);
        const outcomes=new Map();let score=0,count=0;
        for (const r of rolls(used)) for (const end of terminal(left.map((n,i)=>n+r.counts[i]))) {
          const p=r.p*end.p;score+=p*end.score;count+=p*end.count;add(outcomes,`${end.score}:${end.count}`,p);
        }
        const value=score+count*1e-7;
        for (let b=used;b<=budget;b++) if (!choices[b] || value>choices[b].value+1e-12) choices[b]={value,outcomes};
      }
      return {p:state.p,choices};
    });
  }
  const attacks=prepare(attackOptions),defences=prepare(defenceOptions),output=new Map();
  for (const a of attacks) for (const d of defences) {
    let best=-Infinity,split=0;
    for (let k=0;k<=budget;k++) {
      const value=weights[0]*a.choices[k].value+weights[1]*d.choices[budget-k].value;
      if (value>best+1e-12) {best=value;split=k;}
    }
    for (const [ak,ap] of a.choices[split].outcomes) for (const [dk,dp] of d.choices[budget-split].outcomes) {
      const [attack,ac]=ak.split(':').map(Number),[defence,dc]=dk.split(':').map(Number);
      add(output,`${attack}:${defence}:${ac+dc}`,a.p*d.p*ap*dp);
    }
  }
  return [...output].map(([k,p])=>{const [attack,defence,count]=k.split(':').map(Number);return {attack,defence,count,p};});
}
const maxAttack=m=>m.attack ? 6+Math.min(m.attack-1,2+m.adeptAttack)+m.brutal : 0;
const metrics=(hp,maxSL)=>({hit:0,kill:0,removed:0,meanWounds:0,damage:Array(hp+1).fill(0),success:Array(maxSL+1).fill(0)});
function uncappedMean(sl,attacker,defender) {
  return damageOutcomes(sl,attacker,{...defender,hp:Infinity}).reduce((s,o)=>s+o.wounds*o.p,0);
}
function recordDamage(metric,outcomes,weight,meanWounds) {
  metric.meanWounds+=weight*meanWounds;
  for (const outcome of outcomes) {
    const p=weight*outcome.p;
    metric.damage[outcome.wounds]+=p;
    if (outcome.removed) metric.removed+=p;
    if (outcome.removed||outcome.wounds===metric.damage.length-1) metric.kill+=p;
  }
}
function finish(m) {
  return {...m,mean:m.damage.reduce((s,p,n)=>s+p*n,0),wound:1-m.damage[0]};
}
export function melee(input) {
  const models=[normalizeModel(input.a),normalizeModel(input.b)];
  const active=input.active===1 ? 1:0;
  const first=initiative(...models,active), second=1-first;
  const states=models.map((m,i)=>sideStates(m,models[1-i],i===first));
  const results=models.map((m,i)=>metrics(models[1-i].hp,maxAttack(m)));
  const damage=models.map((m,i)=>Array.from({length:maxAttack(m)+1},(_,sl)=>damageOutcomes(sl,m,models[1-i])));
  const potential=models.map((m,i)=>Array.from({length:maxAttack(m)+1},(_,sl)=>uncappedMean(sl,m,models[1-i])));
  function success(i,s,t) {
    const mine=s[i], enemy=t;
    const hit=models[i].attack>0 && (mine.attack>enemy.defence || (mine.attack===enemy.defence && (mine.count>enemy.count || (mine.count===enemy.count && active===i))));
    return hit ? Math.max(0,mine.attack-enemy.defence) : -1;
  }
  for (const a of states[0]) for (const b of states[1]) {
    const s=[a,b],p=a.p*b.p;
    const levels=[success(0,s,b),success(1,s,a)];
    const firstSL=levels[first];
    const firstDamage=firstSL<0 ? [{wounds:0,removed:false,p:1}] : damage[first][firstSL];
    if (firstSL>=0) {results[first].hit+=p;results[first].success[firstSL]+=p;}
    recordDamage(results[first],firstDamage,p,firstSL<0?0:potential[first][firstSL]);
    const stops=firstSL>=0 && models[first].special==='knockdown';
    const survives=stops ? 0 : firstDamage.filter(o=>!o.removed&&o.wounds<models[second].hp).reduce((s,o)=>s+o.p,0);
    const secondSL=levels[second];
    results[second].damage[0]+=p*(1-survives);
    if (secondSL>=0) {
      results[second].hit+=p*survives;results[second].success[secondSL]+=p*survives;
      recordDamage(results[second],damage[second][secondSL],p*survives,potential[second][secondSL]);
    } else results[second].damage[0]+=p*survives;
  }
  return {mode:'melee',first,models,results:results.map(finish)};
}
export const SIZE_MOD={tiny:1,small:0,medium:-1,large:-2,huge:-3};
export function ranged(input) {
  const attacker=normalizeModel(input.a),target=normalizeModel(input.b),friendly=normalizeModel(input.friendly);
  const flags=input.conditions||{};
  const challenge=clamp(Number(input.range)||4,4,6)+SIZE_MOD[target.size]+(Number(input.challengeModifier)||0)+(Number(input.rangedDefence)||0)+(flags.cover?2:0)+(flags.moved?1:0)+(flags.ran?1:0)+(flags.prone?-1:0)+(flags.surprised?-1:0)+(flags.repeated?1:0);
  const pool=poolDistribution({dice:attacker.ranged,adept:attacker.adeptAttack,modifier:attacker.brutal,ownRerolls:attacker.prowessAttack});
  // Additional targeting challenge: Prowess/Adept apply, Brutal does not.
  // This binary test optimizes success chance, not expected success level.
  const selectionChallenge=6+SIZE_MOD[target.size];
  const selectionPool=poolDistribution({dice:attacker.ranged,adept:attacker.adeptAttack,ownRerolls:attacker.prowessAttack,challenge:selectionChallenge});
  const correct=target.size==='huge' ? 1 : selectionPool.filter(s=>s.score>=selectionChallenge).reduce((s,r)=>s+r.p,0);
  const selection=input.inBtb ? correct:1;
  const maxSL=Math.max(0,...pool.map(s=>s.score-challenge));
  const results=[metrics(target.hp,maxSL),metrics(friendly.hp,maxSL)];
  let hit=0;
  for (const state of pool) {
    if (state.score<challenge || flags.shooterBtb) continue;
    const sl=Math.max(0,state.score-challenge);hit+=state.p;
    [target,friendly].forEach((defender,i)=>{
      const p=state.p*(i===0 ? selection:1-selection);
      results[i].hit+=p;results[i].success[sl]+=p;
      recordDamage(results[i],damageOutcomes(sl,attacker,defender),p,uncappedMean(sl,attacker,defender));
    });
  }
  results.forEach(r=>r.damage[0]+=1-r.hit);
  return {mode:'ranged',challenge,selection,hit,models:[attacker,target,friendly],results:results.map(finish)};
}
export function rangedComparison(input) {
  const bands=[4,5,6].map(range=>({...ranged({...input,range}),range}));
  return {...bands[0],bands};
}
