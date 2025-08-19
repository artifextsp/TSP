// =======================
//  MLC MODULE v6 (Modal de resultados + review + export a dashboard)
// =======================

const SUPABASE_CONFIG = {
  url: 'https://kryqjsncqsopjuwymhqd.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeXFqc25jcXNvcGp1d3ltaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjM3MDEsImV4cCI6MjA2ODg5OTcwMX0.w5HiaFiqlFJ_3QbcprUrufsOXTDWFg1zUMl2J7kWD6Y',
};
const sb = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Storage
const STORAGE_BUCKET = 'tsp-lecturas';
const STORAGE_FALLBACK_PATH = 'grado-3/ciclo-1/g3c1.pdf';

// Estado
const state = {
  user: null,
  lecture: null,
  step: 1,
  seed: null,
  reseedOnNextVocabTest: false,
  vocabAnswers: {},
  compAnswers: {},
  compAnswersJson: null,
  readingStartedAt: null,
  readingAccumMs: 0,
  _timer: null,
  vocabPassed: false,
  fromStep: null, // 'reading'|'comprension'|null
};

// Utils
const byId = (id) => document.getElementById(id);
const fmtTime = (ms) => {
  const s = Math.floor((ms || 0) / 1000);
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
};
function rand(seed){ let x=seed|0; return ()=>((x^=x<<13),(x^=x>>>17),(x^=x<<5),(x>>>0)/4294967296); }
function seededShuffle(a,seed){ const r=rand(seed); a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function normKey(v){ if(v==null)return null; const s=String(v).trim().toUpperCase(); if(['A','B','C','D'].includes(s))return s; if(['1','2','3','4'].includes(s))return ['A','B','C','D'][+s-1]; return s; }
async function toggleFullscreen(el){ try{ if(!document.fullscreenElement) await (el||document.documentElement).requestFullscreen(); else await document.exitFullscreen(); }catch{} }
async function ensureExitFullscreen(){ try{ if(document.fullscreenElement) await document.exitFullscreen(); }catch{} }

// Wizard
function showOnly(sectionId){
  const ids=['step1','step2','step3','step4']; // sin "finalResults"
  ids.forEach(id=>{
    const el=byId(id); if(!el) return;
    const on=id===sectionId;
    el.classList.toggle('active',on);
    if(on){ el.removeAttribute('hidden'); el.inert=false; }
    else{ el.setAttribute('hidden',''); el.inert=true; }
  });
  window.scrollTo({top:0,behavior:'smooth'});
}
function setStepsUI(){
  const perc=((state.step-1)/3)*100;
  byId('mlcBar').style.width=`${Math.max(0,Math.min(100,perc))}%`;
  for(let i=1;i<=4;i++){
    byId(`st${i}`).classList.remove('active','done');
    if(i<state.step) byId(`st${i}`).classList.add('done');
    if(i===state.step) byId(`st${i}`).classList.add('active');
  }
}
function goTo(n){
  if(n===2 && state.vocabPassed) n=3;
  state.step=n; setStepsUI();
  if(n===1) showOnly('step1');
  if(n===2){ resetVocabTest({reshuffle:state.reseedOnNextVocabTest}); state.reseedOnNextVocabTest=false; showOnly('step2'); }
  if(n===3) showOnly('step3');
  if(n===4) showOnly('step4');
}

// Usuario
function getUserFromSession(){ try{const raw=localStorage.getItem('tsp_user'); return raw?JSON.parse(raw):null;}catch{ return null; } }
function setStudentHeader(){
  const n = state.user ? `${state.user.nombres||''} ${state.user.apellidos||''}`.trim() : 'Estudiante';
  byId('studentName').textContent = n || 'Estudiante';
}

// Datos
async function fetchActiveLectureForUser(){
  const grado = state.user?.grado || state.user?.grupo_grado || 3;
  const {data,error}=await sb.from('lecturas').select('*')
    .lte('grado_minimo',grado).gte('grado_maximo',grado).eq('activo',true).limit(1);
  if(error) throw error;
  if(!data||!data[0]) throw new Error('No hay lecturas activas para tu grado');
  return data[0];
}
async function getPdfUrl(lecture){
  const path=lecture?.pdf_path||STORAGE_FALLBACK_PATH;
  try{
    const {data,error}=await sb.storage.from(STORAGE_BUCKET).createSignedUrl(path,3600);
    if(error) throw error;
    return data.signedUrl;
  }catch{
    const {data}=sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
}

// Paso 1
function renderVocabList(){
  const cont=byId('vocabList'); cont.innerHTML='';
  (state.lecture?.vocabulario?.items||[]).forEach(it=>{
    const d=document.createElement('div'); d.className='vocab-item';
    d.innerHTML=`<strong>${it.indice}. ${it.termino}</strong><br/><span>${it.definicion}</span>`;
    cont.appendChild(d);
  });
}

// Paso 2 (test vocab)
function renderVocabTest(currentSeed){
  const wrap=byId('vocabTest'); wrap.innerHTML=''; state.vocabAnswers={};
  const items=state.lecture?.vocabulario?.items||[];
  items.forEach((q,i)=>{
    const letters=['A','B','C','D']; const shuffled=seededShuffle(letters,(currentSeed??state.seed)+i);
    const correctKey=normKey(q.respuesta_correcta);
    const div=document.createElement('div'); div.className='q';
    div.innerHTML=`<div><strong>${i+1}. ${q.pregunta || ('Significado de '+q.termino)}</strong></div>`;
    const optsDiv=document.createElement('div'); optsDiv.className='opts';
    shuffled.forEach((L,idx)=>{
      const id=`v_${i}_${idx}`;
      const opt=document.createElement('div'); opt.className='opt'; opt.dataset.key=L; opt.setAttribute('role','radio'); opt.setAttribute('tabindex','0');
      opt.innerHTML=`<input id="${id}" type="radio" name="vocab_${i}" /><label for="${id}"><strong>${L}.</strong> ${q.opciones[L]}</label>`;
      const mark=()=>{ [...optsDiv.children].forEach(c=>c.classList.remove('selected')); opt.classList.add('selected'); const input=opt.querySelector('input'); if(input) input.checked=true; state.vocabAnswers[i]=L; checkVocabFilled(); };
      opt.addEventListener('click',mark); opt.addEventListener('keydown',ev=>{ if(ev.key==='Enter'||ev.key===' '){ev.preventDefault(); mark();} });
      optsDiv.appendChild(opt);
    });
    div.appendChild(optsDiv); div.dataset.correct=correctKey; wrap.appendChild(div);
  });
}
function checkVocabFilled(){ const total=(state.lecture?.vocabulario?.items||[]).length; byId('btnSubmitVocab').disabled = Object.keys(state.vocabAnswers).length!==total; }
function gradeVocabTest(){
  let ok=0; const qs=[...document.querySelectorAll('#vocabTest .q')];
  qs.forEach((div,i)=>{
    const correct=normKey(div.dataset.correct); const marked=normKey(state.vocabAnswers[i]);
    const opts=[...div.querySelectorAll('.opt')];
    opts.forEach(o=>{ if(normKey(o.dataset.key)===correct) o.classList.add('correct'); if(marked && normKey(o.dataset.key)===marked && marked!==correct) o.classList.add('incorrect'); o.style.pointerEvents='none'; });
    if(marked===correct) ok++;
  }); return ok;
}
function resetVocabTest({reshuffle}){ byId('btnSubmitVocab').disabled=true; byId('vocabScore').style.display='none'; byId('vocabScore').textContent=''; byId('gateToReading').style.display='none'; byId('retryVocab').style.display='none'; if(reshuffle) state.seed=(Date.now() ^ Math.floor(Math.random()*0xffffffff))>>>0; renderVocabTest(state.seed); }

// Paso 3
function startTimer(){ if(state._timer) return; state.readingStartedAt=Date.now(); state._timer=setInterval(()=>{ const elapsed=state.readingAccumMs+(Date.now()-state.readingStartedAt); byId('timer').textContent=fmtTime(elapsed); },200); }
function pauseTimer(){ if(!state._timer) return; state.readingAccumMs+=Date.now()-state.readingStartedAt; clearInterval(state._timer); state._timer=null; }

// Paso 4 (comprensión)
function renderComprension(){
  const cont=byId('comprension'); cont.innerHTML=''; state.compAnswers={};
  const preguntas=state.lecture?.preguntas_tc?.preguntas||[];
  preguntas.forEach((p,idx)=>{
    const q=document.createElement('div'); q.className='q';
    q.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
      <div><strong>${p.indice||idx+1}. ${p.pregunta}</strong></div>
      ${p.orientacion?`<div class="orientation">${p.orientacion}</div>`:''}
    </div>`;
    const optsDiv=document.createElement('div'); optsDiv.className='opts';
    const letters=['A','B','C','D']; const shuffled=seededShuffle(letters,state.seed+100+idx); const correctKey=normKey(p.respuesta_correcta);
    shuffled.forEach((L,j)=>{ const id=`c_${idx}_${j}`; const opt=document.createElement('div'); opt.className='opt'; opt.dataset.key=L; opt.setAttribute('role','radio'); opt.setAttribute('tabindex','0'); opt.innerHTML=`<input id="${id}" type="radio" name="comp_${idx}" /><label for="${id}"><strong>${L}.</strong> ${p.opciones[L]}</label>`; const mark=()=>{ [...optsDiv.children].forEach(c=>c.classList.remove('selected')); opt.classList.add('selected'); const input=opt.querySelector('input'); if(input) input.checked=true; state.compAnswers[idx]=L; checkComprFilled(); }; opt.addEventListener('click',mark); opt.addEventListener('keydown',ev=>{ if(ev.key==='Enter'||ev.key===' '){ev.preventDefault(); mark();} }); optsDiv.appendChild(opt); });
    const fb=document.createElement('div'); fb.className='feedback'; fb.id=`fb_${idx}`; q.appendChild(optsDiv); q.appendChild(fb); q.dataset.correct=correctKey; q.dataset.fbText=p.retroalimentacion||''; cont.appendChild(q);
  });
}
function checkComprFilled(){ const total=(state.lecture?.preguntas_tc?.preguntas||[]).length; byId('btnSubmitComprension').disabled = Object.keys(state.compAnswers).length!==total; }
function gradeComprension(){
  const qs=[...document.querySelectorAll('#comprension .q')]; let ok=0; const detail=[];
  qs.forEach((div,i)=>{ const correct=normKey(div.dataset.correct); const marked=normKey(state.compAnswers[i]); const opts=[...div.querySelectorAll('.opt')];
    opts.forEach(o=>{ if(normKey(o.dataset.key)===correct) o.classList.add('correct'); if(marked && normKey(o.dataset.key)===marked && marked!==correct) o.classList.add('incorrect'); o.style.pointerEvents='none'; });
    const fb=byId(`fb_${i}`); const okItem=marked===correct;
    if(fb){ fb.style.marginTop='8px'; fb.style.padding='8px'; fb.style.borderRadius='10px'; fb.style.border='1px solid '+(okItem?'rgba(16,185,129,.45)':'rgba(239,68,68,.45)'); fb.style.background=okItem?'rgba(16,185,129,.12)':'rgba(239,68,68,.12)'; fb.textContent=(okItem?'¡Correcto! ':'Incorrecto. ')+(div.dataset.fbText||''); }
    if(okItem) ok++; detail.push({indice:i+1,respuesta_marcada:marked,respuesta_correcta:correct,es_correcta:okItem});
  });
  return {ok,total:qs.length,detail};
}

// Persistencia (no bloquea UI)
async function saveResultados({ tiempoMs, aciertos, total, palabras }){
  const wpm = (palabras * 60000) / (tiempoMs || 1);
  const compr = (aciertos / (total || 1)) * 100;
  const ve = wpm * (compr / 100);
  const payload = {
    estudiante_id: state.user?.id || null,
    lectura_id: state.lecture?.id || null,
    titulo: state.lecture?.titulo || '',
    palabras,
    tiempo_lectura_ms: Math.round(tiempoMs),
    palabras_por_minuto: Math.round(wpm * 100) / 100,
    respuestas_tc: { preguntas: state.compAnswersJson?.preguntas || [] },
    aciertos_tc: aciertos,
    total_preguntas_tc: total,
    porcentaje_comprension: Math.round(compr * 100) / 100,
    velocidad_efectiva: Math.round(ve * 100) / 100,
    session_date: new Date().toISOString(),
  };
  // Guarda en localStorage para el dashboard SIEMPRE
  try { localStorage.setItem('tsp_last_result', JSON.stringify(payload)); } catch {}
  // Intenta guardar en Supabase
  try{
    const {data,error}=await sb.from('resultados_mlc').insert(payload).select();
    if(error) throw error;
    return data && data[0] ? data[0] : payload;
  }catch(err){
    console.warn('No se pudo guardar en Supabase (mostramos resultados locales):', err);
    return payload;
  }
}

// Init
async function init(){
  state.user = getUserFromSession() || { id:null, nombres:'Estudiante', apellidos:'', grado:3 };
  setStudentHeader();
  state.seed = Date.now()>>>0;

  state.lecture = await fetchActiveLectureForUser();
  const pdfUrl = await getPdfUrl(state.lecture);

  const autor = state.lecture.autor || 'Autor';
  const palabras = state.lecture.palabras || 0;
  const gradoStr = `Grado ${state.user?.grado ?? '-'}`;

  byId('readingTitleS1').textContent = state.lecture.titulo || 'Lectura';
  byId('readingMetaS1').textContent  = `${autor} · ${palabras} palabras · ${gradoStr}`;
  byId('readingTitle').textContent   = state.lecture.titulo || 'Lectura';
  byId('readingMeta').textContent    = `${autor} · ${palabras} palabras`;
  byId('pdfFrame').src = pdfUrl;

  renderVocabList(); renderVocabTest(state.seed); renderComprension();
  goTo(1);
}

// Flujo
byId('btnNextToVocabTest').onclick = async () => {
  if(state.vocabPassed){
    if(state.fromStep==='reading'){ await ensureExitFullscreen(); goTo(3); startTimer(); }
    else if(state.fromStep==='comprension'){ await ensureExitFullscreen(); goTo(4); }
    else { goTo(3); startTimer(); }
  }else{ goTo(2); }
};

// Test vocab
byId('vocabTest').addEventListener('change', checkVocabFilled);
byId('btnSubmitVocab').onclick = () => {
  const ok = gradeVocabTest();
  const total = (state.lecture?.vocabulario?.items||[]).length || 10;
  const score = byId('vocabScore'); score.textContent=`Resultado: ${ok}/${total}`; score.style.display='block';
  if(ok===total){ state.vocabPassed=true; byId('retryVocab').style.display='none'; byId('gateToReading').style.display='block'; }
  else{ byId('gateToReading').style.display='none'; byId('retryVocab').style.display='block'; }
};
byId('btnBackToVocab').onclick = ()=>{ state.reseedOnNextVocabTest=true; state.fromStep=null; goTo(1); };
byId('btnStudyAgain').onclick = ()=>{ state.reseedOnNextVocabTest=true; state.fromStep=null; goTo(1); };
byId('btnOpenReading').onclick = ()=>{ goTo(3); startTimer(); };

// Lectura
const finishRead = async ()=>{ pauseTimer(); await ensureExitFullscreen(); goTo(4); };
const minimizeToVocab = async ()=>{ pauseTimer(); await ensureExitFullscreen(); state.fromStep='reading'; goTo(1); };
byId('btnToggleFullRead').onclick = ()=>toggleFullscreen(byId('step3'));
byId('btnFinishReadTop').onclick   = finishRead;
byId('btnFinishRead').onclick      = finishRead;
byId('btnMinimizeReadTop').onclick = minimizeToVocab;
byId('btnMinimizeRead').onclick    = minimizeToVocab;

// Comprensión
byId('btnToggleFullComp').onclick = ()=>toggleFullscreen(byId('step4'));
byId('btnBackToVocabFromComp').onclick = async ()=>{ await ensureExitFullscreen(); state.fromStep='comprension'; goTo(1); };
byId('comprension').addEventListener('change', checkComprFilled);

// Registrar respuestas (mostrar MODAL)
byId('btnSubmitComprension').onclick = async ()=>{
  const res = gradeComprension();
  state.compAnswersJson = { preguntas: res.detail };

  const tiempoMs = state.readingAccumMs;
  const palabras = state.lecture.palabras || 0;
  const wpm  = Math.round((palabras * 60000) / (tiempoMs || 1));
  const compr= Math.round((res.ok / (res.total || 1)) * 100);
  const ve   = Math.round(wpm * (compr / 100));

  // Mostrar modal (salimos de fullscreen por si acaso)
  await ensureExitFullscreen();
  byId('rWpm').textContent   = `${wpm}`;
  byId('rCompr').textContent = `${compr}%`;
  byId('rVE').textContent    = `${ve}`;
  byId('rTime').textContent  = fmtTime(tiempoMs);
  byId('resTitle').textContent = `${state.lecture.titulo || 'Lectura'} · ${new Date().toLocaleString()}`;
  const modal = byId('resultsModal'); modal.hidden=false; modal.classList.add('show');

  // Guardado (no bloquea)
  await saveResultados({ tiempoMs, aciertos: res.ok, total: res.total, palabras });

  // Activar botón de footer para revisión posterior
  byId('reviewFooter').style.display = 'none';
};

// Modal botones
byId('btnModalReview').onclick = ()=>{
  // Cierra modal y deja visibles las correcciones en el formulario
  const modal = byId('resultsModal');
  modal.classList.remove('show'); modal.hidden = true;
  // Muestra botón de ir al dashboard al final del test
  byId('reviewFooter').style.display = 'flex';
};
byId('btnModalDashboard').onclick = ()=>{ /* el href ya navega; nada extra */ };

// GO!
init().catch(err=>{
  console.error(err);
  alert('Error inicializando MLC: '+ err.message);
});
