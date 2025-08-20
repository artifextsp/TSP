// === TSP v2.4 - MLC MODULE (con guard de ciclo) ===
(function(){
  "use strict";

  // Supabase
  const SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
    url: 'https://kryqjsncqsopjuwymhqd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeXFqc25jcXNvcGp1d3ltaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjM3MDEsImV4cCI6MjA2ODg5OTcwMX0.w5HiaFiqlFJ_3QbcprUrufsOXTDWFg1zUMl2J7kWD6Y'
  };
  (function ensureSupabaseClient(){
    try{
      if (!window.supabase) return;
      if (!window.supabaseClient) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      }
      console.log("✅ Supabase client listo (mlc-module)");
    }catch(e){ console.warn("⚠️ Supabase init (mlc-module):", e); }
  })();

  // Utils
  const getUser = ()=>{ try{ const raw = sessionStorage.getItem("tsp_user")||sessionStorage.getItem("userProfile"); return raw? JSON.parse(raw): null; }catch{return null;} };
  const nowIso = ()=> new Date().toISOString();

  // Offline queue for results
  const getQueue = ()=>{ try { return JSON.parse(localStorage.getItem('tsp_results_queue')||'[]'); } catch { return []; } };
  const setQueue = (arr)=>{ try { localStorage.setItem('tsp_results_queue', JSON.stringify(arr)); } catch {} };
  async function trySyncQueue(){
    const sb = window.supabaseClient; if (!sb) return;
    const q = getQueue(); if (!q.length) return;
    try{ const { error } = await sb.from('resultados_mlc').insert(q); if (!error){ setQueue([]); console.log(`☁️ Sincronizados ${q.length} resultados pendientes (mlc).`);} }catch(e){ console.warn("No se pudo sincronizar la cola (mlc):", e); }
  }

  class MLCModule {
    constructor(){ this.user=null; this.lecture=null; this.answers=null; }

    async init(){
      this.user = getUser();
      if (!this.user){
        alert("Tu sesión expiró. Inicia sesión nuevamente.");
        window.location.replace("../login.html"); // ajusta si es necesario
        return;
      }

      // 👉 Guard de ciclo
      const assignmentRaw = sessionStorage.getItem('tsp_current_assignment');
      if (!assignmentRaw){
        alert("No tienes un ciclo asignado. Vuelve al dashboard y pide a tu docente que te asigne uno.");
        window.location.replace("./dashboard-estudiante.html");
        return;
      }
      const assignment = JSON.parse(assignmentRaw);

      // Tomamos lectura_id desde el ciclo
      const lecturaId = assignment.ciclos?.lectura_id ?? assignment.lectura_id ?? null;
      if (!lecturaId){
        alert("El ciclo asignado no tiene una lectura configurada. Avisa a tu docente.");
        window.history.back();
        return;
      }

      // Si tu UI necesita título/autor para mostrar en cabecera:
      const titulo = assignment.ciclos?.lecturas?.titulo || "";
      // Guardamos datos base para futuros cálculos/guardado
      this.lecture = { id: lecturaId, titulo, palabras: undefined };

      // Sincroniza pendientes primero
      await trySyncQueue();
      console.log("📘 MLC listo con ciclo:", this.lecture);
    }

    start({ lecture }){ this.lecture = lecture || this.lecture || null; }
    setAnswers(answersJson){ this.answers = answersJson || null; }

    async finish({ tiempoMs, aciertos, total, palabras }){
      if (!this.user) this.user = getUser();
      const w = typeof palabras === "number" ? palabras : (this.lecture?.palabras || 0);
      const wpm = (w * 60000) / (Math.max(1, tiempoMs || 0));
      const compr = (aciertos / Math.max(1, total || 0)) * 100;
      const ve = wpm * (compr / 100);

      const payload = {
        estudiante_id: this.user?.id || null,
        lectura_id: this.lecture?.id || null,
        titulo: this.lecture?.titulo || "",
        palabras: w,
        tiempo_lectura_ms: Math.round(tiempoMs || 0),
        palabras_por_minuto: Math.round(wpm*100)/100,
        porcentaje_comprension: Math.round(compr*100)/100,
        velocidad_efectiva: Math.round(ve*100)/100,
        aciertos_tc: aciertos ?? null,
        total_preguntas_tc: total ?? null,
        respuestas_tc: this.answers || null,
        session_date: nowIso()
      };

      try { localStorage.setItem('tsp_last_result', JSON.stringify(payload)); } catch {}
      let inserted = false;
      const sb = window.supabaseClient;
      if (sb){
        try{ const { error } = await sb.from('resultados_mlc').insert(payload); if (error) throw error; inserted = true; }
        catch(e){ console.warn("Supabase falló, encolando…", e); }
      }
      if (!inserted){ const q = getQueue(); q.push(payload); setQueue(q); }
      return payload;
    }
  }

  const instance = new MLCModule();
  window.MLC = {
    init: ()=>instance.init(),
    start: (opts)=>instance.start(opts||{}),
    setAnswers: (a)=>instance.setAnswers(a),
    finish: (args)=>instance.finish(args||{})
  };

  document.addEventListener("DOMContentLoaded", ()=>{ window.MLC.init(); });
})();
