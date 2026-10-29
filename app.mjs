import {defaultModel,normalizeModel} from './src/engine.mjs';
import {ADVANCED_FIELDS,calculationInput} from './src/scenario.mjs';

const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=value=>new Intl.NumberFormat('en-GB',{style:'percent',maximumFractionDigits:1}).format(Math.max(0,Math.min(1,value)));
const pointPct=value=>new Intl.NumberFormat('en-GB',{style:'percent',maximumFractionDigits:2}).format(Math.max(0,Math.min(1,value)));
const decimal=value=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:2,minimumFractionDigits:2}).format(value);
const defaults=()=>({version:1,advanced:true,mode:'melee',active:0,a:defaultModel('Model A'),b:defaultModel('Model B'),friendly:defaultModel('Friendly model'),range:4,challengeModifier:0,rangedDefence:0,inBtb:false,conditions:{}});
function sanitize(value) {
  if (!value || typeof value!=='object') throw new Error('Invalid scenario');
  const result=defaults();
  result.advanced=value.advanced!==false;result.mode=value.mode==='ranged'?'ranged':'melee';result.active=value.active===1?1:0;
  const legacyNames={'Modell A':'Model A','Modell B':'Model B','Befreundetes Modell':'Friendly model'};
  for (const key of ['a','b','friendly']) {result[key]=normalizeModel(value[key]||result[key]);result[key].name=legacyNames[result[key].name]||result[key].name;result[key].critical=false;result[key].reachEligible=true;}
  result.range=[4,5,6].includes(Number(value.range))?Number(value.range):4;
  for (const key of ['challengeModifier','rangedDefence']) result[key]=Math.max(-6,Math.min(6,Math.round(Number(value[key])||0)));
  result.inBtb=value.inBtb===true;
  for (const key of ['cover','moved','ran','prone','surprised','repeated','shooterBtb']) result.conditions[key]=value.conditions?.[key]===true;
  return result;
}
let state=defaults(),result=null,plot='cumulative',damageView='median',threshold=3,job=0,timer,installPrompt=null;
try {
  const hash=location.hash.slice(1);
  if (hash.startsWith('s=')) state=sanitize(JSON.parse(decodeURIComponent(hash.slice(2))));
  else {const stored=localStorage.getItem('sensou-calc-state');if(stored) state=sanitize(JSON.parse(stored));}
} catch {setTimeout(()=>toast('Could not load the saved scenario.'),0);}
function persist() {
  try {localStorage.setItem('sensou-calc-state',JSON.stringify(state));}
  catch {toast('Browser storage is unavailable. This scenario will be lost when you close the app.');}
}
function toast(message) {$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
const icons={
  attack:'<path d="m5 19 3-3m-4-1 5 5m-1-4L19 4l1 1L9 17M5 4l6 6m3 4 5 5m-4 1 5-5"/>',
  defence:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="M12 7v10m-4-5h8"/>',
  reroll:'<path d="M19 8a8 8 0 0 0-13-2L3 9m0-5v5h5m-3 7a8 8 0 0 0 13 2l3-3m0 5v-5h-5"/>',
  initiative:'<path d="m13 2-8 12h7l-1 8 8-12h-7Z"/>',
  critical:'<path d="m12 2 2 7 7-2-5 5 5 5-7-2-2 7-2-7-7 2 5-5-5-5 7 2Z"/>',
  kata:'<path d="M19 6a8 8 0 1 0 1 10M19 6l-4 1m4-1-1-4"/><path d="m8 14 3 2 5-7"/>',
  durable:'<path d="m7 3 10 1 4 8-5 8-10-1-3-8Z"/><path d="m7 3 3 8 7-7m-7 7-4 8m4-8 11 1m-11-1 6 9"/>',
  reach:'<path d="M4 20 18 6m-5 0 7-3-3 7M3 15l6 6"/>',
  slow:'<path d="M6 3h12M6 21h12M7 3c0 5 2 6 5 9-3 3-5 4-5 9m10-18c0 5-2 6-5 9 3 3 5 4 5 9"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" stroke-width="2.7"/>',
  assassin:'<path d="M5 12c2-8 12-8 14 0l-2 7H7Z"/><path d="m7 12 5 3 5-3m-7-2h.01m4 0h.01"/>',
  dual:'<path d="m3 20 6-6 3-11-9 9m9 8 6-6 3-11-9 9M2 16l5 5m4-5 5 5"/>',
  combo:'<path d="m8 8 2-2a4 4 0 0 1 6 6l-2 2m-4-4-2 2a4 4 0 0 0 6 6l2-2m-7-1 6-6"/>',
  half:'<circle cx="12" cy="12" r="8"/><path d="M12 4v16m0-12 4 4-4 4"/>',
  knockdown:'<path d="M4 20h16M12 3v12m-5-5 5 5 5-5"/>',
};
function abilityIcon(name,group=false) {
  return icons[name]?`<svg class="ability-icon${group?' group-icon':''} icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`:'';
}
const fieldTones={attack:'attack',ranged:'attack',strength:'attack',brutal:'attack',pierce:'attack',sharp:'attack',unblockable:'attack',adeptAttack:'attack',critical:'attack',power:'attack',special:'attack',defence:'defence',armour:'defence',tough:'defence',parry:'defence',adeptDefence:'defence',durable:'defence',impenetrable:'defence',prowessAttack:'reroll',prowessDefence:'reroll',prowessMelee:'reroll',feint:'reroll',dodge:'reroll',kata:'reroll',rerollGoal:'reroll'};
function numberField(side,key,label,min=0,max=8,hint='') {
  if(!state.advanced&&ADVANCED_FIELDS.has(key))return '';
  return `<label class="field" data-tone="${fieldTones[key]||'neutral'}" data-valued="${state[side][key]!==0}" ${hint?`title="${escape(hint)}"`:''}><span>${label}${hint?' <span class="hint-dot" aria-hidden="true">?</span>':''}</span><span class="stepper"><button type="button" data-step="-1" aria-label="${escape(label)} decrease">−</button><input aria-label="${escape(side+' '+label)}" type="number" inputmode="numeric" min="${min}" max="${max}" step="1" data-side="${side}" data-key="${key}" value="${state[side][key]}"><button type="button" data-step="1" aria-label="${escape(label)} increase">+</button></span></label>`;
}
function toggle(side,key,label,hint='') {
  if(!state.advanced&&ADVANCED_FIELDS.has(key))return '';
  const symbol=({critical:'critical',kata:'kata',durable:'durable',lightning:'initiative',reach:'reach',slow:'slow'})[key];
  return `<label class="toggle" data-tone="${fieldTones[key]||'neutral'}" ${hint?`title="${escape(hint)}"`:''}><span class="toggle-label">${abilityIcon(symbol)}<span>${label}</span></span><input type="checkbox" data-side="${side}" data-key="${key}" ${state[side][key]?'checked':''}><span class="switch" aria-hidden="true"></span></label>`;
}
function select(side,key,label,items) {
  if(!state.advanced&&ADVANCED_FIELDS.has(key))return '';
  const symbol=key==='special'?({normal:'attack',critical:'critical',dual:'dual',combo:'combo',half:'half',knockdown:'knockdown',counterstrike:'defence'})[state[side][key]]:key==='power'?(state[side].power==='assassin'?'assassin':'dice'):key==='rerollGoal'?'reroll':null;
  return `<label class="field select-field" data-tone="${fieldTones[key]||'neutral'}" data-valued="${['special','power'].includes(key)&&state[side][key]!=='normal'}"><span class="select-label">${abilityIcon(symbol)}${label}</span><select aria-label="${escape(side+' '+label)}" data-side="${side}" data-key="${key}">${items.map(([value,text])=>`<option value="${value}" ${String(key==='special'&&state.mode==='ranged'&&state[side][key]==='counterstrike'?'normal':state[side][key])===String(value)?'selected':''}>${text}</option>`).join('')}</select></label>`;
}
const powers=[['normal','Normal · 2D6'],['strong','Strong · top 2 of 3D6'],['weak','Weak · low 2 of 3D6'],['assassin','Assassin — eligible']];
const specials=[['normal','Normal attack'],['critical','Critical Attack'],['dual','Dual Attack'],['combo','Combo Attack'],['half','Half damage'],['knockdown','Half damage + Prone'],['counterstrike','Counterstrike Defence']];
const sizes=[['tiny','Tiny'],['small','Small'],['medium','Medium'],['large','Large'],['huge','Huge']];
function traitSection(title,content) {
  if(!/<(?:input|select)\b/.test(content))return '';
  const symbol=({'Attack & damage':'attack','Defence & resilience':'defence',Rerolls:'reroll',Initiative:'initiative'})[title];
  const tone=({'Attack & damage':'attack','Defence & resilience':'defence',Rerolls:'reroll'})[title]||'neutral';
  return `<section class="trait-group" data-tone="${tone}"><h3 class="trait-heading">${abilityIcon(symbol,true)}${title}</h3><div class="trait-fields">${content}</div></section>`;
}
function modelCard(side,index,role,targetOnly=false) {
  const m=state[side],melee=state.mode==='melee';
  const coreFields=melee?numberField(side,'attack','Attack Pool',0,8)+numberField(side,'defence','Defence Pool')+numberField(side,'hp','Remaining HP',1,30):targetOnly?numberField(side,'hp','Remaining HP',1,30)+select(side,'size','Model size',sizes):numberField(side,'ranged','Ranged Pool',1,8)+numberField(side,'strength','Strength',-6,6);
  const core=`<div class="core-fields${melee?'':' ranged-core'}">${coreFields}</div>`;
  const attackTraits=targetOnly?'':traitSection('Attack & damage',`<div class="field-grid">${melee?numberField(side,'strength','Strength',-6,6):''}${numberField(side,'brutal','Brutal',0,5)}${numberField(side,'adeptAttack',melee?'Adept [Attack]':'Adept [Ranged]',0,6)}${numberField(side,'pierce','Pierce',0,6)}${numberField(side,'sharp','Sharp',0,6)}${melee?numberField(side,'unblockable','Unblockable',0,5):''}</div><div class="select-grid">${select(side,'power','Damage dice',powers)}${select(side,'special','Special ability',melee?specials:specials.filter(([value])=>value!=='counterstrike'))}</div><div class="toggle-grid">${melee?toggle(side,'kata','Kata','Keep natural ones in melee.'):''}</div>`);
  const defensive=!melee&&!targetOnly?'':traitSection('Defence & resilience',`<div class="field-grid">${numberField(side,'armour','Armour',0,6)}${numberField(side,'tough','Tough',-3,6)}${melee?numberField(side,'parry','Parry',0,5)+numberField(side,'adeptDefence','Adept [Defence]',0,6):''}</div><div class="toggle-grid">${toggle(side,'durable','Durable','At most one wound per damage roll, after Tough and halving.')}${melee?toggle(side,'impenetrable','Impenetrable Def.','Removes the opponent’s highest attack die.'):''}</div>`);
  const rerolls=targetOnly?'':traitSection('Rerolls',`<div class="field-grid">${numberField(side,'prowessAttack',melee?'Prowess [Attack]':'Prowess [Ranged]',0,3)}${melee?numberField(side,'prowessDefence','Prowess [Defence]',0,3)+numberField(side,'prowessMelee','Prowess [Melee]',0,3,'Shared budget, replaces separate Prowess; at most 8 dice in total.')+numberField(side,'feint','Feint',0,3)+numberField(side,'dodge','Dodge',0,3):''}</div>${melee?select(side,'rerollGoal','Shared Prowess priority',[['balanced','Balanced · Attack + Defence'],['attack','Attack first'],['defence','Defence first']]):''}`);
  const initiative=melee?traitSection('Initiative',`<div class="toggle-grid">${toggle(side,'lightning','Lightning Reflexes')}${toggle(side,'slow','Slow')}${toggle(side,'reach','Reach','Enable when eligible: outside BtB with every enemy at activation start.')}</div>`):'';
  return `<article class="model-card panel ${index===1?'model-b':''}" data-card="${side}"><div class="model-top"><span class="model-index">${String(index+1).padStart(2,'0')}</span><span>${role}</span>${melee?`<button class="active-chip ${state.active===index?'is-active':''}" data-active="${index}" aria-pressed="${state.active===index}">${state.active===index?'Active Player':'Set active'}</button>`:`<span class="model-chip">${targetOnly?'TARGET':'ATTACKER'}</span>`}</div><label class="model-name"><span class="sr-only">Name ${side}</span><input type="text" maxlength="60" data-side="${side}" data-key="name" aria-label="Name ${side}" value="${escape(m.name)}"></label>${core}${attackTraits}${defensive}${rerolls}${initiative}</article>`;
}
function condition(key,label) {return `<label class="condition"><input type="checkbox" data-condition="${key}" ${state.conditions[key]?'checked':''}>${label}</label>`;}
function rangedConditions() {
  return `<section class="panel conditions-panel"><div class="conditions-heading"><span class="eyebrow">RANGED CONDITIONS</span><span id="challenge-badge" class="challenge-badge">Short · Medium · Long</span></div><div class="field-grid ranged-modifiers"><label class="field" data-tone="attack" data-valued="${state.challengeModifier!==0}"><span>Challenge Modifier</span><input aria-label="Challenge Modifier" type="number" min="-6" max="6" value="${state.challengeModifier}" id="challenge-modifier"></label><label class="field" data-tone="defence" data-valued="${state.rangedDefence!==0}"><span>Ranged Defence</span><input aria-label="Ranged Defence" type="number" min="-6" max="6" value="${state.rangedDefence}" id="ranged-defence"></label></div><div class="conditions-grid">${condition('cover','Target in Cover (+2)')}${condition('moved','Shooter moves (+1)')}${condition('ran','Target Ran (+1)')}${condition('prone','Target is Prone (−1)')}${condition('surprised','Target is Surprised (−1)')}${condition('repeated','Repeated shot (+1)')}${condition('shooterBtb','Shooter in BtB (attack fails)')}</div><label class="friendly-toggle"><input id="in-btb" type="checkbox" ${state.inBtb?'checked':''}><span><strong>Target in BtB with a friendly model</strong><small>Friendly fire is counted as a miss against the intended target.</small></span></label></section>`;
}
function renderModels() {
  document.querySelectorAll('[data-complexity]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.complexity==='advanced')===state.advanced)));
  $('#models').innerHTML=modelCard('a',0,state.mode==='melee'?'MODEL A':'SHOOTER')+modelCard('b',1,state.mode==='melee'?'MODEL B':'ORIGINAL TARGET',state.mode==='ranged')+'<button type="button" class="swap-profiles" id="swap-profiles" aria-label="Swap complete profiles" title="Swap complete profiles; the active side stays in place">⇄</button>';
  $('#matchup-context').textContent=state.mode==='melee'?'One complete melee exchange':'One ranged attack, with optional friendly fire';
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
  $('#conditions').innerHTML=state.mode==='melee'?'<p class="input-footnote">Enter allocated dice after costs, states, assists and boosts.</p>':rangedConditions();
}
const worker=new Worker('./src/worker.mjs',{type:'module'});
function calculate() {
  clearTimeout(timer);
  const current=++job;
  $('.results').setAttribute('aria-busy','true');$('#chart').setAttribute('aria-busy','true');
  $('#calculation-state').textContent='Calculating…';
  $('#export-button').disabled=true;
  timer=setTimeout(()=>worker.postMessage({id:current,state:calculationInput(state)}),100);
}
worker.onmessage=({data})=>{
  if(data.id!==job)return;
  $('.results').setAttribute('aria-busy','false');$('#chart').setAttribute('aria-busy','false');
  if(data.error){result=null;$('#calculation-state').textContent='Check inputs';$('#result-content').innerHTML=`<div class="panel error"><h2>This scenario needs an adjustment.</h2><p>${escape(data.error)}</p></div>`;$('#chart').innerHTML='';$('#data-table').innerHTML='';$('#threshold-results').innerHTML='';return;}
  result=data.result;$('#calculation-state').textContent='Exact calculation';$('#export-button').disabled=false;
  renderResults();renderChart();
};
worker.onerror=()=>{$('#calculation-state').textContent='Calculation failed';$('.results').setAttribute('aria-busy','false');$('#result-content').innerHTML='<div class="panel error">The calculation worker could not start. Please reload the app.</div>';};
function legendNames(){return state.mode==='melee'?[state.a.name,state.b.name]:['Short','Medium','Long'];}
function damageViewSwitch(){
  return '<div class="damage-view-switch" role="group" aria-label="Damage summary"><span>Damage / HP</span>'+['average','median'].map(view=>'<button data-damage-view="'+view+'" aria-pressed="'+(damageView===view)+'">'+(view==='average'?'Average':'Median')+'</button>').join('')+'</div>';
}
function damageSummary(metric,hp,label){
  const value=damageView==='average'?metric.meanWounds:metric.medianWounds;
  const lost=Math.min(hp,value),remaining=Math.max(0,hp-value),portion=lost/hp*100;
  const description=label+': '+damageView+' '+decimal(value)+' wounds; '+decimal(remaining)+' of '+hp+' HP remaining.';
  return '<figure class="damage-summary"><div class="damage-ring" role="img" aria-label="'+escape(description)+'" style="--damage:'+portion+'%"><div><strong>'+decimal(remaining)+'</strong><span>HP left</span></div></div><figcaption><strong>'+escape(label)+'</strong><span>'+decimal(value)+' wounds'+(value>hp?' · overkill':'')+'</span></figcaption></figure>';
}
function renderRangedResults() {
  const bands=result.bands,names=legendNames();
  const row=(label,value,kind='')=>'<tr class="'+kind+'"><th scope="row">'+label+'</th>'+bands.map(b=>'<td>'+value(b)+'</td>').join('')+'</tr>';
  const friendly=state.inBtb?'<div class="friendly-result">Friendly fire after a hit: <strong>'+pct(1-result.selection)+'</strong></div>':'';
  $('#result-content').innerHTML='<div class="panel ranged-outlook">'+friendly+'<div class="range-table-wrap"><table class="range-table"><caption class="sr-only">Compare Short, Medium and Long range</caption><thead><tr><th scope="col">Range</th>'+bands.map((b,i)=>'<th scope="col" class="range-'+i+'">'+names[i]+'<small>Challenge '+b.challenge+'</small></th>').join('')+'</tr></thead><tbody>'+row('Target hit',b=>pct(b.results[0].hit))+row('At least 1 wound',b=>pct(b.results[0].wound))+row('Average wounds',b=>decimal(b.results[0].meanWounds),'range-emphasis')+row('Median wounds',b=>b.results[0].medianWounds)+row('Out of action',b=>pct(b.results[0].kill),'range-emphasis')+(result.models[0].special==='critical'?row('Critical removal',b=>pct(b.results[0].removed)):'')+(state.inBtb?row('Friendly fire',b=>pct(b.results[1].hit),'friendly-risk'):'')+'</tbody></table></div>'+damageViewSwitch()+'<div class="damage-summaries ranged-summaries">'+bands.map((b,i)=>damageSummary(b.results[0],state.b.hp,names[i])).join('')+'</div><p class="range-note">Average and median are uncapped, including misses. HP diagrams are summaries, not probabilities. Target: '+state.b.hp+' HP.</p></div><p class="result-method"><button class="inline-button" data-method>Reroll strategy & rules ↗</button></p>';
  $('#challenge-badge').textContent=bands.map(b=>b.challenge).join(' / ');
}
function renderResults() {
  if(state.mode==='ranged'){renderRangedResults();return;}
  const first=result.models[result.first];
  $('#result-content').innerHTML='<div class="outlook-panel panel"><div class="initiative-banner"><strong>'+escape(first.name)+'</strong><span> attacks first</span></div>'+damageViewSwitch()+'<div class="melee-summaries">'+result.results.map((metric,i)=>{
    const source=result.models[i],target=result.models[1-i];
    return '<section class="side-summary"><h2>'+escape(source.name)+' <span>→ '+escape(target.name)+'</span></h2>'+damageSummary(metric,target.hp,'Damage to '+target.name)+'<dl class="damage-metrics"><div><dt>Average wounds</dt><dd>'+decimal(metric.meanWounds)+'</dd></div><div><dt>Median wounds</dt><dd>'+metric.medianWounds+'</dd></div><div><dt>At least 1 wound</dt><dd>'+pct(metric.wound)+'</dd></div><div><dt>Out of action</dt><dd>'+pct(metric.kill)+'</dd></div>'+(source.special==='critical'?'<div><dt>Critical removal</dt><dd>'+pct(metric.removed)+'</dd></div>':'')+'</dl></section>';
  }).join('')+'</div><p class="range-note">Average and median are uncapped, including cancelled attacks. HP diagrams are summaries, not probabilities.</p></div><p class="result-method"><button class="inline-button" data-method>Reroll strategy & rules ↗</button></p>';
}
function chartSeries() {
  const results=state.mode==='ranged'?result.bands.map(b=>b.results[0]):result.results;
  return results.map(r=>plot==='success'?r.success:plot==='distribution'?r.damage:r.damage.map((_,n)=>r.damage.slice(n).reduce((a,b)=>a+b,0)));
}
function renderChart() {
  if(!result)return;
  const names=legendNames(),series=chartSeries();
  const maxX=Math.max(1,...series.map(s=>s.length-1));
  const W=Math.max(280,$('#chart').clientWidth||1100),H=W<500?240:300,L=43,R=16,T=22,B=43,pw=W-L-R,ph=H-T-B;
  const x=n=>plot==='cumulative'?L+n/maxX*pw:L+(n+.5)/(maxX+1)*pw,y=p=>T+(1-p)*ph;
  const colors=['#2e6654','#ac765e','#57758a'];
  const labels={cumulative:['Cumulative damage','The probability of causing at least X wounds.'],distribution:['Damage distribution','The probability of losing exactly X HP.'],success:['Success Level','Unconditional probability by Success Level; failed attacks are excluded.']};
  $('#chart-title').textContent=labels[plot][0];$('#chart-description').textContent=labels[plot][1];
  $('#chart-legend').innerHTML=series.map((_,i)=>`<span><i class="legend-dot ${['','second','third'][i]}"></i>${escape(names[i])}${state.mode==='melee'?' → '+escape(i?state.a.name:state.b.name):''}</span>`).join('');
  document.querySelectorAll('[data-plot]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.plot===plot)));
  threshold=Math.max(1,Math.min(maxX,threshold));
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="${plot==='cumulative'?'group':'img'}" aria-labelledby="plot-svg-title plot-svg-desc"><title id="plot-svg-title">${escape(labels[plot][0])}</title><desc id="plot-svg-desc">${escape(labels[plot][1])} ${plot==='cumulative'?'Hover, tap or use the arrow keys to inspect a threshold. ':''}All values are also available in the table below.</desc>`;
  for(let p=0;p<=1.001;p+=.25) svg+=`<line class="gridline" x1="${L}" x2="${W-R}" y1="${y(p)}" y2="${y(p)}"/><text class="axis-label" x="${L-12}" y="${y(p)+4}" text-anchor="end">${Math.round(p*100)}%</text>`;
  const tickStep=Math.max(1,Math.ceil(maxX/(W<500?7:12)));
  for(let n=0;n<=maxX;n+=tickStep)svg+=`<text class="axis-label" x="${x(n)}" y="${H-B+23}" text-anchor="middle">${n}</text>`;
  svg+=`<text class="axis-caption" x="${W-R}" y="${H-2}" text-anchor="end">${plot==='success'?'Success Level':'Wounds / HP lost'}</text>`;
  if(plot==='cumulative') {
    const area=series[0].map((p,n)=>`${x(n)},${y(p)}`).join(' ');
    svg+=`<defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2e6654" stop-opacity=".16"/><stop offset="100%" stop-color="#2e6654" stop-opacity=".015"/></linearGradient></defs><polygon points="${x(0)},${y(0)} ${area} ${x(series[0].length-1)},${y(0)}" fill="url(#chart-fill)"/>`;
    svg+=`<line x1="${x(threshold)}" x2="${x(threshold)}" y1="${T}" y2="${y(0)}" stroke="#9aa79c" stroke-dasharray="4 5"/>`;
    series.forEach((values,i)=>{
      // Straight segments connect discrete integer thresholds; markers are exact.
      svg+=`<polyline points="${values.map((p,n)=>`${x(n)},${y(p)}`).join(' ')}" fill="none" stroke="${colors[i]}" stroke-width="3" ${i?`stroke-dasharray="${i===1?'7 5':'2 5'}"`:''}/>`;
      values.forEach((p,n)=>svg+=`<circle class="chart-point" data-point-threshold="${n}" cx="${x(n)}" cy="${y(p)}" r="${n===threshold?5:2.6}" fill="${colors[i]}" stroke="white" stroke-width="1.5"/>`);
    });
    svg+=`<line data-hover-guide x1="0" x2="0" y1="${T}" y2="${y(0)}" stroke="#87977e" stroke-dasharray="3 4" opacity="0" pointer-events="none"/>`;
    for(let n=0;n<=maxX;n++){
      const left=n===0?L:(x(n-1)+x(n))/2,right=n===maxX?W-R:(x(n)+x(n+1))/2;
      const description=`At least ${n} wounds. `+series.map((s,i)=>`${names[i]}: ${pointPct(s[n]||0)}`).join('. ');
      svg+=`<rect class="chart-hit" data-chart-threshold="${n}" data-anchor-x="${x(n)}" data-anchor-y="${y(series[0][n]||0)}" x="${left}" y="${T}" width="${right-left}" height="${ph}" fill="transparent" role="button" tabindex="${n===threshold?0:-1}" aria-label="${escape(description)}"/>`;
    }
  } else {
    const groupWidth=pw/(maxX+1),barWidth=Math.min(28,groupWidth/(series.length+1));
    series.forEach((values,i)=>values.forEach((p,n)=>{svg+=`<rect x="${x(n)+(i-(series.length-1)/2)*barWidth-barWidth/2}" y="${y(p)}" width="${barWidth-2}" height="${Math.max(0,ph*p)}" rx="2" fill="${colors[i]}" opacity="${i?.75:1}"><title>${escape(names[i])}: ${plot==='success'?'SL':'HP'} ${n}: ${pct(p)}</title></rect>`;}));
  }
  $('#chart').innerHTML=svg+'</svg><div id="chart-tooltip" class="chart-tooltip" role="tooltip" hidden></div>';
  $('#threshold-control').hidden=plot!=='cumulative';
  $('#threshold').max=maxX;$('#threshold').value=threshold;
  $('#threshold-value').textContent=threshold+(threshold===1?' wound':' wounds');
  $('#threshold-results').innerHTML=series.map((s,i)=>`<span><i class="legend-dot ${['','second','third'][i]}"></i>${escape(names[i])}<strong>${pct(s[threshold]||0)}</strong></span>`).join('');
  $('#data-table').innerHTML=`<table><caption class="sr-only">Chart values</caption><thead><tr><th scope="col">${plot==='success'?'SL':'Wounds'}</th>${series.map((_,i)=>`<th scope="col">${escape(names[i])}</th>`).join('')}</tr></thead><tbody>${Array.from({length:maxX+1},(_,n)=>`<tr><th scope="row">${plot==='cumulative'?'≥ ':''}${n}</th>${series.map(s=>`<td>${pct(s[n]||0)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('#chart-footnote').textContent=(state.mode==='melee'?'Per complete exchange, including cancelled counterattacks.':'Per shot, including misses'+(state.inBtb?' and the additional targeting test.':'.'))+(plot==='success'?' Failed attacks are excluded from this unconditional SL distribution.':' HP lost is capped at remaining HP.')+(plot==='cumulative'?' Lines connect discrete integer thresholds.':'');
  if(result.results.some(r=>r.removed>0))$('#chart-footnote').textContent+=' Critical removal is counted separately from HP lost.';
  if(state.mode==='ranged')$('#chart-footnote').textContent='Short, Medium and Long range, with all modifiers. All damage refers to the intended target.'+(state.inBtb?' Friendly fire contributes 0 target damage.':'')+(plot==='success'?' Success-Level probabilities exclude failed attacks.':' HP lost is capped at remaining HP.')+(result.bands.some(b=>b.results[0].removed>0)?' Critical removal is counted separately.':'');
}
function hideChartTooltip(){
  const tooltip=$('#chart-tooltip');if(tooltip)tooltip.hidden=true;
  $('#chart [data-hover-guide]')?.setAttribute('opacity','0');
  document.querySelectorAll('#chart .chart-point.is-inspected').forEach(point=>point.classList.remove('is-inspected'));
}
function showChartTooltip(hit,event){
  if(plot!=='cumulative'||!result)return;
  const n=Number(hit.dataset.chartThreshold),names=legendNames(),series=chartSeries(),tooltip=$('#chart-tooltip');
  tooltip.innerHTML=`<strong class="tooltip-heading">At least ${n} ${n===1?'wound':'wounds'}</strong>${series.map((s,i)=>`<div class="tooltip-row"><span><i class="legend-dot ${['','second','third'][i]}"></i>${escape(names[i])}</span><strong>${pointPct(s[n]||0)}</strong></div>`).join('')}`;
  tooltip.hidden=false;
  const chartRect=$('#chart').getBoundingClientRect(),svgRect=$('#chart svg').getBoundingClientRect(),viewBox=$('#chart svg').viewBox.baseVal;
  const anchorX=Number(hit.dataset.anchorX),anchorY=Number(hit.dataset.anchorY);
  const px=event?.clientX===undefined?svgRect.left-chartRect.left+anchorX*svgRect.width/viewBox.width:event.clientX-chartRect.left;
  const py=event?.clientY===undefined?svgRect.top-chartRect.top+anchorY*svgRect.height/viewBox.height:event.clientY-chartRect.top;
  const left=px+14+tooltip.offsetWidth>chartRect.width-8?px-tooltip.offsetWidth-14:px+14;
  const top=py-tooltip.offsetHeight-12<8?py+12:py-tooltip.offsetHeight-12;
  tooltip.style.left=Math.max(8,Math.min(chartRect.width-tooltip.offsetWidth-8,left))+'px';
  tooltip.style.top=Math.max(8,Math.min(chartRect.height-tooltip.offsetHeight-8,top))+'px';
  const guide=$('#chart [data-hover-guide]');guide.setAttribute('x1',anchorX);guide.setAttribute('x2',anchorX);guide.setAttribute('opacity','1');
  document.querySelectorAll('#chart .chart-point').forEach(point=>point.classList.toggle('is-inspected',Number(point.dataset.pointThreshold)===n));
  document.querySelectorAll('#chart .chart-hit').forEach(point=>point.setAttribute('tabindex',point===hit?'0':'-1'));
}
$('#chart').addEventListener('pointermove',event=>{const hit=event.target.closest('[data-chart-threshold]');if(hit)showChartTooltip(hit,event);else hideChartTooltip();});
$('#chart').addEventListener('pointerleave',hideChartTooltip);
$('#chart').addEventListener('click',event=>{const hit=event.target.closest('[data-chart-threshold]');if(hit)showChartTooltip(hit,event);});
$('#chart').addEventListener('focusin',event=>{const hit=event.target.closest('[data-chart-threshold]');if(hit)showChartTooltip(hit);});
$('#chart').addEventListener('focusout',event=>{if(!$('#chart').contains(event.relatedTarget))hideChartTooltip();});
$('#chart').addEventListener('keydown',event=>{
  const hit=event.target.closest('[data-chart-threshold]');if(!hit)return;
  if(event.key==='Escape'){hideChartTooltip();return;}
  const points=[...document.querySelectorAll('#chart .chart-hit')],n=Number(hit.dataset.chartThreshold);
  const next=event.key==='ArrowRight'?Math.min(points.length-1,n+1):event.key==='ArrowLeft'?Math.max(0,n-1):event.key==='Home'?0:event.key==='End'?points.length-1:null;
  if(next!==null){event.preventDefault();points[next].focus();}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();showChartTooltip(hit);}
});
document.addEventListener('pointerdown',event=>{if(!event.target.closest('#chart'))hideChartTooltip();});
function change() {
  if(location.hash.startsWith('#s='))history.replaceState(null,'',location.pathname+location.search);
  persist();syncTraitControls();calculate();
}
function syncTraitControls(){
  for(const card of document.querySelectorAll('[data-card]')){
    const m=state[card.dataset.card];
    for(const input of card.querySelectorAll('[data-key="prowessAttack"],[data-key="prowessDefence"]')){
      input.disabled=state.advanced&&state.mode==='melee'&&m.prowessMelee>0;
      input.parentElement.querySelectorAll('button').forEach(button=>button.disabled=input.disabled);
    }
  }
}
document.addEventListener('click',event=>{
  const complexity=event.target.closest('[data-complexity]');if(complexity){state.advanced=complexity.dataset.complexity==='advanced';renderModels();change();return;}
  const swap=event.target.closest('#swap-profiles');if(swap){[state.a,state.b]=[state.b,state.a];renderModels();change();return;}
  const damage=event.target.closest('[data-damage-view]');if(damage){damageView=damage.dataset.damageView;renderResults();return;}
  const step=event.target.closest('[data-step]');
  if(step){const input=step.parentElement.querySelector('input');if(input.disabled)return;const n=Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value)+Number(step.dataset.step)));input.value=n;input.dispatchEvent(new Event('change',{bubbles:true}));return;}
  const mode=event.target.closest('[data-mode]');if(mode){state.mode=mode.dataset.mode;renderModels();change();return;}
  const active=event.target.closest('[data-active]');if(active){state.active=Number(active.dataset.active);renderModels();change();return;}
  const plotButton=event.target.closest('[data-plot]');if(plotButton){plot=plotButton.dataset.plot;renderChart();return;}
  if(event.target.closest('[data-method]'))$('#rules-dialog').showModal();
  if(event.target.closest('[data-close]'))event.target.closest('dialog').close();
});
document.addEventListener('change',event=>{
  const input=event.target;
  if(input.dataset.side){
    const {side,key}=input.dataset;let value=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;
    state[side]=normalizeModel({...state[side],[key]:value});
    const field=input.closest('.field');
    if(field)field.dataset.valued=String(input.type==='number'?state[side][key]!==0:['special','power'].includes(key)&&state[side][key]!=='normal');
    if(key==='special'||key==='power'){
      const label=input.closest('.select-field').querySelector('.select-label');
      const symbol=key==='special'?({normal:'attack',critical:'critical',dual:'dual',combo:'combo',half:'half',knockdown:'knockdown',counterstrike:'defence'})[value]:value==='assassin'?'assassin':'dice';
      label.innerHTML=abilityIcon(symbol)+(key==='special'?'Special ability':'Damage dice');
    }
    if(input.type==='number')input.value=state[side][key];
    change();return;
  }
  if(input.dataset.condition){state.conditions[input.dataset.condition]=input.checked;change();return;}
  if(input.id==='in-btb'){state.inBtb=input.checked;renderModels();change();return;}
  const map={'range':'range','challenge-modifier':'challengeModifier','ranged-defence':'rangedDefence'};
  if(map[input.id]){state[map[input.id]]=Number(input.value);state=sanitize(state);input.value=state[map[input.id]];if(input.type==='number')input.closest('.field').dataset.valued=String(state[map[input.id]]!==0);change();}
});
document.addEventListener('input',event=>{
  const input=event.target;
  if((input.dataset.side||['challenge-modifier','ranged-defence'].includes(input.id)) && (input.type==='text'||input.type==='number'&&input.value!==''&&input.validity.valid))input.dispatchEvent(new Event('change',{bubbles:true}));
});
window.addEventListener('resize',()=>renderChart());
$('#threshold').addEventListener('input',event=>{threshold=Number(event.target.value);renderChart();});
for(const id of ['rules-button','sources-button'])$('#'+id).onclick=()=>$('#rules-dialog').showModal();
$('#reset-button').onclick=()=>{state=defaults();renderModels();change();toast('Defaults restored. Saved scenarios are still available.');};
$('#share-button').onclick=async()=>{
  const url=new URL(location.href);url.hash='s='+encodeURIComponent(JSON.stringify(state));
  try {await navigator.clipboard.writeText(url.href);toast('Scenario link copied.');}catch{toast('Could not copy. The scenario link is now in the address bar.');}
  history.replaceState(null,'',url);
};
function readScenarios(){try {const items=JSON.parse(localStorage.getItem('sensou-calc-scenarios')||'[]');return Array.isArray(items)?items.slice(0,30).filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'):[];}catch{return [];}}
function showScenarios(){
  const scenarios=readScenarios();
  $('#scenario-list').innerHTML=scenarios.length?scenarios.map(s=>`<div class="saved-scenario"><button class="scenario-load" data-load="${escape(s.id)}"><strong>${escape(s.name)}</strong><small>${s.state?.mode==='ranged'?'Ranged':'Melee'} · ${escape(s.state?.a?.name||'Model A')} / ${escape(s.state?.b?.name||'Model B')}</small></button><button class="icon-button" data-delete="${escape(s.id)}" aria-label="Delete scenario ${escape(s.name)}">×</button></div>`).join(''):'<p class="empty-state">No saved matchups. Yet.</p>';
}
$('#save-button').onclick=()=>{showScenarios();$('#scenarios-dialog').showModal();};
$('#scenario-form').onsubmit=event=>{event.preventDefault();const scenarios=readScenarios(),name=$('#scenario-name').value.trim();if(!name)return;scenarios.unshift({id:crypto.randomUUID(),name,state:structuredClone(state)});try{localStorage.setItem('sensou-calc-scenarios',JSON.stringify(scenarios.slice(0,30)));$('#scenario-name').value='';showScenarios();toast('Scenario saved.');}catch{toast('Could not save on this device.');}};
$('#scenario-list').onclick=event=>{
  const load=event.target.closest('[data-load]'),remove=event.target.closest('[data-delete]');
  if(load){try{state=sanitize(readScenarios().find(s=>s.id===load.dataset.load).state);renderModels();change();$('#scenarios-dialog').close();toast('Scenario loaded.');}catch{toast('Could not load this scenario.');}}
  if(remove){try{localStorage.setItem('sensou-calc-scenarios',JSON.stringify(readScenarios().filter(s=>s.id!==remove.dataset.delete)));showScenarios();}catch{toast('Could not delete this scenario.');}}
};
$('#export-button').onclick=()=>{
  if(!result)return;const series=chartSeries(),names=legendNames();
  const cell=s=>'"'+String(s).replaceAll('"','""')+'"';
  const rows=[['Chart',plot],['Mode',state.mode],['Threshold',...names.slice(0,series.length)],...Array.from({length:Math.max(...series.map(s=>s.length))},(_,n)=>[n,...series.map(s=>s[n]||0)])];
  // Quoted, prefixed names prevent spreadsheet formula injection.
  const csv='\uFEFF'+rows.map(row=>row.map(v=>cell(typeof v==='string'&&/^[=+@\-]/.test(v)?"'"+v:v)).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`sensou-${state.mode}-${plot}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
$('#install-button').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else{$('#install-status').textContent=$('#offline-status').textContent;$('#install-dialog').showModal();}};
function offlineStatus(ready){$('#offline-status').innerHTML=`<i></i>${ready?'Offline ready':'Preparing offline cache'}`;}
if('serviceWorker'in navigator){
  navigator.serviceWorker.register('./sw.js').then(async registration=>{
    await navigator.serviceWorker.ready;offlineStatus(true);
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)toast('Update ready. Close all app windows and reopen to update.');});});
  }).catch(()=>{$('#offline-status').textContent='Offline cache unavailable';});
}else $('#offline-status').textContent='Offline cache unsupported';
window.addEventListener('offline',()=>{$('#offline-status').innerHTML='<i></i> Offline · calculated locally';});
window.addEventListener('online',()=>{offlineStatus(Boolean(navigator.serviceWorker?.controller));});
$('#sl-limit-note').textContent='The shortcut extends the Wound Table beyond SL 10: Damage Roll 2 → max(0, SL − 3); 3 → max(0, SL − 2); 4–5 → max(0, SL − 1); 6–8 → SL; 9–10 → SL + 1; 11 → SL + 2; 12 → SL + 3. This extension is explicitly agreed for this app.';
$('.results').append($('.chart-panel'));
renderModels();syncTraitControls();calculate();
