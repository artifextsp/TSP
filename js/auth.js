// /js/auth.js — LOGIN PÚBLICO (Estudiante / Docente / Rector / Padre)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const PASS_RE  = /^[A-Z]{2}[0-9]{4}$/;   // AA9999

// ==== Utilidades ====
const setMsg = (el, txt) => { if (el) el.textContent = txt || ''; };
const setBusy = (btn, busy) => { if (btn) { btn.disabled = !!busy; btn.dataset.loading = busy ? '1' : ''; } };

function normalizeProfile(row = {}) {
  return {
    id:             row.id || row.user_id || row.uid || null,
    rol:            row.rol || row.perfil || 'estudiante',
    nombres:        row.nombres || row.name || '',
    apellidos:      row.apellidos || row.lastname || '',
    institucion_id: row.institucion_id || row.school_id || null,
    grupo_id:       row.grupo_id || row.group_id || null,
  };
}
function setSession(profile, rememberChecked) {
  const ttlMs = rememberChecked ? (8 * 60 * 60 * 1000) : (30 * 60 * 1000);
  const payload = { ...profile, login_at: new Date().toISOString(), exp: Date.now() + ttlMs };
  localStorage.setItem('tsp_user_session', JSON.stringify(payload));
}
function goToDashboard(rol = 'estudiante') {
  const map = {
    estudiante: 'pages/dashboard-estudiante.html',
    docente:    'pages/dashboard-docente.html',
    rector:     'pages/dashboard-rector.html',
    padre:      'pages/dashboard-padres.html',
  };
  const rel = map[rol] || map.estudiante;
  window.location.href = new URL(rel, window.location.href).href; // única redirección
}

// ==== RPC con fallback ====
async function callLoginRPC(code) {
  // 1) Intento: auth_login_password(p_password := code)
  let { data, error } = await supabase.rpc('auth_login_password', { p_password: code });
  if (!error && data) return { data };

  // Si es 404 o “no existe la función”, probamos con user_login_code(p_code)
  const msg = (error?.message || '').toLowerCase();
  const looks404 = msg.includes('404') || msg.includes('not found') || msg.includes('route') || msg.includes('function');

  if (looks404) {
    ({ data, error } = await supabase.rpc('user_login_code', { p_code: code }));
    return { data, error };
  }
  return { data, error };
}

// ==== Arranque cuando el DOM está listo ====
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#login-form');
  const input = document.querySelector('#pw') || document.querySelector('#code') || document.querySelector('input[name="code"]');
  const msg = document.querySelector('#msg');
  const remember = document.querySelector('#remember') || document.querySelector('#rememberMe');
  const btn = document.querySelector('#btnLogin') || form?.querySelector('button[type="submit"]');

  if (!form || !input) return;

  // Autorelleno desde ?code=
  try {
    const qsCode = new URLSearchParams(location.search).get('code');
    if (qsCode) input.value = qsCode.toUpperCase();
  } catch {}

  // Autologin si hay sesión vigente
  try {
    const raw = localStorage.getItem('tsp_user_session');
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess?.exp && Date.now() < Number(sess.exp)) {
        goToDashboard(sess.rol || 'estudiante');
        return;
      } else {
        localStorage.removeItem('tsp_user_session');
      }
    }
  } catch {}

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMsg(msg, '');
    const code = (input.value || '').trim().toUpperCase();

    if (!PASS_RE.test(code)) {
      setMsg(msg, 'Formato inválido. Usa AA9999 (dos letras + cuatro números).');
      return;
    }

    setBusy(btn, true);
    try {
      const { data, error } = await callLoginRPC(code);

      if (error) {
        const em = (error.message || '').toUpperCase();
        if (em.includes('BLOQUE')) setMsg(msg, 'Usuario bloqueado temporalmente.');
        else if (em.includes('NOT FOUND') || em.includes('404'))
          setMsg(msg, 'RPC de login no encontrado (verifica el nombre en Supabase).');
        else setMsg(msg, 'Credenciales inválidas o usuario inactivo.');
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { setMsg(msg, 'Credenciales inválidas.'); return; }

      const profile = normalizeProfile(row);
      setSession(profile, !!(remember && remember.checked));
      goToDashboard(profile.rol);
    } catch (err) {
      console.error(err);
      setMsg(msg, 'Error de red o servidor. Intenta nuevamente.');
    } finally {
      setBusy(btn, false);
    }
  });
});
