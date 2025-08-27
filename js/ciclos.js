// /js/ciclos.js
// Módulo de UI para Admin · Ciclos
// Rutas de buckets:
// - Lecturas:  tsp-lecturas/grado-{G}/ciclo-{C}/g{G}c{C}.pdf
// - Desafíos:  tsp-desafios/grado-{G}/ciclo-{C}/dcg{G}c{C}.pdf

import { supabase } from './supabaseClient.js';

// Si ya tienes api-ciclos.js y prefieres centralizar llamadas, puedes usarlo así:
// import { listarLecturasPorGrado, listarDesafiosPorGrado, listarJuegosPorGrado, crearCicloAdmin } from './api-ciclos.js';

const $ = (q) => document.querySelector(q);

// ====== refs ======
const gradoSel           = $('#gradoSel');
const lecturaSel         = $('#lecturaSel');
const btnPreviewLectura  = $('#btnPreviewLectura');
const desafioSel         = $('#desafioSel');
const btnPreviewDesafio  = $('#btnPreviewDesafio');
const juegosSel          = $('#juegosSel');
const nombreCicloInput   = $('#nombreCiclo');
const descCicloInput     = $('#descCiclo');
const btnCrear           = $('#btnCrear');
const btnLimpiar         = $('#btnLimpiar');

// ====== helpers UI ======
function opt(value, label, extra = {}) {
  const o = document.createElement('option');
  o.value = value ?? '';
  o.textContent = label ?? '';
  Object.entries(extra).forEach(([k, v]) => o.dataset[k] = v);
  return o;
}

function fillSelect(sel, items, { placeholder = '— Selecciona —', getValue, getLabel, getData } = {}) {
  sel.innerHTML = '';
  sel.appendChild(opt('', placeholder));
  (items || []).forEach(it => {
    sel.appendChild(opt(getValue(it), getLabel(it), getData ? getData(it) : {}));
  });
  sel.dispatchEvent(new Event('change'));
}

function fillMultiSelect(sel, items, { getValue, getLabel }) {
  sel.innerHTML = '';
  (items || []).forEach(it => sel.appendChild(opt(getValue(it), getLabel(it))));
}

// ====== grados fijos (1°..11° y Profesional=12) ======
const grados = [
  { g:1,  label:'1°' }, { g:2,  label:'2°' }, { g:3,  label:'3°' },
  { g:4,  label:'4°' }, { g:5,  label:'5°' }, { g:6,  label:'6°' },
  { g:7,  label:'7°' }, { g:8,  label:'8°' }, { g:9,  label:'9°' },
  { g:10, label:'10°' },{ g:11, label:'11°' },{ g:12, label:'Profesional' },
];

// ====== llamadas a BD (RPC) ======
// Notas:
// - Estas funciones asumen que existen las RPC con firma INT canonizada:
//   admin_listar_lecturas(p_grado int)
//   admin_listar_desafios(p_grado int)
//   admin_listar_juegos(p_grado int)
// Si tus nombres difieren, cámbialos aquí mismo.

async function rpcLecturas(grado) {
  const { data, error } = await supabase.rpc('admin_listar_lecturas', { p_grado: grado });
  if (error) throw error;
  return data || [];
}

async function rpcDesafios(grado) {
  const { data, error } = await supabase.rpc('admin_listar_desafios', { p_grado: grado });
  if (error) throw error;
  return data || [];
}

async function rpcJuegos(grado) {
  const { data, error } = await supabase.rpc('admin_listar_juegos', { p_grado: grado });
  if (error) throw error;
  return data || [];
}

async function rpcCrearCiclo(payload) {
  // Si ya tienes una function admin_ciclo_crear + publicar, úsala.
  // Aquí como ejemplo simple: insert directo a `ciclos` + `ciclo_juegos`.
  const { data, error } = await supabase.rpc('admin_ciclo_crear_publicar', payload);
  if (error) throw error;
  return data;
}

// ====== preview helpers ======
function parseNumeroDesdeTextoOData(optionEl) {
  // Preferimos data-numero si existe; si no, parseamos "15. Titulo..."
  const num = optionEl?.dataset?.numero;
  if (num) return parseInt(num, 10);
  const txt = optionEl?.textContent || '';
  const m = txt.match(/^\s*(\d+)\s*\./);
  return m ? parseInt(m[1], 10) : null;
}

function abrirPreviewLectura(grado, lecturaOption) {
  const numero = parseNumeroDesdeTextoOData(lecturaOption);
  if (!numero) {
    alert('No pude inferir el número de la lectura (gXcY). Verifica el texto ("15. Título...").');
    return;
  }
  const url = `${location.origin.replace('127.0.0.1:5500','kryqjsncqsopjuwymhqd.supabase.co')}/storage/v1/object/public/tsp-lecturas/grado-${grado}/ciclo-${numero}/g${grado}c${numero}.pdf`;
  window.open(url, '_blank', 'noopener');
}

function abrirPreviewDesafio(grado, desafioOption) {
  // Para desafío usamos el mismo número que el "ciclo" (si tu dropdown ya trae "Ciclo 1", etc.,
  // también puedes guardar data-numero en la opción).
  const numero = parseNumeroDesdeTextoOData(desafioOption) || 1;
  const url = `${location.origin.replace('127.0.0.1:5500','kryqjsncqsopjuwymhqd.supabase.co')}/storage/v1/object/public/tsp-desafios/grado-${grado}/ciclo-${numero}/dcg${grado}c${numero}.pdf`;
  window.open(url, '_blank', 'noopener');
}

// ====== eventos ======
gradoSel.addEventListener('change', async () => {
  const grado = parseInt(gradoSel.value, 10);
  lecturaSel.disabled = true;
  desafioSel.disabled = true;
  juegosSel.disabled  = true;
  btnPreviewLectura.disabled = true;
  btnPreviewDesafio.disabled = true;

  if (!grado) {
    fillSelect(lecturaSel, []);
    fillSelect(desafioSel, []);
    fillMultiSelect(juegosSel, []);
    return;
  }

  try {
    const [lecturas, desafios, juegos] = await Promise.all([
      rpcLecturas(grado),
      rpcDesafios(grado),
      rpcJuegos(grado),
    ]);

    fillSelect(lecturaSel, lecturas, {
      placeholder: '— Selecciona —',
      getValue: (r) => r.id,
      getLabel: (r) => {
        // Si viene "numero" desde la RPC, lo mostramos tipo "15. Título"
        if (r.numero != null) return `${r.numero}. ${r.titulo}`;
        return r.titulo || '(sin título)';
      },
      getData:  (r) => (r.numero != null ? { numero: r.numero } : {}),
    });

    fillSelect(desafioSel, desafios, {
      placeholder: '— Selecciona —',
      getValue: (r) => r.id,
      getLabel: (r) => r.nombre || r.titulo || '(desafío)',
      getData:  (r) => (r.numero != null ? { numero: r.numero } : {}),
    });

    fillMultiSelect(juegosSel, juegos, {
      getValue: (j) => j.id,
      getLabel: (j) => `${j.habilidad ? `[${j.habilidad}] ` : ''}${j.nombre ?? '(juego)'}`,
    });

  } catch (e) {
    console.error(e);
    alert('Error cargando catálogos. Revisa consola.');
  } finally {
    lecturaSel.disabled = false;
    desafioSel.disabled = false;
    juegosSel.disabled  = false;
  }
});

lecturaSel.addEventListener('change', () => {
  btnPreviewLectura.disabled = !(lecturaSel.value);
});
desafioSel.addEventListener('change', () => {
  btnPreviewDesafio.disabled = !(desafioSel.value);
});

btnPreviewLectura.addEventListener('click', () => {
  const grado = parseInt(gradoSel.value, 10);
  const opt = lecturaSel.selectedOptions?.[0];
  if (!grado || !opt?.value) return;
  abrirPreviewLectura(grado, opt);
});
btnPreviewDesafio.addEventListener('click', () => {
  const grado = parseInt(gradoSel.value, 10);
  const opt = desafioSel.selectedOptions?.[0];
  if (!grado || !opt?.value) return;
  abrirPreviewDesafio(grado, opt);
});

btnCrear.addEventListener('click', async () => {
  const grado = parseInt(gradoSel.value, 10) || null;
  const lectura_id = lecturaSel.value || null;
  const desafio_id = desafioSel.value || null;

  // Hasta 3 juegos, o ninguno
  const juegos_ids = Array.from(juegosSel.selectedOptions).map(o => o.value).slice(0,3);
  const payload = {
    p_grado: grado,
    p_nombre: (nombreCicloInput.value || '').trim(),
    p_descripcion: (descCicloInput.value || '').trim(),
    p_lectura_id: lectura_id,
    p_desafio_id: desafio_id,
    p_juegos_ids: juegos_ids
  };

  if (!payload.p_nombre) {
    alert('Ponle un nombre al ciclo.');
    return;
  }

  try {
    btnCrear.disabled = true;
    await rpcCrearCiclo(payload);
    alert('¡Ciclo creado y publicado!');
  } catch (e) {
    console.error(e);
    alert('No se pudo crear el ciclo. Revisa consola.');
  } finally {
    btnCrear.disabled = false;
  }
});

btnLimpiar.addEventListener('click', () => {
  gradoSel.value = '';
  gradoSel.dispatchEvent(new Event('change'));
  nombreCicloInput.value = '';
  descCicloInput.value = '';
});

// ====== init ======
(function init() {
  // Cargar grados
  gradoSel.innerHTML = '';
  gradoSel.appendChild(opt('', '— Selecciona grado —'));
  grados.forEach(g => gradoSel.appendChild(opt(g.g, g.label)));

  // Placeholders al arrancar
  fillSelect(lecturaSel, []);
  fillSelect(desafioSel, []);
  fillMultiSelect(juegosSel, []);
})();
