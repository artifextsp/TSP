// js/api-ciclos.js
import * as SB from './supabaseClient.js';
const supabase = SB.supabase ?? SB.default ?? SB;

const toInt = (g) => Number.parseInt(String(g), 10);
const okOrThrow = (error) => { if (error) throw error; };

export async function listarLecturas(grado) {
  const { data, error } = await supabase.rpc('admin_listar_lecturas', { p_grado: toInt(grado) });
  okOrThrow(error); return data || [];
}

export async function listarDesafios(grado) {
  const { data, error } = await supabase.rpc('admin_listar_desafios', { p_grado: toInt(grado) });
  okOrThrow(error); return data || [];
}

/* ← Simplificado: ahora la RPC de juegos recibe SOLO p_grado (INT) */
export async function listarJuegos(grado) {
  const { data, error } = await supabase.rpc('admin_listar_juegos', { p_grado: toInt(grado) });
  okOrThrow(error); return data || [];
}

export async function crearCiclo({ grado, nombre, descripcion, lecturaId, desafioId, juegosIds }) {
  const { data, error } = await supabase.rpc('admin_ciclo_crear', {
    p_grado: toInt(grado),
    p_nombre: nombre,
    p_descripcion: descripcion || '',
    p_lectura_id: lecturaId,
    p_desafio_id: desafioId,
    p_juegos: juegosIds
  });
  okOrThrow(error); return data;
}

export async function publicarCiclo(cicloId) {
  const { error } = await supabase.rpc('admin_ciclo_publicar', { p_ciclo_id: cicloId });
  okOrThrow(error); return true;
}

export async function duplicarCiclo(cicloId) {
  const { data, error } = await supabase.rpc('admin_ciclo_duplicar', { p_ciclo_id: cicloId });
  okOrThrow(error); return data;
}

export async function listarCiclos({ filtro = '' } = {}) {
  let q = supabase.from('v_ciclos_listado').select('*').order('updated_at', { ascending: false });
  if (filtro && filtro.trim()) {
    const f = filtro.trim();
    q = q.or(`nombre.ilike.%${f}%,estado.ilike.%${f}%`);
  }
  const { data, error } = await q; okOrThrow(error); return data || [];
}
