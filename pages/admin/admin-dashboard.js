// /pages/admin/admin-dashboard.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const CFG = window.__TSP__ || {};
if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
  alert("Falta configuración de Supabase en admin-dashboard.html"); throw new Error("Missing Supabase config");
}
const supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

/* ========= Sesión Admin ========= */
function getSession(){
  try { return JSON.parse(localStorage.getItem("tsp_admin_session")||"null"); } catch { return null; }
}
function requireSession(){
  const s = getSession();
  if (!s || !s.expiresAt || Date.now() > s.expiresAt){
    window.location.replace("/pages/admin/admin-login.html"); return null;
  }
  $("#adminName").textContent = `• ${s.nombres}`;
  return s;
}
const session = requireSession();
$("#btnLogout").addEventListener("click", ()=>{ localStorage.removeItem("tsp_admin_session"); window.location.href="/pages/admin/admin-login.html"; });

/* ========= Navegación ========= */

$$(".nav-item").forEach(a => a.addEventListener("click", (e) => {
  const view = a.dataset.view;
  if (!view) return;               // si no tiene data-view es un enlace real (p. ej. ./ciclos.html)
  e.preventDefault();
  $$(".nav-item").forEach(n => n.classList.remove("active"));
  a.classList.add("active");
  $$(".section").forEach(s => s.classList.remove("active"));
  $("#view-" + view).classList.add("active");
}));


/* ========= Helpers UI ========= */
function tableFromRows(headers, rows){
  const thead = `<thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join("")}</tbody>`;
  return `<table class="table">${thead}${tbody}</table>`;
}
function setMsg(el, text, ok=false){ el.textContent=text; el.style.color = ok? "#166534" : "#6b7280"; }

/* ========= Catálogos ========= */
async function loadInstitucionesTo(selects){
  const { data, error } = await supabase.from("instituciones").select("id,nombre,activo").order("nombre");
  if (error) throw error;
  selects.forEach(sel=>{
    sel.innerHTML = `<option value="">Seleccionar…</option>` + data.map(i=>`<option value="${i.id}">${i.nombre}${i.activo?"":" (inactiva)"}</option>`).join("");
  });
  return data;
}
async function loadGruposByInst(instId, sel){
  if (!instId){ sel.innerHTML = `<option value="">Seleccionar…</option>`; return []; }
  const { data, error } = await supabase.from("grupos").select("id,nombre,grado,seccion,activo").eq("institucion_id", instId).order("grado");
  if (error) throw error;
  sel.innerHTML = `<option value="">Seleccionar…</option>` + data.map(g=>`<option value="${g.id}">${g.nombre} — G${g.grado}${g.seccion?("-"+g.seccion):""}${g.activo?"":" (inactivo)"}</option>`).join("");
  return data;
}
async function loadEstudiantesByGrupo(grupoId, sel){
  if (!grupoId){ sel.innerHTML = `<option value="">Seleccionar…</option>`; return []; }
  const { data, error } = await supabase.from("usuarios").select("id,nombres,apellidos").eq("grupo_id", grupoId).eq("perfil","estudiante").order("apellidos");
  if (error) throw error;
  sel.innerHTML = `<option value="">Seleccionar…</option>` + data.map(u=>`<option value="${u.id}">${u.apellidos}, ${u.nombres}</option>`).join("");
  return data;
}
async function loadCiclos(sel){
  const { data, error } = await supabase.from("ciclos").select("id,numero_ciclo,grado_objetivo,activo").order("numero_ciclo");
  if (error) throw error;
  sel.innerHTML = `<option value="">Seleccionar…</option>` + data.map(c=>`<option value="${c.id}">Ciclo ${c.numero_ciclo}${c.grado_objetivo?` • G${c.grado_objetivo}`:""}${c.activo?"":" (inactivo)"}</option>`).join("");
  return data;
}

/* ========= INSTITUCIONES ========= */
async function reloadInstituciones(){
  const f = ($("#instFilter").value||"").toLowerCase();
  const { data, error } = await supabase.from("instituciones")
    .select("id,nombre,codigo,email,telefono,activo").ilike("nombre", `%${f}%`).order("nombre");
  if (error){ console.error(error); return; }
  const rows = data.map(i=>[
    `<strong>${i.nombre}</strong><br><span class="muted">${i.codigo??""}</span>`,
    i.email??"—",
    i.telefono??"—",
    i.activo?`<span class="chip">Activa</span>`:`<span class="chip">Bloqueada</span>`,
    `<button class="btn btn-secondary btn-sm" data-act="toggle-inst" data-id="${i.id}" data-on="${i.activo?1:0}">${i.activo?"Bloquear":"Activar"}</button>`
  ]);
  $("#instTable").innerHTML = tableFromRows(["Institución","Email","Teléfono","Estado","Acciones"], rows);
  $("#instTable").querySelectorAll("[data-act='toggle-inst']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await supabase.from("instituciones").update({ activo: !(btn.dataset.on==="1") }).eq("id", btn.dataset.id);
      reloadInstituciones();
    });
  });
}
$("#btnCrearInst").addEventListener("click", async ()=>{
  try{
    const payload = {
      nombre: $("#instNombre").value.trim(),
      codigo: $("#instCodigo").value.trim(),
      email: $("#instEmail").value.trim() || null,
      telefono: $("#instTelefono").value.trim() || null,
      direccion: $("#instDireccion").value.trim() || null,
      activo: true
    };
    if (!payload.nombre || !payload.codigo) return setMsg($("#instMsg"), "Nombre y código son obligatorios.");
    const { error } = await supabase.from("instituciones").insert(payload);
    if (error) throw error;
    setMsg($("#instMsg"), "Institución creada.", true);
    await loadInstitucionesTo([$("#grupoInst"), $("#grupoInstFilter"), $("#usrInst"), $("#asigInst")]);
    reloadInstituciones();
  }catch(e){ setMsg($("#instMsg"), e.message); }
});
$("#btnReloadInst").addEventListener("click", reloadInstituciones);
$("#instFilter").addEventListener("input", reloadInstituciones);

/* ========= GRUPOS ========= */
async function reloadGrupos(){
  const inst = $("#grupoInstFilter").value;
  let q = supabase.from("grupos").select("id,nombre,grado,seccion,activo, instituciones(nombre)");
  if (inst) q = q.eq("institucion_id", inst);
  const { data, error } = await q.order("grado");
  if (error){ console.error(error); return; }
  const rows = data.map(g=>[
    `<strong>${g.nombre}</strong><br><span class="muted">G${g.grado}${g.seccion?("-"+g.seccion):""}</span>`,
    g.instituciones?.nombre || "—",
    g.activo?`<span class="chip">Activo</span>`:`<span class="chip">Bloqueado</span>`,
    `<button class="btn btn-secondary btn-sm" data-act="toggle-grupo" data-id="${g.id}" data-on="${g.activo?1:0}">${g.activo?"Bloquear":"Activar"}</button>`
  ]);
  $("#gruposTable").innerHTML = tableFromRows(["Grupo","Institución","Estado","Acciones"], rows);
  $("#gruposTable").querySelectorAll("[data-act='toggle-grupo']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await supabase.from("grupos").update({ activo: !(btn.dataset.on==="1") }).eq("id", btn.dataset.id);
      reloadGrupos();
    });
  });
}
$("#btnCrearGrupo").addEventListener("click", async ()=>{
  try{
    const payload = {
      institucion_id: $("#grupoInst").value || null,
      nombre: $("#grupoNombre").value.trim(),
      grado: Number($("#grupoGrado").value),
      seccion: $("#grupoSeccion").value.trim() || null,
      activo: true
    };
    if (!payload.institucion_id || !payload.nombre || !payload.grado) return setMsg($("#grupoMsg"), "Institución, nombre y grado son obligatorios.");
    const { error } = await supabase.from("grupos").insert(payload);
    if (error) throw error;
    setMsg($("#grupoMsg"), "Grupo creado.", true);
    reloadGrupos();
  }catch(e){ setMsg($("#grupoMsg"), e.message); }
});
$("#btnReloadGrupos").addEventListener("click", reloadGrupos);
$("#grupoInstFilter").addEventListener("change", reloadGrupos);

/* ========= USUARIOS ========= */
async function reloadUsuarios(){
  const term = $("#usrFilter").value || "";
  const rol = $("#usrRolFilter").value || "";
  let q = supabase.from("usuarios")
    .select("id,codigo_estudiante,nombres,apellidos,perfil,activo,bloqueado, grupos(nombre), instituciones(nombre)")
    .order("apellidos");
  if (term) q = q.or(`nombres.ilike.%${term}%,apellidos.ilike.%${term}%,codigo_estudiante.ilike.%${term}%`);
  if (rol) q = q.eq("perfil", rol);
  const { data, error } = await q;
  if (error){ console.error(error); return; }
  const rows = data.map(u=>[
    `<strong>${u.apellidos}, ${u.nombres}</strong><br><span class="muted">${u.codigo_estudiante || "—"}</span>`,
    u.perfil,
    u.instituciones?.nombre || "—",
    u.grupos?.nombre || "—",
    u.bloqueado?`<span class="chip">Bloqueado</span>`:(u.activo?`<span class="chip">Activo</span>`:`<span class="chip">Inactivo</span>`),
    `<button class="btn btn-secondary btn-sm" data-act="toggle-usr" data-id="${u.id}" data-on="${u.bloqueado?1:0}">${u.bloqueado?"Desbloquear":"Bloquear"}</button>`
  ]);
  $("#usuariosTable").innerHTML = tableFromRows(["Usuario","Rol","Institución","Grupo","Estado","Acciones"], rows);
  $("#usuariosTable").querySelectorAll("[data-act='toggle-usr']").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      await supabase.from("usuarios").update({ bloqueado: !(btn.dataset.on==="1") }).eq("id", btn.dataset.id);
      reloadUsuarios();
    });
  });
}
$("#btnCrearUsuario").addEventListener("click", async ()=>{
  try{
    const payload = {
      perfil: $("#usrRol").value,
      nombres: $("#usrNombres").value.trim(),
      apellidos: $("#usrApellidos").value.trim(),
      institucion_id: $("#usrInst").value || null,
      grupo_id: $("#usrGrupo").value || null,
      email: $("#usrEmail").value.trim() || null,
      telefono: $("#usrTel").value.trim() || null,
      activo: true, bloqueado: false
    };
    if (!payload.perfil || !payload.nombres || !payload.apellidos || !payload.institucion_id)
      return setMsg($("#usrMsg"), "Rol, nombres, apellidos e institución son obligatorios.");
    const { error } = await supabase.from("usuarios").insert(payload);
    if (error) throw error;
    setMsg($("#usrMsg"), "Usuario creado.", true);
    reloadUsuarios();
  }catch(e){ setMsg($("#usrMsg"), e.message); }
});
$("#usrInst").addEventListener("change", async ()=>{ await loadGruposByInst($("#usrInst").value, $("#usrGrupo")); });
$("#btnReloadUsuarios").addEventListener("click", reloadUsuarios);
$("#usrFilter").addEventListener("input", reloadUsuarios);
$("#usrRolFilter").addEventListener("change", reloadUsuarios);

/* ========= Buscador ========= */
$("#btnBuscar").addEventListener("click", doSearch);
async function doSearch(){
  const term = ($("#q").value||"").trim();
  const rol  = $("#qRol").value || "";
  $("#searchSummary").textContent = "Buscando…";
  const [inst,grupos,usuarios] = await Promise.all([
    supabase.from("instituciones").select("id,nombre,codigo,activo").ilike("nombre", `%${term}%`),
    supabase.from("grupos").select("id,nombre,grado,seccion,activo").ilike("nombre", `%${term}%`),
    (async()=>{let q=supabase.from("usuarios").select("id,nombres,apellidos,perfil,activo,bloqueado"); if(term) q=q.or(`nombres.ilike.%${term}%,apellidos.ilike.%${term}%`); if(rol) q=q.eq("perfil",rol); return q;})()
  ]);
  $("#searchSummary").textContent = "Resultados:";
  const blocks=[];
  if(!inst.error) blocks.push(`<h4>Instituciones (${inst.data.length})</h4>${tableFromRows(["Nombre","Código","Estado"],inst.data.map(i=>[`<strong>${i.nombre}</strong>`,i.codigo,i.activo?`<span class="chip">Activa</span>`:`<span class="chip">Bloqueada</span>`]))}`);
  if(!grupos.error) blocks.push(`<h4>Grupos (${grupos.data.length})</h4>${tableFromRows(["Grupo","Grado/Sección","Estado"],grupos.data.map(g=>[`<strong>${g.nombre}</strong>`,`G${g.grado}${g.seccion?("-"+g.seccion):""}`,g.activo?`<span class="chip">Activo</span>`:`<span class="chip">Bloqueado</span>`]))}`);
  if(!usuarios.error) blocks.push(`<h4>Usuarios (${usuarios.data.length})</h4>${tableFromRows(["Nombre","Rol","Estado"],usuarios.data.map(u=>[`<strong>${u.apellidos}, ${u.nombres}</strong>`,u.perfil,u.bloqueado?`<span class="chip">Bloqueado</span>`:(u.activo?`<span class="chip">Activo</span>`:`<span class="chip">Inactivo</span>`)]))}`);
  $("#searchResults").innerHTML = blocks.join("<br>");
}

/* ========= Asignaciones ========= */
$("#asigScope").addEventListener("change", ()=>{
  const s = $("#asigScope").value;
  $("#wrapAsigGrupo").style.display = s==="grupo" ? "" : "none";
  $("#wrapAsigEst").style.display   = s==="estudiante" ? "" : "none";
});
$("#asigInst").addEventListener("change", async ()=>{
  await loadGruposByInst($("#asigInst").value, $("#asigGrupo"));
  $("#asigEst").innerHTML = `<option value="">Seleccionar…</option>`;
});
$("#asigGrupo").addEventListener("change", async ()=>{
  await loadEstudiantesByGrupo($("#asigGrupo").value, $("#asigEst"));
});
async function reloadAsignaciones(){
  const { data, error } = await supabase.from("asignaciones_ciclos")
    .select("id,fecha_asignacion,periodicidad,dia_semana,activo, grupos(nombre), usuarios(nombres,apellidos), ciclos(numero_ciclo)")
    .order("created_at",{ascending:false}).limit(50);
  if (error){ console.error(error); return; }
  const rows = data.map(a=>[
    a.ciclos?`Ciclo ${a.ciclos.numero_ciclo}`:"—",
    a.grupos?.nombre || (a.usuarios?`${a.usuarios.apellidos}, ${a.usuarios.nombres}`:"—"),
    a.fecha_asignacion || "—",
    a.periodicidad || "—",
    (a.dia_semana ?? "—"),
    a.activo?`<span class="chip">Activa</span>`:`<span class="chip">Inactiva</span>`
  ]);
  $("#asigTable").innerHTML = tableFromRows(["Ciclo","Destino","Inicio","Periodicidad","Día","Estado"], rows);
}
$("#btnAsignar").addEventListener("click", async ()=>{
  try{
    const scope = $("#asigScope").value;
    const payload = {
      ciclo_id: $("#asigCiclo").value || null,
      grupo_id: scope==="grupo" ? ($("#asigGrupo").value || null) : null,
      estudiante_id: scope==="estudiante" ? ($("#asigEst").value || null) : null,
      fecha_asignacion: $("#asigInicio").value || null,
      periodicidad: $("#asigPeriodicidad").value.trim() || null,
      dia_semana: $("#asigDia").value ? Number($("#asigDia").value) : null,
      activo: true
    };
    if (!payload.ciclo_id || (!payload.grupo_id && !payload.estudiante_id) || !payload.fecha_asignacion)
      return setMsg($("#asigMsg"), "Ciclo, destino y fecha de inicio son obligatorios.");
    const { error } = await supabase.from("asignaciones_ciclos").insert(payload);
    if (error) throw error;
    setMsg($("#asigMsg"), "Asignación creada.", true);
    reloadAsignaciones();
  }catch(e){ setMsg($("#asigMsg"), e.message); }
});

/* ========= Informes CSV ========= */
function toCSV(rows){ if(!rows.length) return ""; const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`; const header=Object.keys(rows[0]).map(esc).join(","); const body=rows.map(r=>Object.values(r).map(esc).join(",")).join("\n"); return header+"\n"+body; }
function downloadFile(name, content, mime="text/csv"){ const blob=new Blob([content],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); }
$("#btnDescargarCSV").addEventListener("click", async ()=>{
  const tipo=$("#repEntidad").value, id=$("#repId").value.trim(), desde=$("#repDesde").value, hasta=$("#repHasta").value;
  if (!id || !desde || !hasta) { alert("ID, desde y hasta son obligatorios."); return; }
  if (tipo==="estudiante"){
    const { data, error } = await supabase.from("resultados_mlc")
      .select("session_date,palabras_por_minuto,porcentaje_comprension,velocidad_efectiva,aciertos_tc,total_preguntas_tc")
      .eq("estudiante_id", id).gte("session_date", desde).lte("session_date", hasta).order("session_date");
    if (error){ alert(error.message); return; }
    if (!data.length){ alert("Sin datos en el rango indicado."); return; }
    downloadFile(`tsp_est_${id}_${desde}_a_${hasta}.csv`, toCSV(data));
  } else {
    const { data: ests, error: e1 } = await supabase.from("usuarios").select("id").eq("grupo_id", id).eq("perfil","estudiante");
    if (e1){ alert(e1.message); return; }
    const ids = (ests||[]).map(e=>e.id); if (!ids.length){ alert("No hay estudiantes en el grupo."); return; }
    const { data, error } = await supabase.from("resultados_mlc")
      .select("estudiante_id,session_date,palabras_por_minuto,porcentaje_comprension,velocidad_efectiva,aciertos_tc,total_preguntas_tc")
      .in("estudiante_id", ids).gte("session_date", desde).lte("session_date", hasta).order("session_date");
    if (error){ alert(error.message); return; }
    if (!data.length){ alert("Sin datos en el rango indicado."); return; }
    downloadFile(`tsp_grupo_${id}_${desde}_a_${hasta}.csv`, toCSV(data));
  }
});

/* ========= Init ========= */
(async function init(){
  await loadInstitucionesTo([$("#grupoInst"), $("#grupoInstFilter"), $("#usrInst"), $("#asigInst")]);
  $("#grupoInstFilter").dispatchEvent(new Event("change"));
  await loadCiclos($("#asigCiclo"));
  await reloadInstituciones();
  await reloadGrupos();
  await reloadUsuarios();
  await reloadAsignaciones();
})();
