// js/api-ciclos.js
// API del módulo de Ciclos con fallbacks a tablas si los RPC no existen.

import supabase from './supabaseClient.js';

/* ---------------- Utilidades ---------------- */

const asArray = (x) => (Array.isArray(x) ? x : (x ? [x] : []));
const toInt = (x) => Number.parseInt(String(x ?? '').trim(), 10) || 0;
const throwIf = (e) => { if (e) throw e; };

async function rpcTry(names, payloads) {
  let lastError = null;
  for (const n of asArray(names)) {
    for (const p of asArray(payloads)) {
      try {
        const { data, error } = await supabase.rpc(n, p || {});
        if (error) throw error;
        return data;
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError;
}

/* ---------------- Catálogos ---------------- */

export async function listarLecturas(grado) {
  const g = toInt(grado);
  // 1) RPC si existe
  try {
    const data = await rpcTry(['admin_listar_lecturas', 'admin_listar_lecturas_v2'], [
      { p_grado: g }, { grado: g }
    ]);
    return data || [];
  } catch (rpcErr) {
    console.warn('listarLecturas: RPC no disponible, usando fallback a tabla. Detalle:', rpcErr?.message);
  }
  // 2) Fallback a tabla lecturas
  const { data, error } = await supabase
    .from('lecturas')
    .select('id, titulo, numero, grado_minimo, grado_maximo')
    .order('titulo', { ascending: true });
  throwIf(error);
  const rows = (data || []).filter(l =>
    (l.grado_minimo == null || l.grado_minimo <= g) &&
    (l.grado_maximo == null || l.grado_maximo >= g)
  );
  // si no hay 'numero', lo generamos por orden alfabético
  return rows.map((l, i) => ({
    id: l.id,
    titulo: l.titulo,
    numero: Number.isInteger(l.numero) ? l.numero : (i + 1),
    publicado: true,
  }));
}

export async function listarDesafios(grado) {
  const g = toInt(grado);
  // 1) RPC si existe
  try {
    const data = await rpcTry(['admin_listar_desafios', 'admin_listar_desafios_v2'], [
      { p_grado: g }, { grado: g }
    ]);
    return data || [];
  } catch (rpcErr) {
    console.warn('listarDesafios: RPC no disponible, usando fallback a tabla. Detalle:', rpcErr?.message);
  }
  // 2) Fallback a tabla desafios_mentales
  const { data, error } = await supabase
    .from('desafios_mentales')
    .select('id, nombre, grado_minimo, grado_maximo, activo')
    .order('nombre', { ascending: true });
  throwIf(error);
  const rows = (data || []).filter(d =>
    (d.grado_minimo == null || d.grado_minimo <= g) &&
    (d.grado_maximo == null || d.grado_maximo >= g)
  );
  return rows.map((d, i) => ({
    id: d.id,
    titulo: d.nombre,
    numero: i + 1,
    publicado: d.activo ?? true,
  }));
}

export async function listarJuegos(grado) {
  const g = toInt(grado);
  // 1) RPC si existe
  try {
    const data = await rpcTry(['admin_listar_juegos', 'admin_listar_juegos_v2'], [
      { p_grado: g }, { grado: g }
    ]);
    return data || [];
  } catch (rpcErr) {
    console.warn('listarJuegos: RPC no disponible, usando fallback a tabla. Detalle:', rpcErr?.message);
  }
  // 2) Fallback a tabla juegos_med
  const { data, error } = await supabase
    .from('juegos_med')
    .select('id, nombre, habilidad, grado, estado')
    .eq('grado', g)
    .order('habilidad', { ascending: true })
    .order('nombre', { ascending: true });
  throwIf(error);
  return data || [];
}

/* ---------------- Crear / Publicar / Duplicar ---------------- */

export async function crearCiclo({ grado, nombre, descripcion, lecturaId, desafioId, juegosIds }) {
  const g = toInt(grado);
  const payloadStd = {
    p_grado: g,
    p_nombre: nombre,
    p_descripcion: descripcion || null,
    p_lectura_id: lecturaId || null,
    p_desafio_id: desafioId || null,
    p_juegos: Array.isArray(juegosIds) ? juegosIds : [],
  };
  const payloadAlt = {
    grado: g,
    nombre,
    descripcion: descripcion || null,
    lectura_id: lecturaId || null,
    desafio_id: desafioId || null,
    juegos: Array.isArray(juegosIds) ? juegosIds : [],
  };
  const id = await rpcTry(['admin_ciclo_crear'], [payloadStd, payloadAlt]);
  return id; // uuid
}

export async function publicarCiclo(cicloId) {
  await rpcTry(['admin_ciclo_publicar'], [{ p_ciclo_id: cicloId }, { ciclo_id: cicloId }, { id: cicloId }]);
  return true;
}

export async function duplicarCiclo(cicloId) {
  const data = await rpcTry(['admin_ciclo_duplicar'], [{ p_ciclo_id: cicloId }, { ciclo_id: cicloId }, { id: cicloId }]);
  return data;
}

/* ---------------- Listado de ciclos ---------------- */

export async function listarCiclos({ filtro = '' } = {}) {
  // 1) Vista (preferida)
  try {
    const { data, error } = await supabase
      .from('v_ciclos_listado')
      .select('*')
      .order('updated_at', { ascending: false });
    throwIf(error);
    let rows = data || [];
    if (filtro) {
      const t = filtro.toLowerCase();
      rows = rows.filter(r =>
        (r.nombre || '').toLowerCase().includes(t) ||
        String(r.grado ?? '').toLowerCase().includes(t) ||
        String(r.estado ?? '').toLowerCase().includes(t)
      );
    }
    return rows;
  } catch (e) {
    console.warn('listarCiclos: vista no disponible, usando tabla base. Detalle:', e?.message);
  }
  // 2) Tabla base
  const { data, error } = await supabase
    .from('ciclos')
    .select('id, nombre, version, grado, estado, updated_at')
    .order('updated_at', { ascending: false });
  throwIf(error);
  let rows = data || [];
  if (filtro) {
    const t = filtro.toLowerCase();
    rows = rows.filter(r =>
      (r.nombre || '').toLowerCase().includes(t) ||
      String(r.grado ?? '').toLowerCase().includes(t) ||
      String(r.estado ?? '').toLowerCase().includes(t)
    );
  }
  return rows.map(r => ({ ...r, juegos_count: r.juegos_count ?? '-' }));
}
