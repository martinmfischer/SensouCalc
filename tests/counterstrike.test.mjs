import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultModel,melee} from '../src/engine.mjs';
const model=values=>({...defaultModel(),...values});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('Counterstrike needs allocated Attack and Defence dice; natural ones still count as allocated',()=>{
  const defender=model({attack:0,defence:1,parry:5,special:'counterstrike'});
  const noAttack=melee({a:model({attack:0,defence:0}),b:defender});
  close(noAttack.results[1].hit,0);close(noAttack.results[1].meanWounds,0);
  const allocated=melee({a:model({attack:1,defence:0}),b:defender});
  let expected=0;
  for(let a=1;a<=6;a++)for(let d=1;d<=6;d++)if(d>1&&d+5-(a===1?0:a)>=2)expected+=1/36;
  close(allocated.results[1].hit,expected);
  assert.ok(expected>0);
  const noDefence=melee({a:model({attack:1}),b:{...defender,defence:0}});
  close(noDefence.results[1].hit,0);
});

test('Counterstrike exchanges match independent ordered pools and damage rolls, including lethal interruption',()=>{
  for(const both of [false,true])for(const active of [0,1]){
    const models=[model({attack:1,defence:1,hp:2,special:both?'counterstrike':'normal',strength:1}),model({attack:1,defence:1,hp:4,special:'counterstrike',tough:1})];
    const expected=models.map((_,i)=>({hit:0,kill:0,damage:Array(models[1-i].hp+1).fill(0),wounds:[]}));
    function event(i,pools){
      const j=1-i,win=pools[i].attack>pools[j].defence||(pools[i].attack===pools[j].defence&&(pools[i].count>pools[j].count||pools[i].count===pools[j].count&&active===i));
      if(win)return {source:i,sl:pools[i].attack-pools[j].defence};
      if(models[j].special==='counterstrike'&&pools[j].defence-pools[i].attack>=2)return {source:j,sl:pools[j].defence-pools[i].attack-2};
      return null;
    }
    function rolls(e){
      if(!e)return [{wounds:0,p:1}];
      const result=[],source=models[e.source],target=models[1-e.source];
      for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){
        const row=Math.min(12,a+b+source.strength)-2,offset=[-3,-2,-1,-1,0,0,0,1,1,2,3][row];
        result.push({wounds:Math.max(0,Math.max(0,e.sl+offset)-target.tough),p:1/36});
      }
      return result;
    }
    for(let aa=1;aa<=6;aa++)for(let ad=1;ad<=6;ad++)for(let ba=1;ba<=6;ba++)for(let bd=1;bd<=6;bd++){
      const pools=[[aa,ad],[ba,bd]].map(([a,d])=>({attack:a===1?0:a,defence:d===1?0:d,count:Number(a>1)+Number(d>1)}));
      const one=event(active,pools),two=event(1-active,pools);
      for(const first of rolls(one)){
        const alive=!one||first.wounds<models[1-one.source].hp;
        const next=alive?two:null;
        for(const second of rolls(next)){
          const weight=first.p*second.p/1296,totals=[0,0],hits=[false,false];
          if(one){totals[one.source]+=first.wounds;hits[one.source]=true;}
          if(next){totals[next.source]+=second.wounds;hits[next.source]=true;}
          expected.forEach((r,i)=>{
            const hp=models[1-i].hp;r.hit+=Number(hits[i])*weight;r.kill+=Number(totals[i]>=hp)*weight;
            r.damage[Math.min(hp,totals[i])]+=weight;r.wounds[totals[i]]=(r.wounds[totals[i]]||0)+weight;
          });
        }
      }
    }
    const actual=melee({a:models[0],b:models[1],active});
    actual.results.forEach((r,i)=>{
      close(r.hit,expected[i].hit);close(r.kill,expected[i].kill);
      r.damage.forEach((p,n)=>close(p,expected[i].damage[n]||0));
      r.wounds.forEach((p,n)=>close(p,expected[i].wounds[n]||0));
      close(r.meanWounds,expected[i].wounds.reduce((sum,p,n)=>sum+p*n,0));
      assert.ok(r.wounds.slice(0,r.medianWounds+1).reduce((sum,p)=>sum+p,0)>=0.5-1e-12);
    });
  }
});
