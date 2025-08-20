// === TSP v2.1 - DASHBOARD ESTUDIANTE ===
// Archivo: js/dashboard-estudiante.js
// Compatibilidad total con: js/mlc-charts.js (auto-init), localStorage/sessionStorage y Supabase v2.
//
// Qué hace este archivo:
// 1) Carga y normaliza el usuario (sessionStorage['tsp_user'] o ['userProfile']); guarda compat en localStorage.
// 2) Pinta cabecera y tarjeta de información del estudiante.
// 3) Muestra último resultado (desde Supabase si está disponible; fallback a localStorage:tsp_last_result).
// 4) Gestiona navegación a módulos (openModule) y logout.
// 5) Deja listo el terreno para los gráficos: si el HTML tiene los <canvas> y Chart.js está cargado,
//    js/mlc-charts.js se auto-inicializa al DOMContentLoaded sin que tengas que hacer nada aquí.
//
// Requisitos en el HTML (dashboard-estudiante.html):
//  - Cargar Supabase JS v2 por CDN (antes de este archivo): <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//  - Cargar Chart.js por CDN (antes de mlc-charts.js): <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
//  - Incluir <script src="../js/mlc-charts.js"></script> al final del <body> (después de este archivo).
//  - Tener la sección de charts con 3 canvas: #chartWPM, #chartComprension, #chartVE (ver brief).
//
// Notas:
//  - Este archivo no dibuja gráficos: lo hace mlc-charts.js (ya entregado). Aquí aseguramos que el usuario esté listo en sesión.
//  - Si no hay Supabase, el dashboard sigue funcionando con datos locales.

(function(){
  "use strict";

  // ========== CONFIGURACIÓN SUPABASE ==========
  // (idealmente mover a config.js en producción)
  const SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
    url: 'https://kryqjsncqsopjuwymhqd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeXFqc25jcXNvcGp1d3ltaHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMjM3MDEsImV4cCI6MjA2ODg5OTcwMX0.w5HiaFiqlFJ_3QbcprUrufsOXTDWFg1zUMl2J7kWD6Y'
  };

  // Garantizamos un cliente global reutilizable (window.supabaseClient)
  (function ensureSupabaseClient(){
    try{
      if (!window.supabase) return; // la librería no está cargada; modo local
      if (window.supabaseClient && typeof window.supabaseClient.from === "function") return;
      window.supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      console.log("✅ Supabase client listo (dashboard)");
    }catch(e){
      console.warn("⚠️ No fue posible inicializar Supabase client:", e);
    }
  })();

  // Shorthands
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>document.querySelectorAll(s);
  const TZ = "America/Bogota";
  const fmtDateTime = (d)=> new Date(d).toLocaleString("es-CO",{ dateStyle:"medium", timeStyle:"short", timeZone: TZ });
  const fmtMinutes = (ms)=> (ms>0? (ms/1000/60).toFixed(2)+" min" : "0.00 min");

  class EstudianteDashboard {
    constructor() {
      this.user = null;
      this.currentAssignment = null;
      this.charts = {}; // reservado (mlc-charts maneja gráficos)
    }

    async init() {
      try {
        this.user = this.getUserFromSession();
        if (!this.user) {
          console.warn("No hay usuario en sesión, redirigiendo al login");
          window.location.href = "../login.html";
          return;
        }

        // Normalizamos presencia del usuario para modulos y mlc-charts
        this.persistUserForModules(this.user);

        this.paintHeader();
        this.paintUserInfo();

        await this.loadCurrentAssignment();
        await this.loadLastSessionResults();

        // Los gráficos quedan a cargo de mlc-charts.js (auto DOMContentLoaded)
        this.updateDateTime();
        setInterval(()=>this.updateDateTime(), 60_000);

        this.wireModules();
        const logoutBtn = $("#btnLogout");
        if (logoutBtn) logoutBtn.addEventListener("click", this.onLogout);

        console.log("✅ Dashboard del estudiante inicializado correctamente");
      } catch (error) {
        console.error("❌ Error inicializando dashboard:", error);
        alert("Error al cargar el dashboard");
      }
    }

    // ----- Usuario -----
    getUserFromSession() {
      try{
        // Preferimos tsp_user (compat con módulos y charts), luego userProfile
        const raw = sessionStorage.getItem("tsp_user") || sessionStorage.getItem("userProfile");
        if (raw) return JSON.parse(raw);
      }catch{ /* ignore */ }

      // Fallback de desarrollo
      return {
        id: "user-demo",
        codigo_estudiante: "E001002",
        nombres: "Estudiante",
        apellidos: "Demo",
        grado: 5,
        seccion: "A",
        institucion: { nombre: "Colegio San José" },
        grupo: { nombre: "5°A", grado: 5 }
      };
    }

    persistUserForModules(user){
      try {
        // Necesario para mlc-module y mlc-charts
        sessionStorage.setItem("tsp_user", JSON.stringify(user));
        localStorage.setItem("tsp_user", JSON.stringify(user));
      } catch {}
    }

    // ----- Pintado de UI -----
    paintHeader(){
      const welcome = $("#welcome") || $("#welcomeMessage");
      if (welcome) welcome.textContent = `Bienvenido/a ${this.user.nombres} ${this.user.apellidos}`;
      const today = $("#today") || $("#currentDate");
      if (today) today.textContent = new Date().toLocaleString("es-CO",{weekday:"long", year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit", timeZone: TZ});
    }

    paintUserInfo(){
      const codeEl = $("#uCodigo") || $("#studentCode");
      const gradeEl = $("#uGrado") || $("#studentGrade");
      const instEl = $("#uInst") || $("#studentInstitution");

      if (codeEl) codeEl.textContent = this.user.codigo_estudiante || "—";
      if (gradeEl) {
        const gradoTxt = this.user.grupo ? this.user.grupo.nombre : `${this.user.grado ?? "-"}°${this.user.seccion ?? ""}`;
        gradeEl.textContent = gradoTxt;
      }
      if (instEl) instEl.textContent = (this.user.institucion && this.user.institucion.nombre) ? this.user.institucion.nombre : "No asignada";
    }

    // ----- Asignación actual -----
    async loadCurrentAssignment(){
      const sb = window.supabaseClient;
      if (!sb) { // modo local
        this.updateModuleStatus(true);
        return;
      }
      try{
        const { data, error } = await sb
          .from("asignaciones_ciclos")
          .select(`*, ciclos ( lectura_id, desafio_id, ejercicios_ids, lecturas (titulo, autor), desafios_mentales (titulo) )`)
          .eq("estudiante_id", this.user.id)
          .eq("activo", true)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        if (data && data.length) {
          this.currentAssignment = data[0];
          await this.updateModuleStatus(false);
        } else {
          this.showNoAssignmentMessage();
        }
      }catch(e){
        console.error("Error cargando asignación:", e);
        this.updateModuleStatus(true);
      }
    }

    async updateModuleStatus(useFallback){
      if (useFallback || !this.currentAssignment){
        this.updateModuleUI("mlc", false);
        this.updateModuleUI("mdm", false);
        this.updateModuleUI("med", false);
        return;
      }
      const asignacionId = this.currentAssignment.id;
      const [mlcCompleted, mdmCompleted, medCompleted] = await Promise.all([
        this.checkModuleCompletion("resultados_mlc", asignacionId),
        this.checkModuleCompletion("resultados_mdm", asignacionId),
        this.checkModuleCompletion("resultados_med", asignacionId)
      ]);
      this.updateModuleUI("mlc", mlcCompleted);
      this.updateModuleUI("mdm", mdmCompleted);
      this.updateModuleUI("med", medCompleted);
    }

    async checkModuleCompletion(table, asignacionId){
      const sb = window.supabaseClient;
      if (!sb) return !!localStorage.getItem("tsp_last_result"); // heurística local
      try{
        const { data, error } = await sb.from(table).select("id").eq("estudiante_id", this.user.id).eq("asignacion_id", asignacionId);
        return !error && data && data.length > 0;
      }catch(e){
        console.warn(`Error verificando completación de ${table}:`, e);
        return false;
      }
    }

    updateModuleUI(module, completed){
      // Soporte a ambos markups: grid accesible o cards con .module-btn
      const pillAlt = {
        "mlc": $("#mlcPill"),
        "mdm": $("#mdmPill"),
        "med": $("#medPill")
      }[module];

      const statusElement = document.getElementById(`${module}Status`);
      const buttonElement = document.querySelector(`#${module}Module .module-btn`);

      const setAsCompleted = ()=>{
        if (statusElement){ statusElement.textContent = "Completado"; statusElement.className = "module-status completed"; }
        if (buttonElement) buttonElement.textContent = "Ver Resultados";
        if (pillAlt){ pillAlt.textContent = "Completado"; pillAlt.classList.remove("in-progress"); pillAlt.classList.add("completed"); }
      };
      const setAsPending = ()=>{
        if (statusElement){ statusElement.textContent = "Pendiente"; statusElement.className = "module-status pending"; }
        if (buttonElement) buttonElement.textContent = "Iniciar";
        if (pillAlt){ pillAlt.textContent = "Pendiente"; pillAlt.classList.remove("completed"); pillAlt.classList.add("in-progress"); }
      };

      completed ? setAsCompleted() : setAsPending();
    }

    showNoAssignmentMessage(){
      const modulesGrid = document.querySelector(".modules-grid");
      if (!modulesGrid) return;
      modulesGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 2rem; background: var(--gray-50); border-radius: var(--radius-xl); border: 2px dashed var(--gray-400);">
          <h3 style="color: var(--gray-600); margin-bottom: 1rem;">No hay ciclo de entrenamiento asignado</h3>
          <p style="color: var(--gray-500);">Contacta a tu docente para que te asigne un ciclo de entrenamiento.</p>
        </div>`;
    }

    // ----- Últimos resultados -----
    async loadLastSessionResults(){
      const sb = window.supabaseClient;
      if (!sb){
        this.paintLastResultFromLocalStorage();
        return;
      }
      try{
        // MLC
        const { data: mlcData } = await sb
          .from("resultados_mlc")
          .select("*, lecturas(titulo, autor)")
          .eq("estudiante_id", this.user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (mlcData && mlcData.length) this.displayLastMlcResult(mlcData[0]); else this.paintLastResultFromLocalStorage();

        // MDM
        const { data: mdmData } = await sb
          .from("resultados_mdm")
          .select("*, desafios_mentales(titulo)")
          .eq("estudiante_id", this.user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (mdmData && mdmData.length) this.displayLastMdmResult(mdmData[0]);

        // MED
        const { data: medData } = await sb
          .from("resultados_med")
          .select("*, ejercicios_digitales(nombre)")
          .eq("estudiante_id", this.user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (medData && medData.length) this.displayLastMedResult(medData[0]);
      }catch(e){
        console.error("Error cargando últimos resultados:", e);
        this.paintLastResultFromLocalStorage();
      }
    }

    displayLastMlcResult(result){
      const banner = $("#lastResult");
      if (banner) banner.classList.add("show");

      const meta = $("#lastResultMeta");
      if (meta) meta.textContent = `${(result.lecturas && result.lecturas.titulo) ? result.lecturas.titulo : (result.titulo || "Lectura")} · ${fmtDateTime(result.session_date || result.created_at || Date.now())}`;

      const set = (id, v)=>{ const el = $(id); if (el) el.textContent = v; };
      set("#lrWpm", (result.palabras_por_minuto ?? 0).toFixed(0));
      set("#lrCompr", `${(result.porcentaje_comprension ?? 0).toFixed(0)}%`);
      set("#lrVE", (result.velocidad_efectiva ?? 0).toFixed(0));
      set("#lrTime", fmtMinutes(result.tiempo_lectura_ms || 0));

      const box = $("#lastMlcBox") || $("#lastMlcResults");
      if (box) {
        box.innerHTML = `
          <div><strong>${(result.lecturas && result.lecturas.titulo) ? result.lecturas.titulo : (result.titulo || "Lectura")}</strong></div>
          <div class="muted">${fmtDateTime(result.session_date || result.created_at || Date.now())}</div>
          <div class="metrics" style="margin-top:10px">
            <div class="metric"><div class="v">${Math.round(result.palabras_por_minuto || 0)}</div><div>WPM</div></div>
            <div class="metric"><div class="v">${Math.round(result.porcentaje_comprension || 0)}%</div><div>%</div></div>
            <div class="metric"><div class="v">${Math.round(result.velocidad_efectiva || 0)}</div><div>VE</div></div>
            <div class="metric"><div class="v">${fmtMinutes(result.tiempo_lectura_ms || 0)}</div><div>Tiempo</div></div>
          </div>`;
      }
    }

    displayLastMdmResult(result){
      const container = $("#lastMdmResults");
      if (!container) return;
      container.innerHTML = `
        <div style="margin-bottom: 0.5rem;"><strong>${result.desafios_mentales?.titulo || "Desafío"}</strong></div>
        <div style="font-size: 0.875rem;"><span>Porcentaje Alcanzado: ${result.porcentaje_alcanzado ?? 0}%</span></div>
        <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 0.5rem;">${fmtDateTime(result.session_date || result.created_at || Date.now())}</div>`;
    }

    displayLastMedResult(result){
      const container = $("#lastMedResults");
      if (!container) return;
      container.innerHTML = `
        <div style="margin-bottom: 0.5rem;"><strong>${result.ejercicios_digitales?.nombre || "Ejercicio"}</strong></div>
        <div style="display: flex; gap: 1rem; font-size: 0.875rem;">
          <span>Nivel: ${result.nivel_alcanzado ?? "-"}</span>
          <span>Puntos: ${(result.puntos_obtenidos ?? 0).toLocaleString()}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--gray-600); margin-top: 0.5rem;">${fmtDateTime(result.session_date || result.created_at || Date.now())}</div>`;
    }

    paintLastResultFromLocalStorage(){
      try{
        const raw = localStorage.getItem("tsp_last_result");
        if (!raw) return;
        const r = JSON.parse(raw);

        // Banner
        const banner = $("#lastResult");
        if (banner) banner.classList.add("show");
        const meta = $("#lastResultMeta");
        if (meta) meta.textContent = `${r.titulo || "Lectura"} · ${fmtDateTime(r.session_date || Date.now())}`;
        const set = (id, v)=>{ const el = $(id); if (el) el.textContent = v; };
        set("#lrWpm", Math.round(r.palabras_por_minuto || 0));
        set("#lrCompr", `${Math.round(r.porcentaje_comprension || 0)}%`);
        set("#lrVE", Math.round(r.velocidad_efectiva || 0));
        set("#lrTime", fmtMinutes(r.tiempo_lectura_ms || 0));

        // Card MLC
        const box = $("#lastMlcBox") || $("#lastMlcResults");
        if (box) {
          box.innerHTML = `
            <div><strong>${r.titulo || "Lectura"}</strong></div>
            <div class="muted">${fmtDateTime(r.session_date || Date.now())}</div>
            <div class="metrics" style="margin-top:10px">
              <div class="metric"><div class="v">${Math.round(r.palabras_por_minuto || 0)}</div><div>WPM</div></div>
              <div class="metric"><div class="v">${Math.round(r.porcentaje_comprension || 0)}%</div><div>%</div></div>
              <div class="metric"><div class="v">${Math.round(r.velocidad_efectiva || 0)}</div><div>VE</div></div>
              <div class="metric"><div class="v">${fmtMinutes(r.tiempo_lectura_ms || 0)}</div><div>Tiempo</div></div>
            </div>`;
        }

        // Actualiza pill del módulo
        const pill = $("#mlcPill");
        if (pill){ pill.textContent="Completado"; pill.classList.remove("in-progress"); pill.classList.add("completed"); }
      }catch(e){
        console.warn("No fue posible pintar resultados locales:", e);
      }
    }

    // ----- Navegación módulos -----
    wireModules(){
      $$(".module-card,[data-module],.module-actions .btn").forEach(el=>{
        el.addEventListener("click", ()=>{
          const m = el.dataset.module || el.closest("[data-module]")?.dataset.module;
          if (!m) return;
          openModule(m);
        });
        el.addEventListener("keydown", (ev)=>{
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); el.click(); }
        });
      });
    }

    onLogout(){
      if (!confirm("¿Estás seguro de que quieres cerrar sesión?")) return;
      try{ sessionStorage.clear(); localStorage.clear(); }catch{}
      window.location.href = "../login.html";
    }

    updateDateTime(){
      const el = $("#today") || $("#currentDate");
      if (!el) return;
      el.textContent = new Date().toLocaleString("es-CO",{weekday:"long", year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit", timeZone: TZ});
    }
  }

  // ====== API GLOBAL ======
  // Navegación a módulos (manteniendo compat)
  window.openModule = function(moduleType){
    console.log(`🎯 Abriendo módulo: ${moduleType}`);
    const urls = { MLC: "mlc-module.html", MDM: "mdm-module.html", MED: "med-module.html" };
    const url = urls[moduleType];
    if (!url){ alert("Módulo no disponible"); return; }

    // Guardamos usuario para el módulo (ya lo hizo persistUserForModules, pero reforzamos)
    try{
      const raw = sessionStorage.getItem("tsp_user") || sessionStorage.getItem("userProfile");
      if (raw) sessionStorage.setItem("tsp_user", raw);
    }catch{}

    if (moduleType === "MLC"){
      // Overlay bonito de carga
      const loadingOverlay = document.createElement("div");
      loadingOverlay.style.cssText = `position:fixed;inset:0;background:linear-gradient(135deg,var(--primary-600),var(--primary-800));color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999`;
      loadingOverlay.innerHTML = `
        <div style="text-align:center">
          <div style="font-size:4rem;margin-bottom:1rem">📚</div>
          <h2 style="margin-bottom:1rem;font-size:1.5rem">Módulo de Lectura Crítica</h2>
          <p style="margin-bottom:2rem;opacity:.9">Cargando…</p>
          <div style="width:200px;height:4px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden">
            <div style="width:100%;height:100%;background:#fff;border-radius:2px;animation:loading 1s ease-in-out"></div>
          </div>
        </div>
        <style>@keyframes loading{0%{width:0%}100%{width:100%}}</style>`;
      document.body.appendChild(loadingOverlay);
      setTimeout(()=>{ window.location.href = url; }, 900);
    } else {
      alert(`📋 Módulo ${moduleType}\n\n🚧 En desarrollo\n\nPróximamente: ${url}`);
    }
  };

  // Inicialización
  let estudianteDashboard;
  async function initEstudianteDashboard(){
    estudianteDashboard = new EstudianteDashboard();
    await estudianteDashboard.init();
  }
  document.addEventListener("DOMContentLoaded", ()=>{
    console.log("🎓 Inicializando Dashboard del Estudiante TSP v2.1…");
    initEstudianteDashboard();
  });
})();