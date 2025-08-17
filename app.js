// Airy Multi Screen Dark Simplified + Explain + About + LaTeX
'use strict';

const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const byId=(id)=>document.getElementById(id);
const fmtInt=(n)=> isFinite(n)? new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(n):'--';
const fmtMoney=(n)=> '₹'+fmtInt(n);
const clamp=(x,a,b)=>Math.min(Math.max(x,a),b);

// -------- math engine --------
function yearsToRetire(age, retireAge){ return Math.max(0, retireAge - age); }
function finalSalaryMonthly(salaryNow, growthPct, years){ const g=Number(growthPct)/100; return salaryNow*Math.pow(1+g,years); }
function projectEPF(balance0, wage0, growthPct, empRatePct, erRatePct, epfRatePct, years){
  const r_m=Number(epfRatePct)/100/12, g=Number(growthPct)/100;
  let bal=Number(balance0), wage=Number(wage0);
  for (let y=0; y<years; y++){
    for (let m=0;m<12;m++){
      const emp=wage*(Number(empRatePct)/100);
      const er=wage*(Number(erRatePct)/100);
      bal=(bal+emp+er)*(1+r_m);
    }
    wage*=(1+g);
  }
  return bal;
}
function epsPension(pensionableSalary, serviceYears){ return (Number(pensionableSalary)*Math.max(0,Number(serviceYears)))/70; }
function projectNPS(balance0, contribMonthly, alloc, years, extraMonthly=0){
  const rE=10/100/12, rC=7.5/100/12, rG=7/100/12;
  const wE=Number(alloc.E)/100, wC=Number(alloc.C)/100, wG=Number(alloc.G)/100;
  const r_m=wE*rE + wC*rC + wG*rG;
  let bal=Number(balance0), contrib=Number(contribMonthly)+Number(extraMonthly);
  for (let i=0;i<12*years;i++){ bal=(bal+contrib)*(1+r_m); }
  return bal;
}
function annuityMonthly(amount, annRatePct){ const r=Number(annRatePct)/100; return amount*(r/12); }
function swpMonthly(pv, postRetNominalPct, horizonYears){
  const r_m=Number(postRetNominalPct)/100/12, n=Math.max(1,Math.round(horizonYears*12));
  if (r_m===0) return pv/n; return pv*r_m/(1-Math.pow(1+r_m,-n));
}
function toTodaysRupees(nominalAtRetire, inflationPct, years){ const pi=Number(inflationPct)/100; return nominalAtRetire/Math.pow(1+pi,years); }
function pensionScore(totalMonthlyNominal, targetNominal){ if (targetNominal<=0) return 100; return Math.min(100, Math.floor(100*totalMonthlyNominal/targetNominal)); }

// -------- state --------
const STORE='pradar_airy_state_v5';
let S = {
  age:32, retire_age:60, salary_now:80000, salary_growth:6,
  epf_balance:450000, epf_wage:60000, epf_emp_rate:12, epf_er_rate:3.67,
  eps_years:12, eps_ceiling:'yes',
  nps_balance:250000, nps_contrib:5000, extra_nps:0,
  alloc:{E:60,C:30,G:10},
  assumptions:{epf_rate:8.25, infl:4, ann:6.5, prr:6, horizon:20, trr:70}
};
function save(){ localStorage.setItem(STORE, JSON.stringify(S)); }
function load(){ const raw=localStorage.getItem(STORE); if(raw){ try{ S=JSON.parse(raw);}catch(_){} }}

// -------- router --------
const screens = ['home','wizard','results','learn','about'];
function navTo(route){
  const r = screens.includes(route) ? route : 'home';
  $$('.tabs .tab').forEach(t=> t.setAttribute('aria-current', t.id==='tab-'+r? 'page' : 'false'));
  screens.forEach(x=> byId('view-'+x).hidden = (x!==r));
  if (r==='results') renderResults();
}
window.addEventListener('hashchange', ()=> navTo(location.hash.replace('#/','')));

// ------- wiring helpers -------
function bindNumeric(id, path){
  const el = byId(id);
  el.addEventListener('input', ()=>{
    const v = Number(el.value||0);
    const keys = path.split('.');
    let p = S; for (let i=0;i<keys.length-1;i++){ p=p[keys[i]]; }
    p[keys[keys.length-1]] = v;
    save(); renderResults();
  });
  el.addEventListener('change', ()=> toast('Saved'));
}
function updateAllocSumWizard(){
  const e = Number(byId('w_allocE').value||0);
  const c = Number(byId('w_allocC').value||0);
  const g = Number(byId('w_allocG').value||0);
  const s = e + c + g;
  byId('w_alloc_sum').textContent = String(s);
  byId('w_alloc_err').textContent = (s===100? '' : 'E plus C plus G must equal 100');
  return s===100;
}

// ------- wizard -------
function initWizard(){
  // step 1 bind
  bindNumeric('w_age','age'); bindNumeric('w_ret','retire_age');
  bindNumeric('w_sal','salary_now'); bindNumeric('w_growth','salary_growth');
  // step 2 bind
  bindNumeric('w_epf','epf_balance'); bindNumeric('w_epsyrs','eps_years');
  bindNumeric('w_nps','nps_contrib'); bindNumeric('w_extra','extra_nps');
  bindNumeric('w_epf_wage','epf_wage'); bindNumeric('w_emp','epf_emp_rate'); bindNumeric('w_er','epf_er_rate');
  bindNumeric('w_nps_bal','nps_balance');
  byId('w_eps_cap').addEventListener('change', (e)=>{ S.eps_ceiling=e.target.value; save(); renderResults(); toast('Saved'); });
  ['w_allocE','w_allocC','w_allocG'].forEach(id=> byId(id).addEventListener('input', ()=>{
    S.alloc.E = Number(byId('w_allocE').value||0);
    S.alloc.C = Number(byId('w_allocC').value||0);
    S.alloc.G = Number(byId('w_allocG').value||0);
    updateAllocSumWizard(); save(); renderResults();
  }));
  // step navigation
  $$('[data-next]').forEach(b=> b.addEventListener('click', ()=>{
    byId('view-wizard').querySelector('.step-card').hidden = true;
    byId('view-wizard').querySelector('[data-step="2"]').hidden = false;
  }));
  $$('[data-prev]').forEach(b=> b.addEventListener('click', ()=>{
    byId('view-wizard').querySelector('.step-card').hidden = false;
    byId('view-wizard').querySelector('[data-step="2"]').hidden = true;
  }));
  $$('[data-nav]').forEach(b=> b.addEventListener('click', ()=>{ location.hash='#/'+b.dataset.nav; }));
  $$('[data-finish]').forEach(b=> b.addEventListener('click', ()=>{ location.hash='#/results'; }));
}

// ------- compute + suggestions -------
function compute(d){
  const yrs=yearsToRetire(d.age,d.retire_age);
  const S_final=finalSalaryMonthly(d.salary_now,d.salary_growth,yrs);
  const EPF_final=projectEPF(d.epf_balance,d.epf_wage,d.salary_growth,d.epf_emp_rate,d.epf_er_rate,d.assumptions.epf_rate,yrs);
  const pensionableSalary = (d.eps_ceiling==='yes') ? Math.min(15000, d.epf_wage) : d.epf_wage;
  const EPS_monthly=epsPension(pensionableSalary,d.eps_years);
  const NPS_final=projectNPS(d.nps_balance,d.nps_contrib,d.alloc,yrs,d.extra_nps);
  let nps_ann_amt=0, nps_lump=NPS_final;
  if (NPS_final>500000){ nps_ann_amt=0.40*NPS_final; nps_lump=0.60*NPS_final; }
  const NPS_ann_month=annuityMonthly(nps_ann_amt,d.assumptions.ann);
  const draw_pv=EPF_final+nps_lump;
  const Draw_month=swpMonthly(draw_pv,d.assumptions.prr,d.assumptions.horizon);
  const total_monthly_nom=EPS_monthly+NPS_ann_month+Draw_month;
  const target_nom=d.assumptions.trr/100*S_final;
  const score=pensionScore(total_monthly_nom,target_nom);
  const total_monthly_real_today = toTodaysRupees(total_monthly_nom,d.assumptions.infl,yrs);
  return {yrs,S_final,EPF_final,EPS_monthly,NPS_final,nps_ann_amt,nps_lump,NPS_ann_month,Draw_month,total_monthly_nom,total_monthly_real_today,target_nom,score};
}

function bestSuggestions(){
  const base=compute(S);
  const suggestions=[];

  // Suggestion 1: Extra NPS to reach at least 80 percent of target
  const desired = 0.80*base.target_nom;
  let extraNeeded=0;
  if (base.total_monthly_nom < desired){
    const f=(x)=>{
      const NPS_final = projectNPS(S.nps_balance,S.nps_contrib,S.alloc,base.yrs,x);
      let ann_amt=0,lump=NPS_final; if (NPS_final>500000){ ann_amt=0.40*NPS_final; lump=0.60*NPS_final; }
      const ann_m = annuityMonthly(ann_amt,S.assumptions.ann);
      const draw_m = swpMonthly(base.EPF_final + lump,S.assumptions.prr,S.assumptions.horizon);
      return ann_m + draw_m + base.EPS_monthly;
    };
    let lo=0, hi=30000; for (let i=0;i<18;i++){ const mid=(lo+hi)/2; if (f(mid)>=desired) hi=mid; else lo=mid; }
    extraNeeded = Math.round(hi/500)*500;
  }
  const s1 = structuredClone(S); s1.extra_nps = Math.max(S.extra_nps, extraNeeded);
  suggestions.push({type:'addnps', label:`₹${fmtInt(extraNeeded)} per month more to NPS`, score: compute(s1).score, payload:{extra_nps:s1.extra_nps}});

  // Suggestion 2: Retire age to at least 62
  const s2 = structuredClone(S); s2.retire_age = Math.max(S.retire_age,62);
  suggestions.push({type:'age', label:`Retire at ${s2.retire_age}`, score: compute(s2).score, payload:{retire_age:s2.retire_age}});

  // Suggestion 3: Allocation preset that yields best score among a few
  const mixes=[{E:70,C:20,G:10,label:'E 70 C 20 G 10'},{E:60,C:30,G:10,label:'E 60 C 30 G 10'},{E:40,C:40,G:20,label:'E 40 C 40 G 20'}];
  let best={mix:null,score:-1,label:''};
  for (const m of mixes){ const s=structuredClone(S); s.alloc=m; const sc=compute(s).score; if (sc>best.score){ best={mix:m,score:sc,label:m.label}; } }
  suggestions.push({type:'alloc', label:`NPS mix ${best.label}`, score:best.score, payload:{alloc:best.mix}});

  // Rank by resulting score, descending
  suggestions.sort((a,b)=> b.score - a.score);
  return {base, suggestions};
}

// ------- results -------
function renderResults(){
  const prev = window.__prevScore;
  const {base, suggestions} = bestSuggestions();

  const arcLen=157, dash=Math.max(0, Math.min(arcLen, (base.score/100)*arcLen));
  const delta = (typeof prev==='number') ? (base.score - prev) : 0;
  $('#gauge-bar').setAttribute('stroke-dasharray', `${dash} ${arcLen-dash}`);
  const theta=Math.PI*(base.score/100), cx=50+40*Math.cos(Math.PI-theta), cy=50-40*Math.sin(Math.PI-theta);
  $('#gauge-dot').setAttribute('cx', cx.toFixed(2)); $('#gauge-dot').setAttribute('cy', cy.toFixed(2));
  byId('score').textContent = base.score;
  const dm = byId('delta_msg'); if (dm){ dm.textContent = (delta>0? `Score +${delta}` : delta<0? `Score ${delta}` : ''); }
  byId('total_nom').textContent = fmtMoney(base.total_monthly_nom);
  byId('total_real').textContent = fmtMoney(base.total_monthly_real_today);
  byId('trr_lbl').textContent = `${S.assumptions.trr} percent`;
  byId('target_nom').textContent = fmtMoney(base.target_nom);
  const gap = Math.max(0, base.target_nom - base.total_monthly_nom);
  byId('gap_nom').textContent = fmtMoney(gap);
  byId('gap_closed').textContent = (base.target_nom>0 ? (100*(base.total_monthly_nom/base.target_nom)).toFixed(1)+'%' : '--');
  window.__prevScore = base.score;

  const lines = byId('income_lines'); lines.innerHTML='';
  const add = (label,val)=>{ const li=document.createElement('li'); li.className='row'; li.innerHTML=`<span class="label">${label}</span><span class="val">${fmtMoney(val)}</span>`; lines.appendChild(li); };
  add('EPS pension', base.EPS_monthly);
  add('NPS annuity - minimum 40 percent if eligible', base.NPS_ann_month);
  add('Drawdown - EPF plus 60 percent NPS', base.Draw_month);

  byId('income_details').innerHTML = `
    <div class="tiny">EPF corpus at retirement <strong>${fmtMoney(base.EPF_final)}</strong></div>
    <div class="tiny">NPS corpus at retirement <strong>${fmtMoney(base.NPS_final)}</strong></div>
    <div class="tiny">Annuity corpus <strong>${fmtMoney(base.nps_ann_amt)}</strong></div>
    <div class="tiny">Lump sum for drawdown <strong>${fmtMoney(base.nps_lump + base.EPF_final)}</strong></div>
  `;

  // Write suggestions to UI
  const list = byId('sugg_list');
  const sAdd = suggestions.find(s=>s.type==='addnps');
  const sAge = suggestions.find(s=>s.type==='age');
  const sAlloc = suggestions.find(s=>s.type==='alloc');
  if (sAdd){ byId('suggest_addnps_amt').textContent = sAdd.label.split(' leads')[0]; byId('suggest_addnps_score').textContent = String(sAdd.score); }
  if (sAge){ byId('suggest_age').textContent = String(sAge.payload.retire_age); byId('suggest_age_score').textContent = String(sAge.score); }
  if (sAlloc){ byId('suggest_alloc_score').textContent = String(sAlloc.score); }

  // Wire Apply buttons each time
  list.querySelectorAll('.apply').forEach(btn=>{
    btn.onclick = ()=>{
      const type = btn.dataset.action;
      if (type==='addnps' && sAdd){ S.extra_nps = sAdd.payload.extra_nps; }
      if (type==='age' && sAge){ S.retire_age = sAge.payload.retire_age; }
      if (type==='alloc' && sAlloc){ S.alloc = sAlloc.payload.alloc; }
      save(); renderResults();
      toast('Applied');
    };
  });

  // Top suggestion one-click
  byId('btn-apply-sugg').onclick = ()=>{
    const top = suggestions[0];
    if (!top) return;
    if (top.type==='addnps') S.extra_nps = top.payload.extra_nps;
    if (top.type==='age') S.retire_age = top.payload.retire_age;
    if (top.type==='alloc') S.alloc = top.payload.alloc;
    save(); renderResults(); toast('Suggestion applied');
  };
}

// ------- modals and helpers -------
function toast(msg, ms=2200){ const t=byId('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), ms); }

function initAssumptions(){
  const modal = byId('ass-modal');
  byId('btn-assumptions').onclick=()=> modal.classList.remove('hidden');
  byId('ass-close').onclick=()=> modal.classList.add('hidden');
  modal.addEventListener('click', (e)=>{ if (e.target===modal) modal.classList.add('hidden'); });
  byId('ass-reset').onclick=()=>{ S = {
    age:32, retire_age:60, salary_now:80000, salary_growth:6,
    epf_balance:450000, epf_wage:60000, epf_emp_rate:12, epf_er_rate:3.67,
    eps_years:12, eps_ceiling:'yes',
    nps_balance:250000, nps_contrib:5000, extra_nps:0,
    alloc:{E:60,C:30,G:10},
    assumptions:{epf_rate:8.25, infl:4, ann:6.5, prr:6, horizon:20, trr:70}
  }; save(); renderResults(); toast('Defaults restored'); };
  ['ass_epf_rate','ass_infl','ass_ann','ass_prr','ass_horizon','ass_trr'].forEach(id=>{
    byId(id).addEventListener('input', ()=>{
      S.assumptions.epf_rate = Number(byId('ass_epf_rate').value||8.25);
      S.assumptions.infl = Number(byId('ass_infl').value||4);
      S.assumptions.ann = Number(byId('ass_ann').value||6.5);
      S.assumptions.prr = Number(byId('ass_prr').value||6);
      S.assumptions.horizon = Number(byId('ass_horizon').value||20);
      S.assumptions.trr = Number(byId('ass_trr').value||70);
      save(); renderResults();
    });
  });
  modal.querySelectorAll('input').forEach(el=> el.addEventListener('change', ()=> toast('Saved')));
}
function initHelp(){
  const modal = byId('help-modal');
  byId('btn-help').onclick=()=> modal.classList.remove('hidden');
  byId('help-close').onclick=()=> modal.classList.add('hidden');
  modal.addEventListener('click', (e)=>{ if (e.target===modal) modal.classList.add('hidden'); });
}

// ------- nav and startup -------
function initHome(){
  byId('go-quick').onclick=()=>{ location.hash='#/wizard'; };
  byId('go-sample').onclick=()=>{ S = {
    age:32, retire_age:60, salary_now:80000, salary_growth:6,
    epf_balance:450000, epf_wage:60000, epf_emp_rate:12, epf_er_rate:3.67,
    eps_years:12, eps_ceiling:'yes',
    nps_balance:250000, nps_contrib:5000, extra_nps:0,
    alloc:{E:60,C:30,G:10},
    assumptions:{epf_rate:8.25, infl:4, ann:6.5, prr:6, horizon:20, trr:70}
  }; save(); location.hash='#/results'; };
}
function initExport(){
  byId('btn-export').onclick=()=> window.print();
  byId('btn-export-2').onclick=()=> window.print();
}

function setPrintDate(){
  const el = document.getElementById('print-date'); if(!el) return;
  const d = new Date();
  const s = d.toLocaleDateString('en-IN',{year:'numeric',month:'short',day:'2-digit'}).replace(',','');
  el.textContent = s;
}


// ---- Variables popup with LaTeX ----
const VAR_DEFS = {
  S_final: "\\(\\mathbf{S_{\\text{final}}}\\) : Final monthly salary at retirement",
  S_0: "\\(\\mathbf{S_0}\\) : Current monthly salary",
  g: "\\(\\mathbf{g}\\) : Annual salary growth rate",
  Y: "\\(\\mathbf{Y}\\) : Years until retirement",
  B_t: "\\(\\mathbf{B_t}\\) : Balance at month \\(t\\)",
  c_emp: "\\(\\mathbf{c^{emp}_t}\\) : Employee EPF contribution for the month",
  c_er: "\\(\\mathbf{c^{er}_t}\\) : Employer EPF contribution to EPF for the month",
  r_epf: "\\(\\mathbf{r_{epf}}\\) : EPF annual interest rate",
  P: "\\(\\mathbf{P}\\) : EPS monthly pension",
  S_p: "\\(\\mathbf{S_p}\\) : Pensionable salary for EPS",
  Y_s: "\\(\\mathbf{Y_s}\\) : Pensionable service years",
  W: "\\(\\mathbf{W}\\) : EPF wage used for EPS calculations",
  r: "\\(\\mathbf{r}\\) : Blended NPS annual return",
  w_E: "\\(\\mathbf{w_E}\\) : Weight for NPS E (equity)",
  r_E: "\\(\\mathbf{r_E}\\) : Annual return for NPS E",
  w_C: "\\(\\mathbf{w_C}\\) : Weight for NPS C (corporate bonds)",
  r_C: "\\(\\mathbf{r_C}\\) : Annual return for NPS C",
  w_G: "\\(\\mathbf{w_G}\\) : Weight for NPS G (government bonds)",
  r_G: "\\(\\mathbf{r_G}\\) : Annual return for NPS G",
  C: "\\(\\mathbf{C}\\) : Monthly NPS contribution",
  B_T: "\\(\\mathbf{B_T}\\) : NPS balance at retirement",
  I_ann: "\\(\\mathbf{I_{ann}}\\) : Monthly income from the annuity",
  A: "\\(\\mathbf{A}\\) : Annuity purchase amount",
  r_a: "\\(\\mathbf{r_a}}\\) : Annuity annual rate",
  PMT: "\\(\\mathbf{PMT}\\) : Monthly withdrawal amount from lump sum",
  PV: "\\(\\mathbf{PV}\\) : Present value of lump sum",
  r_m: "\\(\\mathbf{r_m}\\) : Monthly post retirement return",
  n: "\\(\\mathbf{n}\\) : Number of months for withdrawals",
  I_real: "\\(\\mathbf{I_{real}}\\) : Monthly income in today value",
  I_nom: "\\(\\mathbf{I_{nom}}\\) : Monthly income at retirement",
  pi: "\\(\\boldsymbol{\\pi}\\) : Annual inflation rate",
  Score: "\\(\\mathbf{Score}\\) : PensionScore from 0 to 100",
  Target: "\\(\\mathbf{Target}\\) : Target monthly income at retirement",
  tau: "\\(\\boldsymbol{\\tau}\\) : Target replacement rate of final salary"
};

function openVars(list){
  const ul = document.getElementById('vars-list');
  if(!ul) return;
  ul.innerHTML='';
  list.forEach(k=>{
    const li = document.createElement('li');
    li.innerHTML = VAR_DEFS[k] || (k + ": definition not set");
    ul.appendChild(li);
  });
  const modal = document.getElementById('vars-modal');
  modal.classList.remove('hidden');
  if (window.MathJax && MathJax.typesetPromise){
    MathJax.typesetPromise([ul]);
  }
}

function initVars(){
  document.querySelectorAll('.vars-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const keys = (btn.dataset.vars||'').split(',').map(s=>s.trim()).filter(Boolean);
      openVars(keys);
    });
  });
  const m = document.getElementById('vars-modal');
  document.getElementById('vars-close').addEventListener('click', ()=> m.classList.add('hidden'));
  m.addEventListener('click', (e)=>{ if (e.target===m) m.classList.add('hidden'); });
}

function boot(){
  load();
  if (!location.hash) location.hash='#/home';
  initHome(); initWizard(); initAssumptions(); initHelp(); initVars(); initExport(); setPrintDate(); window.addEventListener('beforeprint', setPrintDate);
  navTo(location.hash.replace('#/',''));
  renderResults();
}
document.addEventListener('DOMContentLoaded', boot);
