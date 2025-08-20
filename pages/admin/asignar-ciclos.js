import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const supabase = createClient(window.__TSP__.SUPABASE_URL, window.__TSP__.SUPABASE_ANON_KEY);
const $ = (q)=>document.querySelector(q);

function msg(t, ok=false){ const el=$("#msg"); el.textContent=t; el.style.color=ok?"#166534":"#6b7280"; }
function table(headers, rows){
  return `<table style="width:100%;border-collapse:collapse">
    <thead><tr>${headers.map(h=>`<th style="text-align:left;border-bottom:1px solid #e6e6e6;padding:8px">${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td style="border-bottom:1px solid #e6e6e6;padding:8px">${c??""}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

async function loadInstituciones(){
  const { data, error } = await supabase.from("instituciones").select("id,nombre,activo").order("nombre");
  if (error) return;
  $("#inst").innerHTML = `<option value="">Seleccionar…</option>` + data.map(i=>`<option value="${i.id}">${i.nombre}${i.activo?"":" (inactiva)"}</option>`).join("");
}
async function loadGrupos(instId){
  const cont = $("#grupos"); cont.innerHTML = "";
  if (!instId) return;
  const { data, error } = await supabase.from("grupos").select("id,nombre,grado,seccion,activo").eq("institucion_id", instId).order("grado");
  if (error) return;
  cont.innerHTML = data.map(g=>`
    <label class="item">
      <input type="checkbox" value="${g.id}"> <strong>${g.nombre}</strong><br>
      <span class="muted">G${g.grado}${g.seccion?("-"+g.seccion):""}${g.activo?"":" • inactivo"}</span>
    </label>
  `).join("");
}
async function loadCiclos(preselectId=null){
  const { data, error } = await supabase.from("ciclos").select("id,nombre,numero_ciclo,grado_objetivo,activo").order("created_at",{ascending:false});
  if (error) return;
  $("#ciclo").innerHTML = `<option value="">Seleccionar…</option>` + data.map(c=>`
    <option value="${c.id}" ${preselectId&&preselectId===c.id?"selected":""}>
      ${c.nombre} (C${c.numero_ciclo} • G${c.grado_objetivo})${c.activo?"":" [inactivo]"}
    </option>`).join("");
}
async function loadAsignaciones(){
  const { data, error } = await supabase.from("asignaciones_ciclos")
    .select("id,fecha_asignacion,activo,periodicidad,dia_semana,ciclos(nombre),grupos(nombre)")
    .order("created_at",{ascending:false}).limit(50);
  if (error) return;
  $("#tabla").innerHTML = table(
    ["Ciclo","Grupo","Inicio","Periodicidad","Día","Estado"],
    data.map(a=>[
      a.ciclos?.nombre || "—",
      a.grupos?.nombre || "—",
      a.fecha_asignacion || "—",
      a.periodicidad || "—",
      a.dia_semana ?? "—",
      a.activo ? "Activa" : "Inactiva"
    ])
  );
}

$("#inst").addEventListener("change", async ()=>{ await loadGrupos($("#inst").value); });

$("#btnAsignar").addEventListener("click", async ()=>{
  try{
    const inst = $("#inst").value;
    const ciclo = $("#ciclo").value;
    const inicio = $("#inicio").value;
    const periodicidad = $("#periodicidad").value.trim() || null;
    const dia = $("#dia").value ? Number($("#dia").value) : null;
    const gruposSel = Array.from(document.querySelectorAll("#grupos input[type=checkbox]:checked")).map(x=>x.value);

    if (!inst) return msg("Selecciona una institución.");
    if (!ciclo || !inicio) return msg("Ciclo y fecha de inicio son obligatorios.");
    if (!gruposSel.length) return msg("Selecciona al menos un grupo.");

    const rows = gruposSel.map(gid=>({
      ciclo_id: ciclo,
      grupo_id: gid,
      fecha_asignacion: inicio,
      periodicidad: periodicidad,
      dia_semana: dia,
      activo: true
    }));

    const { error } = await supabase.from("asignaciones_ciclos").insert(rows);
    if (error) throw error;
    msg(`Asignación creada para ${rows.length} grupo(s).`, true);
    await loadAsignaciones();
  }catch(e){ msg(e.message); }
});

// Preselección de ciclo por ?ciclo=uuid
const pre = new URLSearchParams(location.search).get("ciclo") || null;

(async function init(){
  await loadInstituciones();
  await loadCiclos(pre);
  await loadAsignaciones();
})();
