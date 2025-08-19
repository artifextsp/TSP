
/**
 * TSP · Módulo de Gráficos de Rendimiento (MLC)
 * Archivo: js/mlc-charts.js
 * Requisitos:
 *  - Supabase JS v2 cargado (CDN) y cliente inicializado en window.supabaseClient o variable global 'supabase'.
 *  - Chart.js cargado (CDN).
 *  - Tres <canvas> con ids: chartWPM, chartComprension, chartVE en el dashboard del estudiante.
 *  - Usuario actual en sessionStorage/localStorage bajo las claves 'tsp_user' o 'userProfile' (fallback).
 *
 * Este módulo es autónomo: si no encuentra Supabase, usa localStorage:tsp_last_result como fallback para pintar al menos un punto.
 */

(function(){
  const TZ = 'America/Bogota';

  // ===== Utilidades =====
  const $ = (s)=>document.querySelector(s);
  const fmtDate = (iso)=>{
    try{
      const d = new Date(iso);
      return d.toLocaleDateString('es-CO', { timeZone: TZ, year:'2-digit', month:'2-digit', day:'2-digit'});
    }catch{ return String(iso||''); }
  };
  const getUser = ()=>{
    try{
      const raw = sessionStorage.getItem('tsp_user') || sessionStorage.getItem('userProfile') || localStorage.getItem('tsp_user');
      return raw ? JSON.parse(raw) : null;
    }catch{ return null; }
  };

  // ===== Detección de dependencias =====
  function assertDeps(){
    if (!window.Chart) {
      throw new Error('Chart.js no está cargado. Asegúrate de incluir <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>');
    }
    // Cliente Supabase puede venir como window.supabase (factory) + crear cliente en SUPABASE_CONFIG,
    // o bien estar ya creado en global como "supabase". Usamos cualquiera disponible.
    let client = null;
    if (window.supabase && typeof window.supabase.createClient === 'function' && window.SUPABASE_CONFIG) {
      client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      window.supabaseClient = client;
    } else if (window.supabaseClient) {
      client = window.supabaseClient;
    } else if (typeof window.supabase !== 'undefined' && window.supabase.from) {
      // algunos proyectos exponen el cliente como 'supabase'
      client = window.supabase;
      window.supabaseClient = client;
    } else if (typeof window.supabase !== 'undefined' && !window.SUPABASE_CONFIG) {
      // hay factory pero no config
      console.warn('Se encontró la librería de Supabase pero no SUPABASE_CONFIG. Se usará fallback local si es necesario.');
    }
    return { client };
  }

  // ===== Datos =====
  async function fetchResultados(estudianteId){
    const { client } = assertDeps();
    if (!client) {
      console.warn('⚠️ No hay cliente Supabase. Usando fallback localStorage.');
      return fetchResultadosFallback();
    }

    try{
      const { data, error } = await client
        .from('resultados_mlc')
        .select('session_date, palabras_por_minuto, porcentaje_comprension, velocidad_efectiva')
        .eq('estudiante_id', estudianteId)
        .order('session_date', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        console.warn('No se encontraron resultados en Supabase. Usando fallback local.');
        return fetchResultadosFallback();
      }
      return data;
    }catch(err){
      console.warn('Error consultando Supabase, fallback local:', err);
      return fetchResultadosFallback();
    }
  }

  function fetchResultadosFallback(){
    try{
      const raw = localStorage.getItem('tsp_last_result');
      if (!raw) return [];
      const r = JSON.parse(raw);
      return [{
        session_date: r.session_date || new Date().toISOString(),
        palabras_por_minuto: r.palabras_por_minuto || 0,
        porcentaje_comprension: r.porcentaje_comprension || 0,
        velocidad_efectiva: r.velocidad_efectiva || 0
      }];
    }catch{
      return [];
    }
  }

  function transform(data){
    const labels = data.map(r => fmtDate(r.session_date));
    return {
      labels,
      wpm: data.map(r => Number(r.palabras_por_minuto || 0)),
      comprension: data.map(r => Number(r.porcentaje_comprension || 0)),
      ve: data.map(r => Number(r.velocidad_efectiva || 0))
    };
  }

  // ===== Gráficos =====
  function makeBaseOptions({yTitle, perc=false}){
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx)=>{
              const v = ctx.parsed.y;
              if (perc) return `${v.toFixed(1)}%`;
              if (yTitle.toLowerCase().includes('wpm')) return `${v.toFixed(1)} WPM`;
              if (yTitle.toLowerCase().includes('efectiva')) return `${v.toFixed(1)} VE`;
              return v.toFixed(1);
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Ciclo / Fecha' },
          ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 8 }
        },
        y: {
          title: { display: true, text: yTitle },
          beginAtZero: true,
          suggestedMax: perc ? 100 : undefined,
          ticks: perc ? {
            callback: (v)=>`${v}%`
          } : undefined,
          grid: { drawBorder: false }
        }
      },
      elements: {
        line: { tension: 0.3, borderWidth: 2 },
        point: { radius: 3, hoverRadius: 5 }
      }
    };
  }

  function renderLineChart(canvasId, labels, data, color){
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      console.warn(`Canvas #${canvasId} no encontrado`);
      return null;
    }
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: color.replace('1)', '0.12)').replace('rgb', 'rgba'),
          fill: true
        }]
      },
      options: makeBaseOptions({
        yTitle: canvasId === 'chartComprension' ? '% Comprensión' :
                canvasId === 'chartVE' ? 'Velocidad efectiva (VE)' :
                'Velocidad de lectura (WPM)',
        perc: canvasId === 'chartComprension'
      })
    });
  }

  // Colores (usamos rgb() para derivar rgba con alpha)
  const COLORS = {
    wpm: 'rgb(37, 99, 235, 1)',          // azul
    comprension: 'rgb(22, 163, 74, 1)',  // verde
    ve: 'rgb(245, 158, 11, 1)'           // amarillo
  };

  async function initCharts(){
    try{
      const user = getUser();
      if (!user || !user.id) {
        console.warn('No se encontró usuario en sesión. Se usarán datos locales si existen.');
      }

      const rows = await fetchResultados(user?.id || null);
      const { labels, wpm, comprension, ve } = transform(rows);

      // Si no hay datos, mostramos placeholders
      if (!labels.length) {
        ['chartWPM','chartComprension','chartVE'].forEach(id => {
          const c = document.getElementById(id);
          if (c) {
            const parent = c.parentElement;
            parent.style.minHeight = '240px';
            parent.style.display = 'grid';
            parent.style.placeItems = 'center';
            parent.innerHTML = '<div style="color:#64748b;font-style:italic">Sin datos para graficar aún</div>';
          }
        });
        return;
      }

      // Render
      renderLineChart('chartWPM', labels, wpm, COLORS.wpm);
      renderLineChart('chartComprension', labels, comprension, COLORS.comprension);
      renderLineChart('chartVE', labels, ve, COLORS.ve);

      // Accesibilidad: aria-live para avisar render
      const live = document.getElementById('chartsLiveRegion');
      if (live) {
        live.textContent = `Se cargaron ${labels.length} registros de MLC para gráficos de WPM, Comprensión y Velocidad Efectiva.`;
      }
    }catch(err){
      console.error('Error inicializando gráficos MLC:', err);
      // degradación elegante
      ['chartWPM','chartComprension','chartVE'].forEach(id => {
        const c = document.getElementById(id);
        if (c) {
          const parent = c.parentElement;
          parent.style.minHeight = '240px';
          parent.style.display = 'grid';
          parent.style.placeItems = 'center';
          parent.innerHTML = '<div style="color:#ef4444">No fue posible cargar los gráficos</div>';
        }
      });
    }
  }

  // Auto-init cuando el DOM está listo
  document.addEventListener('DOMContentLoaded', initCharts);
})();
