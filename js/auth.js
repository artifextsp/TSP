// ./js/auth.js  (versión ESM)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

console.log("auth.js v3 – usando RPC /rest/v1/rpc/user_login_code");

const CFG = window.__TSP__ || {};
if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
  alert("Falta configuración de Supabase."); throw new Error("Missing Supabase config");
}

const supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

const $ = (q)=>document.querySelector(q);
const input = $("#code") || $("#code-input") || document.querySelector('input[name="code"]');
const btn   = $("#btnLogin") || document.querySelector("#code-form button[type=submit]");
const msgEl = $("#msg") || $("#code-error");

function showMsg(t){ if(msgEl){ msgEl.textContent=t; msgEl.style.display="block"; } }
function hideMsg(){ if(msgEl) msgEl.style.display="none"; }

function norm(v){ v=(v||"").trim().toUpperCase(); return /^[A-Z]{2}\d{4}$/.test(v)?v:null; }

async function doLogin(e){
  e?.preventDefault();
  hideMsg();

  const code = norm(input.value);
  if (!code){ showMsg("Formato inválido. Debe ser 2 letras + 4 números (AA9999)."); return; }

  try{
    // ✅ RPC correcto: /rest/v1/rpc/user_login_code
    const { data, error } = await supabase.rpc("user_login_code", { code });
    if (error) throw error;
    if (!data || !data.ok) throw new Error(data?.error || "Código no válido o inactivo.");

    const session = {
      token: crypto.randomUUID(),
      user_id: data.user_id,
      perfil: data.perfil,
      nombres: data.nombres,
      institucion_id: data.institucion_id,
      grupo_id: data.grupo_id,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (8*60*60*1000)
    };
    localStorage.setItem("tsp_user_session", JSON.stringify(session));

    let dest = "/pages/dashboard-estudiante.html";
    window.location.href = dest;
    if (data.perfil === "docente") dest = "/pages/teacher/dashboard-docente.html";
    if (data.perfil === "rector")  dest = "/pages/rector/dashboard-rector.html";
    window.location.href = dest;

  }catch(err){
    console.error("[login error]", err);
    showMsg("Hubo un error al iniciar sesión. Intenta nuevamente.");
  }
}

btn?.addEventListener("click", doLogin);
document.querySelector("#code-form")?.addEventListener("submit", doLogin);
input?.addEventListener("keydown", (e)=>{ if (e.key==="Enter") doLogin(e); });
