// /pages/admin/admin-login.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const $ = (q)=>document.querySelector(q);
const msg = $("#msg");

const SESSION_KEY  = "tsp_admin_session";
const REMEMBER_KEY = "tsp_admin_remember";

// Limpia sesión si viene ?logout=1 (útil para pruebas)
const params = new URLSearchParams(location.search);
if (params.get("logout") === "1") {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}

// Validación de config
const CFG = window.__TSP__ || {};
if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
  showError("Falta configuración de Supabase en esta página.");
  throw new Error("Missing Supabase config");
}
const supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

function showError(t){ msg.textContent = t; msg.style.display = "block"; }
function normalizeCode(v){
  v = (v||"").trim().toUpperCase();
  return /^[A-Z]{2}\d{4}$/.test(v) ? v : null;
}
function getSession(){
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)||"null"); } catch { return null; }
}

// Auto-ingreso SOLO si el usuario eligió “Recordarme”
(function autoLogin(){
  const remember = localStorage.getItem(REMEMBER_KEY) === "1";
  if (!remember) return;                       // <= clave
  const s = getSession();
  if (s && s.expiresAt && Date.now() < s.expiresAt) {
    window.location.replace("/pages/admin/admin-dashboard.html");
  }
})();

async function login(){
  msg.style.display = "none";
  const code = normalizeCode($("#adminCode").value);
  if (!code){ return showError("Formato inválido. Debe ser 2 letras + 4 números. Ej: AB1234"); }

  try{
    const { data, error } = await supabase.rpc("auth_login_code", { code });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data?.error || "Código no válido o inactivo.");

    const remember = $("#remember").checked;
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");

    const ttl = remember ? (8*60*60*1000) : (30*60*1000); // 8h vs 30m
    const session = {
      token: crypto.randomUUID(),
      admin_id: data.admin_id,
      nombres: data.nombres || "Administrador",
      issuedAt: Date.now(),
      expiresAt: Date.now() + ttl
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.location.href = "/pages/admin/admin-dashboard.html";
  }catch(e){
    console.error(e);
    showError(e.message || "No se pudo iniciar sesión.");
  }
}

// Botón “Cambiar de cuenta”: limpia sesión y se queda en login
$("#switchAccount").addEventListener("click", (e)=>{
  e.preventDefault();
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  msg.style.display = "none";
  $("#adminCode").focus();
});

// Eventos
$("#btnLogin").addEventListener("click", login);
$("#adminCode").addEventListener("keydown", (e)=>{ if (e.key==="Enter") login(); });
