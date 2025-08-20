import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const supabase = createClient(window.__TSP__.SUPABASE_URL, window.__TSP__.SUPABASE_ANON_KEY);
const $ = (q)=>document.querySelector(q);

const plantillaMLC = () => ({
  metas: { wpm: 120, comprension: 70, ve: 80 },
  secuencia: [
    { semana:1, sesiones:["vocabulario","lectura"] },
    { semana:2, sesiones:["test","comprension"] },
    { semana:3, sesiones:["vocabulario","lectura"] },
    { semana:4, sesiones:["test","comprension"] }
  ]
});

function setMsg(t, ok=false){ const el=$("#msg"); el.textContent=t; el.style.color= ok ? "#166534":"#6b7280"; }

$("#btnPlantillaMLC").addEventListener("click", ()=>{
  $("#json").value = JSON.stringify(plantillaMLC(), null, 2);
});

$("#btnValidar").addEventListener("click", ()=>{
  try{
    const obj = JSON.parse($("#json").value || "{}");
    if (!obj.secuencia || !Array.isArray(obj.secuencia)) throw new Error("Debe incluir 'secuencia' como arreglo.");
    setMsg("JSON válido ✔️", true);
  }catch(e){ setMsg("JSON inválido: "+e.message); }
});

$("#btnGuardar").addEventListener("click", async ()=>{
  try{
    const ciclo = {
      nombre: $("#nombre").value.trim(),
      numero_ciclo: Number($("#num").value),
      grado_objetivo: Number($("#grado").value),
      duracion_semanas: Number($("#semanas").value),
      sesiones_por_semana: Number($("#sesxsem").value),
      tipo: $("#tipo").value,
      parametros: JSON.parse($("#json").value || "{}"),
      activo: true
    };
    if (!ciclo.nombre || !ciclo.numero_ciclo || !ciclo.grado_objetivo) throw new Error("Nombre, número de ciclo y grado son obligatorios.");
    const { error } = await supabase.from("ciclos").insert(ciclo);
    if (error) throw error;
    setMsg("Ciclo guardado.", true);
    await cargarTabla();
  }catch(e){ setMsg(e.message); }
});

$("#btnRefrescar").addEventListener("click", cargarTabla);
$("#filtro").addEventListener("input", cargarTabla);

function tabla(headers, rows){
  return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${
    rows.map(r=>`<tr>${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join("")
  }</tbody></table>`;
}

async function cargarTabla(){
  const f = ($("#filtro").value||"").trim();
  let q = supabase.from("ciclos").select("id,nombre,tipo,grado_objetivo,numero_ciclo,activo");
  if (f) q = q.or(`nombre.ilike.%${f}%,tipo.ilike.%${f}%`);
  const { data, error } = await q.order("created_at", { ascending:false }).limit(200);
  if (error){ console.error(error); return; }
  $("#tabla").innerHTML = tabla(
    ["Ciclo","Tipo/Grado","Estado","Acciones"],
    data.map(c=>[
      `<strong>${c.nombre}</strong><br><span class="muted">C${c.numero_ciclo} • G${c.grado_objetivo}</span>`,
      `${c.tipo||"—"} / G${c.grado_objetivo}`,
      c.activo?`<span class="chip">Activo</span>`:`<span class="chip">Inactivo</span>`,
      `
      <button class="btn btn-soft" data-act="editar" data-id="${c.id}">Editar</button>
      <button class="btn btn-soft" data-act="estado" data-id="${c.id}" data-on="${c.activo?1:0}">${c.activo?"Desactivar":"Activar"}</button>
      <a class="btn btn-primary" href="/pages/admin/asignar-ciclos.html?ciclo=${c.id}">Asignar</a>
      `
    ])
  );

  // acciones
  $("#tabla").querySelectorAll("[data-act='estado']").forEach(b=>{
    b.onclick = async ()=>{
      await supabase.from("ciclos").update({ activo: !(b.dataset.on==="1") }).eq("id", b.dataset.id);
      cargarTabla();
    };
  });
  $("#tabla").querySelectorAll("[data-act='editar']").forEach(b=>{
    b.onclick = async ()=>{
      const { data, error } = await supabase.from("ciclos").select("*").eq("id", b.dataset.id).single();
      if (error) return;
      $("#nombre").value = data.nombre || "";
      $("#num").value = data.numero_ciclo || "";
      $("#grado").value = data.grado_objetivo || "";
      $("#semanas").value = data.duracion_semanas || "";
      $("#sesxsem").value = data.sesiones_por_semana || "";
      $("#tipo").value = data.tipo || "MLC";
      $("#json").value = JSON.stringify(data.parametros||{}, null, 2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setMsg("Editando ciclo: " + data.nombre);
    };
  });
}

cargarTabla();
