import {normalizeModel,initiative,samplePool,sampleMeleeSide,woundResult,SIZE_MOD} from './engine.mjs';

// Rejection sampling avoids modulo bias. Tests can inject a deterministic D6 source.
export function d6(){
  const value=new Uint32Array(1),limit=4294967292;
  do{crypto.getRandomValues(value);}while(value[0]>=limit);
  return value[0]%6+1;
}
export function simulate(input,die=d6){
  const models=[normalizeModel(input.a),normalizeModel(input.b)],hp=models.map(m=>m.hp),removed=[false,false],prone=[false,false],events=[],pools=[],checks=[];
  const alive=i=>!removed[i]&&(hp[i]>0||models[i].lastStand);
  function damage(source,sl,counterstrike=false){
    const target=1-source,profile=counterstrike?{...models[source],special:'normal',critical:false}:models[source];
    const levels=[sl];
    if(profile.special==='dual')levels.push(sl);
    if(profile.special==='combo'){if(sl<2)levels.push(0);else for(let n=sl-2;n>=0;n-=2)levels.push(n);}
    if(profile.special==='knockdown')prone[target]=true;
    for(const level of levels){
      if(!alive(target))break;
      const dice=Array.from({length:profile.power==='normal'?2:3},die),sorted=[...dice].sort((a,b)=>a-b);
      let selected=['strong','assassin'].includes(profile.power)?sorted.slice(-2):sorted.slice(0,2);
      const critical=profile.critical||profile.special==='critical',pair=sorted.find((face,i)=>sorted[i+1]===face);
      if(critical&&profile.power==='assassin'&&pair!==undefined)selected=[pair,pair];
      const isCritical=critical&&selected[0]===selected[1],wounds=woundResult(selected[0]+selected[1],level,profile,models[target]),lost=Math.min(hp[target],wounds);
      hp[target]-=lost;if(isCritical)removed[target]=true;
      events.push({source,target,sl:level,counterstrike,dice,selected,wounds,lost,critical:isCritical});
    }
  }
  let first=0;
  if(input.mode==='ranged'){
    const [attacker,target]=models,flags=input.conditions||{};
    const challenge=Math.max(4,Math.min(6,Number(input.range)||4))+SIZE_MOD[target.size]+(Number(input.challengeModifier)||0)+(Number(input.rangedDefence)||0)+(flags.cover?2:0)+(flags.moved?1:0)+(flags.ran?1:0)+(flags.prone?-1:0)+(flags.surprised?-1:0)+(flags.repeated?1:0);
    const pool=samplePool({dice:attacker.ranged,adept:attacker.adeptAttack,modifier:attacker.brutal,ownRerolls:attacker.prowessAttack},die);
    pools.push({side:0,kind:'Ranged',...pool});
    let hit=pool.score>=challenge&&!flags.shooterBtb,friendlyFire=false;
    checks.push({label:'Ranged challenge',score:pool.score,challenge,hit});
    if(hit&&input.inBtb&&target.size!=='huge'){
      const selectionChallenge=6+SIZE_MOD[target.size],selection=samplePool({dice:attacker.ranged,adept:attacker.adeptAttack,ownRerolls:attacker.prowessAttack,challenge:selectionChallenge},die);
      pools.push({side:0,kind:'Target selection',...selection});
      friendlyFire=selection.score<selectionChallenge;hit=!friendlyFire;
      checks.push({label:'Target selection',score:selection.score,challenge:selectionChallenge,hit});
    }
    if(hit)damage(0,Math.max(0,pool.score-challenge));
    return {mode:'ranged',models,hp,removed,prone,pools,events,checks,first,friendlyFire,hit};
  }
  const active=input.active===1?1:0;first=initiative(...models,active);
  const sides=models.map((model,i)=>sampleMeleeSide(model,models[1-i],i===first,die));
  sides.forEach((side,i)=>pools.push(...side.pools.map(pool=>({side:i,...pool}))));
  for(const attacker of [first,1-first]){
    const defender=1-attacker,mine=sides[attacker],enemy=sides[defender];
    if(!alive(attacker)||!alive(defender)||prone[attacker]){checks.push({label:models[attacker].name+' attack interrupted'});break;}
    if(!models[attacker].attack){checks.push({label:models[attacker].name+': no Attack dice allocated'});continue;}
    const won=mine.attack>enemy.defence||(mine.attack===enemy.defence&&(mine.count>enemy.count||mine.count===enemy.count&&attacker===active));
    checks.push({label:models[attacker].name+' Attack vs Defence',score:mine.attack,challenge:enemy.defence,hit:won});
    if(won)damage(attacker,mine.attack-enemy.defence);
    else if(models[defender].special==='counterstrike'&&models[defender].defence>0&&enemy.defence-mine.attack>=2)damage(defender,enemy.defence-mine.attack-2,true);
  }
  return {mode:'melee',models,hp,removed,prone,pools,events,checks,first};
}
