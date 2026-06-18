'use strict';

const LS_KEY = 'sportTrackerAB.v8';
const OLD_LS_KEYS = ['sportTrackerAB.v7','sportTrackerAB.v6','sportTrackerAB.v5','sportTrackerAB.v4','sportTrackerAB.v3','sportTrackerAB.v2'];
const DAY_MS = 86400000;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let state = loadState();
let selectedDate = isoToday();
let currentView = 'today';
let timer = { remaining: 0, interval: null, paused: false, label: 'Repos' };
let workoutTicker = null;
let deferredInstallPrompt = null;
let syncTimer = null;
let authUser = null;
let cloudBusy = false;

function defaultState() {
  return {
    startDate: localISO(mondayOf(new Date())),
    sessions: {},
    tests: [],
    routine: {},
    bodyWeights: [{ date: isoToday(), kg: 78 }],
    settings: { vibration: true, sound: true, bodyWeightKg: 78, cloudAutoSync: true },
    cloud: { lastSync: null, lastRestore: null, status: 'Non connecté' }
  };
}
function loadState() {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(LS_KEY) || OLD_LS_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
    const loaded = raw ? JSON.parse(raw) : {};
    const merged = { ...base, ...loaded };
    merged.settings = { ...base.settings, ...(loaded.settings || {}) };
    merged.cloud = { ...base.cloud, ...(loaded.cloud || {}) };
    merged.bodyWeights = Array.isArray(loaded.bodyWeights) && loaded.bodyWeights.length ? loaded.bodyWeights : [{ date: isoToday(), kg: Number(loaded.settings?.bodyWeightKg || 78) }];
    return merged;
  } catch (e) { return base; }
}
function saveState(options = {}) { localStorage.setItem(LS_KEY, JSON.stringify(state)); if (options.sync !== false) scheduleAutoSync(); }
function localISO(date) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function parseISO(iso) { const [y,m,d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d); }
function isoToday() { return localISO(new Date()); }
function mondayOf(date) { const d = new Date(date); const off = (d.getDay()+6)%7; d.setDate(d.getDate()-off); d.setHours(0,0,0,0); return d; }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
function fmtDate(iso) { return parseISO(iso).toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short'}); }
function fmtLongDate(iso) { return parseISO(iso).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }
function weekIndexFor(iso) { return Math.max(1, Math.floor((mondayOf(parseISO(iso))-parseISO(state.startDate))/(7*DAY_MS))+1); }
function typeForWeek(w) { return w % 2 ? 'A' : 'B'; }
function dayKeyFor(iso) { return parseISO(iso).getDay(); }
function planForDate(iso) { const week = weekIndexFor(iso); const type = typeForWeek(week); return { week, type, deload: week % 4 === 0, plan: PROGRAMME[type].days[dayKeyFor(iso)] }; }
function esc(v='') { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function toNum(v) { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; }
function mmss(sec) { sec = Math.max(0, Math.round(sec)); return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; }
function hms(sec) { sec = Math.max(0, Math.round(sec)); const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function formatDecimal(n, d=2) { return toNum(n) ? toNum(n).toFixed(d).replace('.', ',') : '-'; }
function durationInputs(prefix) { return toNum($(`#${prefix}H`)?.value)*3600 + toNum($(`#${prefix}M`)?.value)*60 + toNum($(`#${prefix}S`)?.value); }
function setDurationInputs(prefix, sec) { const h=$(`#${prefix}H`), m=$(`#${prefix}M`), s=$(`#${prefix}S`); if(!h||!m||!s) return; h.value = Math.floor(sec/3600) || ''; m.value = Math.floor((sec%3600)/60) || ''; s.value = Math.floor(sec%60) || ''; }
function avgSpeed(km, sec) { km=toNum(km); sec=toNum(sec); return km>0 && sec>0 ? km/(sec/3600) : 0; }
function pace(km, sec) { km=toNum(km); sec=toNum(sec); return km>0 && sec>0 ? `${mmss(sec/km)}/km` : '-'; }
function makeId(name) { return String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
function currentBodyWeight(iso=selectedDate) {
  const rows = [...(state.bodyWeights||[])].filter(r => r.date && toNum(r.kg)).sort((a,b)=>a.date.localeCompare(b.date));
  let chosen = rows[0] || { kg: 78 };
  rows.forEach(r => { if (r.date <= iso) chosen = r; });
  return toNum(chosen.kg) || 78;
}
function getSession(iso) {
  if (!state.sessions[iso]) state.sessions[iso] = newSession();
  const s = state.sessions[iso];
  s.metrics = s.metrics || {};
  s.exercises = s.exercises || {};
  s.extraExercises = s.extraExercises || [];
  s.stopwatch = s.stopwatch || { elapsedSec: 0, running: false, startedAt: null };
  return s;
}
function newSession() { return { completed:false, freeMode:false, rpe:'', backPain:'', notes:'', metrics:{}, exercises:{}, extraExercises:[], stopwatch:{elapsedSec:0,running:false,startedAt:null} }; }
function elapsedWorkout(sess) { const sw=sess.stopwatch||{}; return Math.round((sw.elapsedSec||0) + (sw.running && sw.startedAt ? (Date.now()-sw.startedAt)/1000 : 0)); }
function allExercisesForSession(iso) { const { plan } = planForDate(iso); const sess = getSession(iso); return [...plan.exercises, ...(sess.extraExercises||[])]; }
function hasKind(exercises, kind) { return exercises.some(e => e.kind === kind); }
function getExerciseLog(iso, exercise) {
  const s = getSession(iso); const id = exercise.id || makeId(exercise.name + '-' + (exercise.kind || ''));
  if (!s.exercises[id]) s.exercises[id] = { collapsed:false, sets:[] };
  const log = s.exercises[id];
  const wanted = Math.max(1, Number(exercise.sets || 1));
  while (log.sets.length < wanted) log.sets.push({ done:false, actual:'', load: exercise.defaultLoad || '', note:'' });
  return log;
}
function plannedSets(exs) { return exs.reduce((n,e)=> n + Math.max(1, Number(e.sets||1)),0); }
function doneSets(iso, exs) { return exs.reduce((n,e)=> n + getExerciseLog(iso,e).sets.filter(s=>s.done).length,0); }
function pct(iso, exs) { const total=plannedSets(exs); return total ? Math.round(doneSets(iso, exs)/total*100) : 0; }
function setView(view) { currentView = view; $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === view)); $$('.view').forEach(v => v.classList.toggle('active', v.id === view)); render(); }
function render() { renderToday(); renderPlanning(); renderSession(); renderCharts(); renderRoutine(); renderHistory(); renderSettings(); }

function renderToday() {
  const root = $('#today'); const iso=isoToday(); const {week,type,deload,plan}=planForDate(iso); const exs=allExercisesForSession(iso); const stats=weeklyStats(mondayOf(parseISO(iso)));
  root.innerHTML = `<section class="card"><div class="between"><div><p class="eyebrow">Aujourd'hui</p><h2>${esc(fmtLongDate(iso))}</h2></div><span class="badge ${deload?'warn':''}">Semaine ${week} · ${type}${deload?' · allégée':''}</span></div><h3>${esc(plan.title)}</h3><p class="muted">${esc(plan.objective)}</p><div class="progressbar"><span style="width:${pct(iso,exs)}%"></span></div><p class="muted">${doneSets(iso,exs)}/${plannedSets(exs)} séries cochées</p><div class="row"><button class="primary" id="goSessionToday">Démarrer / continuer</button><button class="ghost" id="goPlanningToday">Planning</button><button class="ghost" id="goRoutineToday">Routine</button></div></section><section class="grid grid-3"><div class="stat"><small>Séances faites cette semaine</small><strong>${stats.doneSessions}</strong></div><div class="stat"><small>Volume total semaine</small><strong>${formatDecimal(stats.volumeKg,0)}</strong><span class="muted"> kg</span></div><div class="stat"><small>Douleur moyenne</small><strong>${stats.avgPain || '-'}</strong><span class="muted"> /10</span></div></section>`;
  $('#goSessionToday').onclick = () => { selectedDate=isoToday(); setView('session'); };
  $('#goPlanningToday').onclick = () => setView('planning');
  $('#goRoutineToday').onclick = () => setView('routine');
}

function renderPlanning() {
  const root=$('#planning'); const base=mondayOf(parseISO(selectedDate)); const week=weekIndexFor(localISO(base)); const type=typeForWeek(week); const days=Array.from({length:7},(_,i)=>localISO(addDays(base,i)));
  root.innerHTML = `<section class="card"><div class="week-nav"><button class="ghost" id="prevWeek">← Semaine</button><div><p class="eyebrow">Planning</p><h2>Semaine ${week} · ${esc(PROGRAMME[type].label)}</h2><p class="muted">${fmtDate(days[0])} au ${fmtDate(days[6])}</p></div><button class="ghost" id="nextWeek">Semaine →</button></div><div class="row"><button class="ghost" id="todayWeek">Aujourd'hui</button><button class="ghost" id="jumpA">Semaine A suivante</button><button class="ghost" id="jumpB">Semaine B suivante</button></div></section><section class="day-grid">${days.map(dayCard).join('')}</section>`;
  $('#prevWeek').onclick = () => { selectedDate=localISO(addDays(base,-7)); renderPlanning(); };
  $('#nextWeek').onclick = () => { selectedDate=localISO(addDays(base,7)); renderPlanning(); };
  $('#todayWeek').onclick = () => { selectedDate=isoToday(); renderPlanning(); };
  $('#jumpA').onclick = () => jumpWeek('A'); $('#jumpB').onclick = () => jumpWeek('B');
  $$('.day-card').forEach(btn => btn.onclick = () => { selectedDate=btn.dataset.iso; setView('session'); });
}
function jumpWeek(t) { let d=mondayOf(parseISO(selectedDate)); for(let i=0;i<12;i++){ d=addDays(d,7); if(typeForWeek(weekIndexFor(localISO(d)))===t) break; } selectedDate=localISO(d); renderPlanning(); }
function dayCard(iso) { const {week,type,deload,plan}=planForDate(iso); const exs=allExercisesForSession(iso); const s=getSession(iso); return `<button class="day-card ${iso===selectedDate?'active':''} ${s.completed?'done':''}" data-iso="${iso}"><strong>${fmtDate(iso)}</strong><small>${type} · S${week}${deload?' · allégée':''}</small><span class="badge ${s.completed?'done':''}">${pct(iso,exs)}%</span><small>${esc(plan.title)}</small></button>`; }

function renderSession() {
  const root=$('#session'); const {week,type,deload,plan}=planForDate(selectedDate); const sess=getSession(selectedDate); const exs=allExercisesForSession(selectedDate); const runPlanned=hasKind(exs,'run'); const bikePlanned=hasKind(exs,'bike'); const strengthSec=elapsedWorkout(sess); const runSec=toNum(sess.metrics.runDurationSec); const bikeSec=toNum(sess.metrics.bikeDurationSec);
  root.innerHTML = `<section class="card"><div class="between"><div><p class="eyebrow">Séance</p><h2>${esc(plan.name)} · ${esc(fmtLongDate(selectedDate))}</h2></div><span class="badge ${deload?'warn':''}">Semaine ${week} · ${type}${deload?' · allégée':''}</span></div><h3>${esc(sess.freeMode ? 'Séance libre + consignes du jour' : plan.title)}</h3><p class="muted">${esc(plan.objective)}</p><div class="progressbar"><span style="width:${pct(selectedDate,exs)}%"></span></div><p class="muted">${doneSets(selectedDate,exs)}/${plannedSets(exs)} séries cochées · volume estimé : ${formatDecimal(sessionVolumeKg(selectedDate),0)} kg</p><div class="row"><button class="ghost" id="prevDay">← Jour</button><button class="ghost" id="nextDay">Jour →</button><button class="ghost" id="backPlanning">Voir planning</button></div></section>
  <section class="card"><div class="between"><div><p class="eyebrow">Chronomètre hors cardio</p><h3>Muscu, kettlebell, mobilité, poids du corps</h3></div><strong class="big-time" id="workoutElapsed">${hms(strengthSec)}</strong></div><p class="muted">Le vélo et la course se renseignent manuellement après la sortie. Ce chrono sert au reste de la séance.</p><div class="row"><button class="primary" id="startWorkout">${sess.stopwatch.running?'En cours': strengthSec ? 'Reprendre' : 'Lancer séance'}</button><button class="ghost" id="pauseWorkout">Pause</button><button class="ghost" id="stopWorkout">Arrêter</button><button class="danger" id="resetWorkout">Reset chrono</button></div></section>
  <section class="card instruction-card"><p class="eyebrow">Consignes avant de partir</p><h3>Ce qui est prévu aujourd'hui</h3><ul class="instruction-list">${plan.exercises.map(e=>`<li><strong>${esc(e.name)}</strong> <span class="muted">${esc(e.target)} · ${esc(e.sets)} x ${esc(e.reps)} · repos ${esc(e.restSec||0)}s</span></li>`).join('')}</ul></section>
  ${runPlanned ? cardioBlock('run', sess) : ''}${bikePlanned ? cardioBlock('bike', sess) : ''}
  <section class="card"><div class="between"><div><p class="eyebrow">Exercices</p><h3>Séries, reps, charge et repos</h3></div><span class="badge">Poids actuel : ${formatDecimal(currentBodyWeight(selectedDate),1)} kg</span></div><div id="exerciseList">${exs.filter(e=>e.kind!=='run' && e.kind!=='bike').map(e=>exerciseCard(e)).join('')}</div>${freeBuilder()}</section>
  <section class="card"><h3>Bilan global</h3><div class="grid grid-3"><label><span>Durée hors cardio</span><input id="strengthDurationDisplay" type="text" readonly value="${hms(strengthSec)}"></label><label><span>RPE</span><input id="rpe" type="number" min="1" max="10" value="${esc(sess.rpe)}" placeholder="/10"></label><label><span>Douleur dos/omoplates</span><input id="backPain" type="number" min="0" max="10" value="${esc(sess.backPain)}" placeholder="/10"></label></div><label><span>Notes</span><textarea id="notes" placeholder="Sensations, douleur, modifications...">${esc(sess.notes)}</textarea></label><div class="footer-actions"><button class="primary" id="saveSession">Enregistrer</button><button class="ghost" id="toggleComplete">${sess.completed?'Marquer non terminée':'Marquer terminée'}</button></div></section>`;
  setDurationInputs('run', runSec); setDurationInputs('bike', bikeSec); bindSessionEvents(); bindWorkoutTimer(sess); updateCardioComputed();
}
function cardioBlock(kind, sess) { const isRun=kind==='run'; const title=isRun?'Course à pied':'Vélo'; const dist=sess.metrics[`${kind}DistanceKm`]||''; const sec=toNum(sess.metrics[`${kind}DurationSec`]); const speed=avgSpeed(dist,sec); return `<section class="card"><h3>Bilan ${title} à renseigner après séance</h3><div class="metric-block"><div class="between"><div><strong>${title}</strong><p class="muted">Distance + temps = vitesse moyenne${isRun?' et allure':''} calculée automatiquement.</p></div><span class="badge" id="${kind}Badge">${formatDecimal(speed,2)} km/h${isRun?' · '+pace(dist,sec):''}</span></div><div class="grid grid-4"><label><span>Distance ${title.toLowerCase()}, km</span><input id="${kind}DistanceKm" type="number" step="0.01" value="${esc(dist)}" placeholder="ex : ${isRun?'7.01':'50.36'}"></label><label><span>Heures</span><input id="${kind}H" type="number" min="0"></label><label><span>Minutes</span><input id="${kind}M" type="number" min="0" max="59"></label><label><span>Secondes</span><input id="${kind}S" type="number" min="0" max="59"></label></div><div class="computed"><span>Vitesse : <strong id="${kind}SpeedOut">${formatDecimal(speed,2)} km/h</strong></span>${isRun?`<span>Allure : <strong id="${kind}PaceOut">${pace(dist,sec)}</strong></span>`:''}</div></div></section>`; }
function exerciseCard(e) { const log=getExerciseLog(selectedDate,e); const id=e.id || makeId(e.name + '-' + e.kind); const bw=e.bodyweight; const tags=(e.muscles||[]).map(m=>`<span>${esc(m)}</span>`).join(''); return `<article class="exercise-card" data-exid="${esc(id)}"><button type="button" class="exercise-head" data-action="toggleExercise"><div><strong>${esc(e.name)}</strong><small class="muted">${esc(e.target)} · prévu ${esc(e.sets)} x ${esc(e.reps)} · repos ${esc(e.restSec||0)}s</small><div class="muscle-tags">${tags}</div></div><span class="badge">${log.sets.filter(s=>s.done).length}/${log.sets.length}</span></button><div class="exercise-body ${log.collapsed?'hidden':''}">${log.sets.map((s,i)=>setRow(e,id,s,i,bw)).join('')}</div></article>`; }
function setRow(e,id,s,i,bw) { const suggested = bw ? currentBodyWeight(selectedDate) + toNum(s.load || e.defaultLoad) : toNum(s.load || e.defaultLoad); return `<div class="set-row ${s.done?'done':''}" data-exid="${esc(id)}" data-set="${i}"><label><span>Série ${i+1}</span><input type="checkbox" data-field="done" ${s.done?'checked':''}></label><label><span>Réel reps/temps</span><input data-field="actual" value="${esc(s.actual)}" placeholder="${esc(e.reps)}"></label><label><span>${bw?'Lest ajouté kg':'Charge kg'}</span><input data-field="load" type="number" step="0.5" value="${esc(s.load || e.defaultLoad || '')}" placeholder="${bw?'0':e.defaultLoad||0}"></label><label><span>Volume estimé</span><input readonly value="${formatDecimal(setVolume(e,s),0)} kg"></label><button class="small ghost" type="button" data-action="rest" data-rest="${e.restSec||0}">Repos</button></div>`; }
function freeBuilder() { return `<div class="free-builder"><div class="between"><div><h3>Séance libre / exercice ajouté</h3><p class="muted">Ajoute un exercice si tu n'as pas pu respecter l'ordre ou si tu fais autre chose.</p></div><label style="max-width:210px"><span>Mode séance libre</span><select id="freeMode"><option value="false">Non</option><option value="true" ${getSession(selectedDate).freeMode?'selected':''}>Oui</option></select></label></div><div class="grid grid-4"><label><span>Exercice</span><select id="addExerciseName">${EXERCISE_LIBRARY.map(e=>`<option value="${esc(e.name)}">${esc(e.name)} · ${esc(e.muscles.join('/'))}</option>`).join('')}</select></label><label><span>Séries</span><input id="addExerciseSets" type="number" value="3" min="1"></label><label><span>Répétitions prévues</span><input id="addExerciseReps" value="10"></label><label><span>Repos s</span><input id="addExerciseRest" type="number" value="90"></label></div><div class="footer-actions"><button class="primary" id="addExerciseBtn" type="button">Ajouter exercice</button></div></div>`; }
function bindSessionEvents() {
  $('#prevDay').onclick=()=>{ selectedDate=localISO(addDays(parseISO(selectedDate),-1)); renderSession(); };
  $('#nextDay').onclick=()=>{ selectedDate=localISO(addDays(parseISO(selectedDate),1)); renderSession(); };
  $('#backPlanning').onclick=()=>setView('planning'); $('#saveSession').onclick=()=>{ saveSessionForm(); render(); };
  $('#toggleComplete').onclick=()=>{ const s=getSession(selectedDate); saveSessionForm(false); s.completed=!s.completed; saveState(); render(); };
  $('#freeMode').onchange=e=>{ getSession(selectedDate).freeMode=e.target.value==='true'; saveState(); renderSession(); };
  $('#addExerciseBtn').onclick=addFreeExercise;
  ['run','bike'].forEach(kind=>['DistanceKm','H','M','S'].forEach(part=>{ const el=$(`#${kind}${part}`); if(el) el.oninput=()=>{ updateCardioComputed(); saveSessionForm(false); }; }));
  ['rpe','backPain','notes'].forEach(id=>{ const el=$(`#${id}`); if(el) el.oninput=()=>saveSessionForm(false); });
  $('#session').onclick = e => { const action=e.target.dataset.action; if(action==='toggleExercise'){ const card=e.target.closest('.exercise-card'); const body=card.querySelector('.exercise-body'); body.classList.toggle('hidden'); const log=findExerciseLogById(card.dataset.exid); if(log){ log.collapsed=body.classList.contains('hidden'); saveState(); } } if(action==='rest'){ const sec=Number(e.target.dataset.rest||0); if(sec) startTimer(sec,'Repos série'); } };
  $$('#session .set-row input').forEach(input => input.onchange = e => { updateSetFromRow(e.target.closest('.set-row')); });
  $$('#session .set-row input').forEach(input => input.oninput = e => { updateSetFromRow(e.target.closest('.set-row'), false); });
}
function findExerciseLogById(id){ return getSession(selectedDate).exercises[id]; }
function updateSetFromRow(row, maybeRest=true){ const log=findExerciseLogById(row.dataset.exid); if(!log) return; const set=log.sets[Number(row.dataset.set)]; const wasDone=!!set.done; row.querySelectorAll('input').forEach(inp=>{ const f=inp.dataset.field; if(!f) return; set[f] = f==='done' ? inp.checked : inp.value; }); saveSessionForm(false); if(set.done && !wasDone && maybeRest){ const restBtn=row.querySelector('[data-action="rest"]'); const sec=Number(restBtn?.dataset.rest||0); if(sec) startTimer(sec,'Repos série'); } renderSession(); }
function addFreeExercise(){ const name=$('#addExerciseName').value; const base=EXERCISE_LIBRARY.find(e=>e.name===name) || {}; const custom={...base, id:'free-'+Date.now(), name, sets:Number($('#addExerciseSets').value||1), reps:$('#addExerciseReps').value||base.defaultReps||'', target:'Ajout libre', restSec:Number($('#addExerciseRest').value||base.restSec||0), kind:base.kind||'strength', muscles:base.muscles||[], bodyweight:!!base.bodyweight, defaultLoad:base.defaultLoad||0}; getSession(selectedDate).extraExercises.push(custom); saveState(); renderSession(); }
function bindWorkoutTimer(sess){ clearInterval(workoutTicker); const update=()=>{ const sec=elapsedWorkout(sess); const out=$('#workoutElapsed'); if(out) out.textContent=hms(sec); const disp=$('#strengthDurationDisplay'); if(disp) disp.value=hms(sec); const btn=$('#startWorkout'); if(btn) btn.textContent=sess.stopwatch.running?'En cours': sec?'Reprendre':'Lancer séance'; }; update(); workoutTicker=setInterval(update,1000); $('#startWorkout').onclick=()=>{ if(!sess.stopwatch.running){ sess.stopwatch.running=true; sess.stopwatch.startedAt=Date.now(); saveState(); update(); } }; $('#pauseWorkout').onclick=()=>{ if(sess.stopwatch.running){ sess.stopwatch.elapsedSec=elapsedWorkout(sess); sess.stopwatch.running=false; sess.stopwatch.startedAt=null; saveState(); update(); } }; $('#stopWorkout').onclick=()=>{ sess.stopwatch.elapsedSec=elapsedWorkout(sess); sess.stopwatch.running=false; sess.stopwatch.startedAt=null; saveSessionForm(false); saveState(); update(); }; $('#resetWorkout').onclick=()=>{ if(confirm('Remettre le chrono hors cardio à zéro ?')){ sess.stopwatch={elapsedSec:0,running:false,startedAt:null}; saveSessionForm(false); saveState(); update(); } }; }
function updateCardioComputed(){ ['run','bike'].forEach(kind=>{ const km=$(`#${kind}DistanceKm`)?.value||''; const sec=durationInputs(kind); const sp=avgSpeed(km,sec); const speedOut=$(`#${kind}SpeedOut`); if(speedOut) speedOut.textContent=`${formatDecimal(sp,2)} km/h`; const paceOut=$(`#${kind}PaceOut`); if(paceOut) paceOut.textContent=pace(km,sec); const badge=$(`#${kind}Badge`); if(badge) badge.textContent=`${formatDecimal(sp,2)} km/h${kind==='run'?' · '+pace(km,sec):''}`; }); }
function saveSessionForm(repaint=true){ const s=getSession(selectedDate); ['run','bike'].forEach(kind=>{ const dist=$(`#${kind}DistanceKm`)?.value; if(dist!==undefined){ const sec=durationInputs(kind); s.metrics[`${kind}DistanceKm`]=dist; s.metrics[`${kind}DurationSec`]=sec; s.metrics[`${kind}AvgSpeed`]=avgSpeed(dist,sec).toFixed(2); if(kind==='run') s.metrics.runPace=pace(dist,sec); } }); s.metrics.strengthDurationSec=elapsedWorkout(s); s.rpe=$('#rpe')?.value||s.rpe||''; s.backPain=$('#backPain')?.value||s.backPain||''; s.notes=$('#notes')?.value||s.notes||''; s.metrics.volumeKg=sessionVolumeKg(selectedDate); saveState(); if(repaint) renderSession(); }

function parseReps(v){ const m=String(v||'').replace(',', '.').match(/[0-9]+(\.[0-9]+)?/); return m ? Number(m[0]) : 0; }
function setVolume(ex,set){ if(!set.done) return 0; const reps=parseReps(set.actual) || parseReps(ex.reps); if(!reps) return 0; const load=toNum(set.load || ex.defaultLoad); const effective = ex.bodyweight ? currentBodyWeight(selectedDate) + load : load; return Math.max(0,effective) * reps; }
function sessionVolumeKg(iso){ return allExercisesForSession(iso).filter(e=>e.kind!=='run'&&e.kind!=='bike'&&e.kind!=='mobility').reduce((sum,e)=>{ const log=getExerciseLog(iso,e); return sum + log.sets.reduce((n,s)=>n+setVolume(e,s),0); },0); }
function weeklyStats(baseMonday){ const days=Array.from({length:7},(_,i)=>localISO(addDays(baseMonday,i))); let done=0,totalSets=0,doneSet=0,pains=[],vol=0; days.forEach(iso=>{ const s=getSession(iso); const exs=allExercisesForSession(iso); if(s.completed) done++; totalSets+=plannedSets(exs); doneSet+=doneSets(iso,exs); if(toNum(s.backPain)) pains.push(toNum(s.backPain)); vol+=sessionVolumeKg(iso); }); return {doneSessions:done,totalSets,doneSets:doneSet,avgPain:pains.length?formatDecimal(pains.reduce((a,b)=>a+b,0)/pains.length,1):'', volumeKg:vol}; }

function renderRoutine(){ const root=$('#routine'); const iso=isoToday(); state.routine[iso]=state.routine[iso]||{}; const done=DAILY_ROUTINE.filter((_,i)=>state.routine[iso][i]).length; root.innerHTML=`<section class="card"><div class="between"><div><p class="eyebrow">Routine quotidienne</p><h2>Haut du dos / omoplates</h2></div><span class="badge">${done}/${DAILY_ROUTINE.length}</span></div><p class="muted">Routine courte pour renforcer la zone douloureuse à vélo.</p><div class="progressbar"><span style="width:${Math.round(done/DAILY_ROUTINE.length*100)}%"></span></div></section><section class="card">${DAILY_ROUTINE.map((it,i)=>`<div class="routine-item" data-i="${i}"><input type="checkbox" ${state.routine[iso][i]?'checked':''}><div><strong>${esc(it.name)}</strong><div class="muted">${esc(it.target)} · ${esc(it.sets)} x ${esc(it.reps)}</div></div><span class="badge">${it.restSec||0}s</span></div>`).join('')}<div class="footer-actions"><button class="ghost" id="resetRoutine">Réinitialiser aujourd'hui</button></div></section>`; $$('.routine-item input').forEach(inp=>inp.onchange=e=>{ const i=Number(e.target.closest('.routine-item').dataset.i); state.routine[iso][i]=e.target.checked; saveState(); if(e.target.checked && DAILY_ROUTINE[i].restSec) startTimer(DAILY_ROUTINE[i].restSec,`Routine · ${DAILY_ROUTINE[i].name}`); renderRoutine(); }); $('#resetRoutine').onclick=()=>{ state.routine[iso]={}; saveState(); renderRoutine(); }; }
function renderCharts(){ const root=$('#charts'); root.innerHTML=`<section class="card"><div class="between"><div><p class="eyebrow">Graphiques</p><h2>Progression visuelle</h2></div><span class="badge">local</span></div><p class="muted">Style simple inspiré Hevy/Strava : volume, cardio, douleur et poids.</p></section><section class="grid grid-2">${chartCard('chartVolume','Volume muscu hebdomadaire')}${chartCard('chartCardio','Distance course/vélo')}${chartCard('chartPain','Douleur haut du dos')}${chartCard('chartWeight','Évolution du poids')}</section><section class="card"><h3>Ajouter un test</h3><div class="grid grid-3"><label><span>Type</span><select id="testType">${TESTS.map(t=>`<option value="${t.key}">${t.label}</option>`).join('')}</select></label><label><span>Valeur</span><input id="testValue" placeholder="ex : 42:30 ou 35.2"></label><label><span>Date</span><input id="testDate" type="date" value="${isoToday()}"></label></div><div class="footer-actions"><button class="primary" id="addTest">Ajouter le test</button></div></section>`; setTimeout(drawCharts,0); $('#addTest').onclick=()=>{ state.tests.push({date:$('#testDate').value,type:$('#testType').value,value:$('#testValue').value}); saveState(); renderCharts(); }; }
function chartCard(id,title){ return `<div class="card"><h3>${esc(title)}</h3><canvas class="chart" id="${id}"></canvas></div>`; }
function lastWeeks(n=8){ const cur=mondayOf(parseISO(selectedDate)); return Array.from({length:n},(_,i)=>mondayOf(addDays(cur,-7*(n-1-i)))); }
function drawCharts(){ const weeks=lastWeeks(8); const labels=weeks.map(w=>`S${weekIndexFor(localISO(w))}`); const volumes=weeks.map(w=>Math.round(weeklyStats(w).volumeKg)); const run=weeks.map(w=>sumWeekMetric(w,'runDistanceKm')); const bike=weeks.map(w=>sumWeekMetric(w,'bikeDistanceKm')); const pain=weeks.map(w=>toNum(weeklyStats(w).avgPain)); drawBar('chartVolume',labels,volumes,'kg'); drawGrouped('chartCardio',labels,run,bike,'course km','vélo km'); drawLine('chartPain',labels,pain,'/10'); drawLine('chartWeight',(state.bodyWeights||[]).slice(-8).map(r=>r.date.slice(5)),(state.bodyWeights||[]).slice(-8).map(r=>toNum(r.kg)),'kg'); }
function sumWeekMetric(w,key){ return Array.from({length:7},(_,i)=>localISO(addDays(w,i))).reduce((n,iso)=>n+toNum(getSession(iso).metrics?.[key]),0); }
function setupCanvas(id){ const c=document.getElementById(id); if(!c) return null; const r=c.getBoundingClientRect(); c.width=Math.max(320,r.width*devicePixelRatio); c.height=Math.max(220,r.height*devicePixelRatio); const ctx=c.getContext('2d'); ctx.scale(devicePixelRatio,devicePixelRatio); return {c,ctx,w:r.width||360,h:r.height||220}; }
function axes(ctx,w,h){ ctx.strokeStyle='rgba(148,163,184,.25)'; ctx.beginPath(); ctx.moveTo(35,15); ctx.lineTo(35,h-30); ctx.lineTo(w-10,h-30); ctx.stroke(); }
function drawBar(id,labels,vals,suf){ const s=setupCanvas(id); if(!s) return; const {ctx,w,h}=s; ctx.clearRect(0,0,w,h); axes(ctx,w,h); const max=Math.max(...vals,1); const gap=8,bw=(w-55)/vals.length-gap; vals.forEach((v,i)=>{ const bh=(h-55)*v/max, x=42+i*(bw+gap), y=h-30-bh; ctx.fillStyle='#38bdf8'; round(ctx,x,y,bw,bh,7); ctx.fill(); ctx.fillStyle='#9fb7d8'; ctx.fillText(labels[i],x,h-10); if(v){ ctx.fillStyle='#f8fafc'; ctx.fillText(String(v),x,y-5); } }); ctx.fillStyle='#9fb7d8'; ctx.fillText(suf,38,12); }
function drawGrouped(id,labels,a,b,al,bl){ const s=setupCanvas(id); if(!s) return; const {ctx,w,h}=s; ctx.clearRect(0,0,w,h); axes(ctx,w,h); const max=Math.max(...a,...b,1); const gap=8,gw=(w-55)/labels.length-gap,bw=gw/2.4; labels.forEach((lab,i)=>{ [a[i],b[i]].forEach((v,j)=>{ const bh=(h-55)*v/max,x=42+i*(gw+gap)+j*(bw+3); ctx.fillStyle=j?'#22c55e':'#38bdf8'; round(ctx,x,h-30-bh,bw,bh,6); ctx.fill(); }); ctx.fillStyle='#9fb7d8'; ctx.fillText(lab,42+i*(gw+gap),h-10); }); ctx.fillStyle='#38bdf8'; ctx.fillText(al,38,12); ctx.fillStyle='#22c55e'; ctx.fillText(bl,120,12); }
function drawLine(id,labels,vals,suf){ const s=setupCanvas(id); if(!s) return; const {ctx,w,h}=s; ctx.clearRect(0,0,w,h); axes(ctx,w,h); if(vals.length<1) return; const max=Math.max(...vals,1), min=Math.min(...vals.filter(v=>v>0),0); const span=Math.max(1,max-min); const pts=vals.map((v,i)=>[40+(i*((w-55)/Math.max(1,vals.length-1))), h-30-(h-55)*((v-min)/span)]); ctx.strokeStyle='#38bdf8'; ctx.lineWidth=3; ctx.beginPath(); pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y)); ctx.stroke(); pts.forEach(([x,y],i)=>{ ctx.fillStyle='#22c55e'; ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#9fb7d8'; ctx.fillText(labels[i]||'',x-8,h-10); }); ctx.fillStyle='#9fb7d8'; ctx.fillText(suf,38,12); }
function round(ctx,x,y,w,h,r){ const rr=Math.min(r,w/2,Math.abs(h)/2); ctx.beginPath(); ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr); ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath(); }

function renderHistory(){ const root=$('#history'); const rows=Object.entries(state.sessions).sort(([a],[b])=>b.localeCompare(a)).slice(0,80); root.innerHTML=`<section class="card"><div class="between"><div><p class="eyebrow">Historique</p><h2>Séances enregistrées</h2></div><span class="badge">${Object.keys(state.sessions).length} jours</span></div><div class="footer-actions"><button class="primary" id="exportJson">Exporter JSON</button><button class="ghost" id="exportCsv">Exporter CSV</button><label class="ghost">Importer JSON<input id="importJson" type="file" accept="application/json" class="hidden"></label></div></section><section class="card"><div style="overflow:auto"><table class="table"><thead><tr><th>Date</th><th>Séance</th><th>Statut</th><th>Course</th><th>Vélo</th><th>Hors cardio</th><th>Volume</th><th>RPE</th><th>Douleur</th><th>Notes</th></tr></thead><tbody>${rows.map(([iso,s])=>{ const p=planForDate(iso); return `<tr><td>${fmtDate(iso)}</td><td>${p.type} · ${esc(p.plan.title)}</td><td>${s.completed?'Terminée':'En cours'}</td><td>${esc(s.metrics?.runDistanceKm||'')} km · ${esc(s.metrics?.runAvgSpeed||'')} km/h</td><td>${esc(s.metrics?.bikeDistanceKm||'')} km · ${esc(s.metrics?.bikeAvgSpeed||'')} km/h</td><td>${hms(s.metrics?.strengthDurationSec||s.stopwatch?.elapsedSec||0)}</td><td>${formatDecimal(s.metrics?.volumeKg||sessionVolumeKg(iso),0)} kg</td><td>${esc(s.rpe||'')}</td><td>${esc(s.backPain||'')}</td><td>${esc((s.notes||'').slice(0,80))}</td></tr>`; }).join('')}</tbody></table></div></section>`; $('#exportJson').onclick=exportJSON; $('#exportCsv').onclick=exportCSV; $('#importJson').onchange=importJSON; }
function renderSettings(){
  const root=$('#settings');
  root.innerHTML=`${authCardHtml()}<section class="card"><p class="eyebrow">Réglages</p><h2>Programme, poids et alertes</h2><div class="grid grid-3"><label><span>Date de début du programme</span><input id="startDate" type="date" value="${state.startDate}"></label><label><span>Son fin de repos</span><select id="sound"><option value="true" ${state.settings.sound!==false?'selected':''}>Oui</option><option value="false" ${state.settings.sound===false?'selected':''}>Non</option></select></label><label><span>Vibration fin de repos</span><select id="vibration"><option value="true" ${state.settings.vibration?'selected':''}>Oui</option><option value="false" ${!state.settings.vibration?'selected':''}>Non</option></select></label></div></section><section class="card"><h3>Suivi du poids corporel</h3><p class="muted">Le dernier poids connu à la date de la séance est utilisé pour calculer le volume des exercices au poids du corps : tractions, dips, pompes, gainage, etc.</p><div class="grid grid-3"><label><span>Date</span><input id="weightDate" type="date" value="${isoToday()}"></label><label><span>Poids, kg</span><input id="weightKg" type="number" step="0.1" value="${formatDecimal(currentBodyWeight(),1).replace(',','.')}"></label><div style="align-self:end"><button class="primary" id="addWeight">Ajouter poids</button></div></div><div style="overflow:auto;margin-top:14px"><table class="table"><thead><tr><th>Date</th><th>Poids</th></tr></thead><tbody>${[...(state.bodyWeights||[])].sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<tr><td>${esc(r.date)}</td><td>${formatDecimal(r.kg,1)} kg</td></tr>`).join('')}</tbody></table></div><div class="footer-actions"><button class="danger" id="resetAll">Réinitialiser toutes les données locales</button></div></section>`;
  bindAuthControls();
  $('#startDate').onchange=e=>{ state.startDate=e.target.value; saveState(); render(); };
  $('#sound').onchange=e=>{ state.settings.sound=e.target.value==='true'; saveState(); };
  $('#vibration').onchange=e=>{ state.settings.vibration=e.target.value==='true'; saveState(); };
  $('#addWeight').onclick=()=>{ const date=$('#weightDate').value, kg=toNum($('#weightKg').value); if(date&&kg){ state.bodyWeights.push({date,kg}); state.settings.bodyWeightKg=kg; saveState(); render(); } };
  $('#resetAll').onclick=()=>{ if(confirm('Supprimer toutes les données locales ?')){ localStorage.removeItem(LS_KEY); location.reload(); } };
}

function supabaseReady(){ return Boolean(window.supabaseClient && window.supabaseClient.auth); }
function cloudStatusText(){
  if(!supabaseReady()) return 'Supabase non configuré';
  if(authUser) return `Connecté : ${authUser.email || authUser.id}`;
  return state.cloud?.status || 'Non connecté';
}
function authCardHtml(){
  const connected = Boolean(authUser);
  const lastSync = state.cloud?.lastSync ? new Date(state.cloud.lastSync).toLocaleString('fr-FR') : '-';
  const lastRestore = state.cloud?.lastRestore ? new Date(state.cloud.lastRestore).toLocaleString('fr-FR') : '-';
  return `<section class="card"><div class="between"><div><p class="eyebrow">Compte & Sync</p><h2>Supabase</h2><p class="muted">Sauvegarde cloud de tes séances, séries, poids et routines. Tes données restent aussi disponibles en local.</p></div><span class="badge ${connected?'done':'warn'}" id="cloudBadge">${esc(cloudStatusText())}</span></div><div class="grid grid-3"><label><span>Email</span><input id="authEmail" type="email" autocomplete="email" placeholder="ton@email.com"></label><label><span>Mot de passe</span><input id="authPassword" type="password" autocomplete="current-password" placeholder="••••••••"></label><label><span>Synchronisation auto</span><select id="cloudAutoSync"><option value="true" ${state.settings.cloudAutoSync!==false?'selected':''}>Oui</option><option value="false" ${state.settings.cloudAutoSync===false?'selected':''}>Non</option></select></label></div><p class="muted" id="authStatus">${esc(cloudStatusText())}</p><div class="footer-actions"><button class="primary" id="signInBtn">Se connecter</button><button class="ghost" id="signUpBtn">Créer un compte</button><button class="ghost" id="signOutBtn">Se déconnecter</button><button class="primary" id="syncCloudBtn">Synchroniser vers Supabase</button><button class="ghost" id="restoreCloudBtn">Restaurer depuis Supabase</button></div><div class="grid grid-3"><div class="stat"><small>Séances locales</small><strong>${Object.keys(state.sessions||{}).length}</strong></div><div class="stat"><small>Dernière sync</small><strong style="font-size:1rem">${esc(lastSync)}</strong></div><div class="stat"><small>Dernière restauration</small><strong style="font-size:1rem">${esc(lastRestore)}</strong></div></div></section>`;
}
function bindAuthControls(){
  const email=$('#authEmail'), pass=$('#authPassword');
  const setStatus=t=>{ const el=$('#authStatus'); if(el) el.textContent=t; const badge=$('#cloudBadge'); if(badge) badge.textContent=t; };
  const auto=$('#cloudAutoSync'); if(auto) auto.onchange=e=>{ state.settings.cloudAutoSync=e.target.value==='true'; saveState({sync:false}); };
  const signIn=$('#signInBtn'); if(signIn) signIn.onclick=async()=>{ await signInCloud(email?.value||'', pass?.value||'', setStatus); };
  const signUp=$('#signUpBtn'); if(signUp) signUp.onclick=async()=>{ await signUpCloud(email?.value||'', pass?.value||'', setStatus); };
  const signOut=$('#signOutBtn'); if(signOut) signOut.onclick=async()=>{ await signOutCloud(setStatus); };
  const sync=$('#syncCloudBtn'); if(sync) sync.onclick=async()=>{ await syncLocalToCloud(setStatus); };
  const restore=$('#restoreCloudBtn'); if(restore) restore.onclick=async()=>{ if(confirm('Restaurer les données cloud sur ce téléphone ? Tes données locales actuelles seront remplacées par la dernière sauvegarde cloud.')) await restoreFromCloud(setStatus); };
}
async function getCloudUser(){
  if(!supabaseReady()) return null;
  const { data, error } = await supabaseClient.auth.getUser();
  authUser = error ? null : data.user;
  return authUser;
}
async function initCloud(){
  if(!supabaseReady()) { state.cloud.status='Supabase non configuré'; saveState({sync:false}); return; }
  const { data } = await supabaseClient.auth.getSession();
  authUser = data?.session?.user || null;
  supabaseClient.auth.onAuthStateChange((_event, session)=>{ authUser=session?.user || null; state.cloud.status=authUser?`Connecté : ${authUser.email||authUser.id}`:'Non connecté'; saveState({sync:false}); if(currentView==='settings') renderSettings(); });
  state.cloud.status=authUser?`Connecté : ${authUser.email||authUser.id}`:'Non connecté'; saveState({sync:false});
  if(currentView==='settings') renderSettings();
}
async function signUpCloud(email,password,setStatus=()=>{}){
  if(!supabaseReady()) return setStatus('Supabase non configuré. Vérifie supabase-config.js.');
  if(!email || !password) return setStatus('Email et mot de passe requis.');
  setStatus('Création du compte...');
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if(error) return setStatus(error.message);
  authUser = data?.user || authUser;
  setStatus('Compte créé. Vérifie tes emails si la confirmation est activée.');
}
async function signInCloud(email,password,setStatus=()=>{}){
  if(!supabaseReady()) return setStatus('Supabase non configuré. Vérifie supabase-config.js.');
  if(!email || !password) return setStatus('Email et mot de passe requis.');
  setStatus('Connexion...');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error) return setStatus(error.message);
  authUser = data.user;
  state.cloud.status=`Connecté : ${authUser.email||authUser.id}`;
  saveState({sync:false});
  setStatus('Connecté. Tu peux synchroniser ou restaurer.');
  renderSettings();
}
async function signOutCloud(setStatus=()=>{}){
  if(!supabaseReady()) return setStatus('Supabase non configuré.');
  await supabaseClient.auth.signOut();
  authUser=null; state.cloud.status='Non connecté'; saveState({sync:false}); setStatus('Déconnecté.'); renderSettings();
}
function scheduleAutoSync(){
  if(!state?.settings?.cloudAutoSync || cloudBusy || !supabaseReady()) return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>syncLocalToCloud(()=>{}, true), 2500);
}
function meaningfulSession(s){
  if(!s) return false;
  if(s.completed || s.rpe || s.backPain || s.notes) return true;
  const m=s.metrics||{};
  if(Object.values(m).some(v=>v!=='' && v!==null && v!==undefined && Number(v)!==0)) return true;
  if((s.extraExercises||[]).length) return true;
  if(toNum(s.stopwatch?.elapsedSec)) return true;
  return Object.values(s.exercises||{}).some(log=>(log.sets||[]).some(set=>set.done || set.actual || set.load || set.note));
}
function cloudSessionPayload(iso,s,user){
  const p=planForDate(iso), m=s.metrics||{};
  return {
    user_id:user.id, local_id:iso, session_date:iso, week_number:p.week, week_type:p.type,
    day_label:p.plan.name, title:s.freeMode?'Séance libre':p.plan.title, session_type:p.plan.title,
    completed:Boolean(s.completed), non_cardio_duration_seconds:toNum(m.strengthDurationSec || s.stopwatch?.elapsedSec),
    rpe:s.rpe?Number(s.rpe):null, back_pain:s.backPain?Number(s.backPain):null, notes:s.notes||null,
    run_distance_km:m.runDistanceKm?toNum(m.runDistanceKm):null, run_duration_seconds:m.runDurationSec?toNum(m.runDurationSec):null,
    run_avg_speed_kmh:m.runAvgSpeed?toNum(m.runAvgSpeed):null, run_pace_seconds_per_km:m.runDurationSec&&m.runDistanceKm?Math.round(toNum(m.runDurationSec)/toNum(m.runDistanceKm)):null,
    bike_distance_km:m.bikeDistanceKm?toNum(m.bikeDistanceKm):null, bike_duration_seconds:m.bikeDurationSec?toNum(m.bikeDurationSec):null,
    bike_avg_speed_kmh:m.bikeAvgSpeed?toNum(m.bikeAvgSpeed):null,
    total_volume_kg:toNum(m.volumeKg || sessionVolumeKg(iso)), raw_data:s, updated_at:new Date().toISOString()
  };
}
function parseActualReps(actual){
  const m=String(actual||'').match(/\d+/);
  return m ? Number(m[0]) : null;
}
function exerciseRowsForCloud(iso,sessionId,user){
  const rows=[];
  allExercisesForSession(iso).filter(e=>e.kind!=='run'&&e.kind!=='bike').forEach(e=>{
    const id=e.id || makeId(e.name + '-' + e.kind); const log=getSession(iso).exercises[id]; if(!log) return;
    (log.sets||[]).forEach((set,i)=>{
      const reps=parseActualReps(set.actual || e.reps);
      const bodyweight=e.bodyweight?currentBodyWeight(iso):null;
      const load=toNum(set.load || e.defaultLoad);
      const volume=setVolume(e,set);
      rows.push({ user_id:user.id, session_id:sessionId, exercise_name:e.name, muscle_group:(e.muscles||[]).join(', '), set_index:i+1, planned:`${e.sets} x ${e.reps}`, completed:Boolean(set.done), reps, duration_seconds:null, distance_km:null, load_kg:load||null, bodyweight_kg:bodyweight||null, volume_kg:volume||null });
    });
  });
  return rows;
}
async function saveOneSessionToCloud(iso,user){
  const s=getSession(iso); if(!meaningfulSession(s)) return;
  const { data, error } = await supabaseClient.from('sessions').upsert(cloudSessionPayload(iso,s,user), { onConflict:'user_id,local_id' }).select('id').single();
  if(error) throw error;
  await supabaseClient.from('exercise_sets').delete().eq('user_id',user.id).eq('session_id',data.id);
  const rows=exerciseRowsForCloud(iso,data.id,user);
  if(rows.length){ const { error:setError } = await supabaseClient.from('exercise_sets').insert(rows); if(setError) throw setError; }
}
async function syncLocalToCloud(setStatus=()=>{}, silent=false){
  if(!supabaseReady()) { if(!silent) setStatus('Supabase non configuré.'); return; }
  const user = authUser || await getCloudUser();
  if(!user) { if(!silent) setStatus('Connecte-toi avant de synchroniser.'); return; }
  cloudBusy=true; if(!silent) setStatus('Synchronisation en cours...');
  try{
    for(const iso of Object.keys(state.sessions||{})) await saveOneSessionToCloud(iso,user);
    await syncWeightsToCloud(user);
    await syncRoutinesToCloud(user);
    state.cloud.lastSync=new Date().toISOString(); state.cloud.status='Synchronisé'; saveState({sync:false});
    if(!silent) setStatus('Synchronisation terminée.');
    if(currentView==='settings') renderSettings();
  }catch(e){ console.error(e); state.cloud.status='Erreur sync'; saveState({sync:false}); if(!silent) setStatus(`Erreur sync : ${e.message||e}`); }
  finally{ cloudBusy=false; }
}
async function syncWeightsToCloud(user){
  const rows=(state.bodyWeights||[]).filter(r=>r.date&&toNum(r.kg)).map(r=>({user_id:user.id, measured_at:r.date, weight_kg:toNum(r.kg)}));
  if(rows.length){ const {error}=await supabaseClient.from('body_weights').upsert(rows,{onConflict:'user_id,measured_at'}); if(error) throw error; }
}
async function syncRoutinesToCloud(user){
  const entries=Object.entries(state.routine||{}).filter(([,v])=>Object.values(v||{}).some(Boolean));
  await supabaseClient.from('daily_routines').delete().eq('user_id',user.id);
  if(!entries.length) return;
  const rows=entries.map(([date,raw])=>({user_id:user.id,routine_date:date,completed:true,raw_data:raw}));
  const {error}=await supabaseClient.from('daily_routines').insert(rows); if(error) throw error;
}
async function restoreFromCloud(setStatus=()=>{}){
  if(!supabaseReady()) return setStatus('Supabase non configuré.');
  const user = authUser || await getCloudUser();
  if(!user) return setStatus('Connecte-toi avant de restaurer.');
  cloudBusy=true; setStatus('Restauration en cours...');
  try{
    const { data:sessions, error:sErr } = await supabaseClient.from('sessions').select('*').eq('user_id',user.id).order('session_date',{ascending:true});
    if(sErr) throw sErr;
    const { data:weights, error:wErr } = await supabaseClient.from('body_weights').select('*').eq('user_id',user.id).order('measured_at',{ascending:true});
    if(wErr) throw wErr;
    const { data:routines, error:rErr } = await supabaseClient.from('daily_routines').select('*').eq('user_id',user.id).order('routine_date',{ascending:true});
    if(rErr) throw rErr;
    const next={...defaultState(),...state,sessions:{},routine:{}};
    (sessions||[]).forEach(row=>{ next.sessions[row.session_date]=row.raw_data || {}; });
    next.bodyWeights=(weights||[]).map(r=>({date:r.measured_at,kg:Number(r.weight_kg)}));
    if(!next.bodyWeights.length) next.bodyWeights=[{date:isoToday(),kg:78}];
    (routines||[]).forEach(r=>{ next.routine[r.routine_date]=r.raw_data || {}; });
    next.cloud={...(state.cloud||{}), lastRestore:new Date().toISOString(), status:'Restauré depuis Supabase'};
    state=next; saveState({sync:false}); setStatus('Restauration terminée.'); render();
  }catch(e){ console.error(e); setStatus(`Erreur restauration : ${e.message||e}`); }
  finally{ cloudBusy=false; }
}

function exportJSON(){ download(`sport-tracker-${isoToday()}.json`,JSON.stringify(state,null,2),'application/json'); }
function exportCSV(){ const head=['date','week','type','session','completed','strengthDurationSec','volumeKg','rpe','backPain','runKm','runDurationSec','runAvgSpeed','runPace','bikeKm','bikeDurationSec','bikeAvgSpeed','bodyWeightKg','notes']; const lines=[head]; Object.entries(state.sessions).sort().forEach(([iso,s])=>{ const p=planForDate(iso), m=s.metrics||{}; lines.push([iso,p.week,p.type,p.plan.title,s.completed,m.strengthDurationSec||'',m.volumeKg||sessionVolumeKg(iso),s.rpe||'',s.backPain||'',m.runDistanceKm||'',m.runDurationSec||'',m.runAvgSpeed||'',m.runPace||'',m.bikeDistanceKm||'',m.bikeDurationSec||'',m.bikeAvgSpeed||'',currentBodyWeight(iso),String(s.notes||'').replace(/\n/g,' ')]); }); download(`sport-tracker-${isoToday()}.csv`,lines.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n'),'text/csv'); }
function download(name,content,type){ const blob=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function importJSON(e){ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ state={...defaultState(),...JSON.parse(reader.result)}; saveState(); render(); alert('Sauvegarde importée.'); } catch{ alert('Fichier invalide.'); } }; reader.readAsText(file); }

function startTimer(seconds,label='Repos'){ clearInterval(timer.interval); timer={remaining:Number(seconds),interval:null,paused:false,label}; $('#timerLabel').textContent=label; $('#timerTime').textContent=mmss(seconds); $('#timer').classList.remove('hidden'); timer.interval=setInterval(()=>{ if(timer.paused) return; timer.remaining--; $('#timerTime').textContent=mmss(timer.remaining); if(timer.remaining<=0) finishTimer(); },1000); }
function finishTimer(){ clearInterval(timer.interval); $('#timer').classList.add('hidden'); beep(); if(state.settings.vibration && navigator.vibrate) navigator.vibrate([250,80,250]); }
function beep(){ if(state.settings.sound===false) return; try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; const ctx=new AC(), now=ctx.currentTime, g=ctx.createGain(); g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(.2,now+.02); g.gain.exponentialRampToValueAtTime(.0001,now+.7); g.connect(ctx.destination); [0,.22,.44].forEach(off=>{ const o=ctx.createOscillator(); o.frequency.value=880; o.connect(g); o.start(now+off); o.stop(now+off+.15); }); setTimeout(()=>ctx.close(),900); }catch(e){} }
$('#pauseTimer').onclick=()=>{ timer.paused=!timer.paused; $('#pauseTimer').textContent=timer.paused?'Reprendre':'Pause'; };
$('#skipTimer').onclick=finishTimer;
$$('.tabs button').forEach(btn=>btn.onclick=()=>setView(btn.dataset.view));
window.addEventListener('resize',()=>{ if(currentView==='charts') drawCharts(); });
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredInstallPrompt=e; $('#installBtn').classList.remove('hidden'); });
$('#installBtn').onclick=async()=>{ if(deferredInstallPrompt){ deferredInstallPrompt.prompt(); deferredInstallPrompt=null; $('#installBtn').classList.add('hidden'); } };
if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
render();
initCloud();
