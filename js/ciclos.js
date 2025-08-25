// js/ciclos.js
import {
  listarLecturas, listarDesafios, listarJuegos,
  crearCiclo, publicarCiclo, listarCiclos, duplicarCiclo
} from './api-ciclos.js';

/* ====== Guard Admin ====== */
(function ensureAdmin() {
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const sA = read('tsp_admin_session'); const sU = read('tsp_user_session');
  const role = String(sA?.rol ?? sA?.role ?? sA?.perfil ?? sU?.rol ?? sU?.role ?? sU?.perfil ?? '').toLowerCase();
  const isAdmin = (role === 'admin') || (sA?.is_admin === true) || (sU?.is_admin === true);
  if (!isAdmin) { alert('Acceso solo para Administrador.'); location.href='../../login.html'; }
})();

/* ====== Utiles DOM ====== */
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const byId = (id)=>document.getElementById(id);

const ui = {
  grado: byId('grado'), lectura: byId('lectura'), lecturaInfo: byId('lecturasInfo'),
  desafio: byId('desafio'), desafioInfo: byId('desafiosInfo'),
  juegos: byId('juegos'),
  nombre: byId('nombre'), descripcion: byId('descripcion'),
  btnCrearPublicar: byId('btnCrearPublicar'), btnReset: byId('btnReset'),
  filtro: byId('filtro'), btnRecargar: byId('btnRecargar'),
  tbody: byId('tbodyCiclos'), msg: byId('msg'),
};
const setMsg = (t='') => (ui.msg.textContent = t);

/* ====== Renders ====== */
function renderOptions(selectEl, items, map) {
  selectEl.innerHTML = '';
  const def = document.createElement('option'); def.value=''; def.textContent='Selecciona…';
  selectEl.appendChild(def);
  for (const it of items) {
    const opt = document.createElement('option');
    const { value, label } = map(it);
    opt.value = value; opt.textContent = label;
    selectEl.appendChild(opt);
  }
  selectEl.value = '';
}
function renderJuegos(juegos) {
  ui.juegos.innerHTML = '';
  const group = {}; juegos.forEach(j => (group[j.habilidad] ||= []).push(j));
  Object.entries(group).forEach(([hab, list])=>{
    const head = document.createElement('div'); head.style.margin='4px 0';
    head.innerHTML = `<span class="chip"><b>${hab}</b> • ${list.length}</span>`;
    ui.juegos.appendChild(head);
    list.forEach(j=>{
      const line = document.createElement('label');
      line.style.display='flex'; line.style.alignItems='center'; line.style.gap='8px'; line.style.padding='4px';
      line.innerHTML = `<input type="checkbox" data-id="${j.id}"><span>${j.nombre}</span><span class="chip">${hab}</span>`;
      ui.juegos.appendChild(line);
    });
  });
}

/* ====== Carga de catálogos por grado ====== */
async function cargarCatalogos(grado) {
  if (!grado) { ui.lectura.innerHTML=''; ui.desafio.innerHTML=''; ui.juegos.innerHTML=''; return; }
  setMsg('Cargando catálogos…');
  try {
    const [lecturas, desafios, juegos] = await Promise.all([
      listarLecturas(grado), listarDesafios(grado), listarJuegos(grado)
    ]);
    renderOptions(ui.lectura, lecturas, (l)=>({ value: l.id, label: (l.numero? `${l.numero}. `:'') + l.titulo }));
    ui.lecturaInfo.textContent = `${lecturas.length} lecturas.`;
    renderOptions(ui.desafio, desafios, (d)=>({ value: d.id, label: d.titulo }));
    ui.desafioInfo.textContent = `${desafios.length} desafíos.`;
    renderJuegos(juegos);
  } catch (e) { console.error(e); alert('Error cargando catálogos (ver consola).'); }
  finally { setMsg(''); }
}

/* ====== Listado ====== */
const fmtDate = (s)=> new Date(s).toLocaleString();
const juegosCount = (r)=> r.juegos_count ?? (Array.isArray(r.juegos)? r.juegos.length : '-');
async function cargarCiclos() {
  try {
    const rows = await listarCiclos({ filtro: ui.filtro.value || '' });
    ui.tbody.innerHTML = rows.map(r=>`
      <tr>
        <td>${r.nombre}</td>
        <td>${r.version ?? '-'}</td>
        <td>${r.grado}</td>
        <td>${r.estado === 'publicado' ? `<span class="ok">publicado</span>` : r.estado}</td>
        <td>${juegosCount(r)}</td>
        <td>${r.updated_at ? fmtDate(r.updated_at) : '-'}</td>
        <td><button class="btn btn-light" data-dup="${r.id}">Duplicar</button></td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); alert('Error cargando ciclos.'); }
}

/* ====== Crear + Publicar ====== */
const juegosSeleccionados = ()=> $$('#juegos input[type="checkbox"]:checked').map(cb=>cb.dataset.id);
async function onCrearPublicar() {
  const grado = ui.grado.value, lecturaId = ui.lectura.value, desafioId = ui.desafio.value;
  const juegosIds = juegosSeleccionados(); const nombre = ui.nombre.value.trim(); const descripcion = ui.descripcion.value.trim();
  if (!grado) return alert('Selecciona un grado.');
  if (!lecturaId) return alert('Selecciona una lectura.');
  if (!desafioId) return alert('Selecciona un desafío.');
  if (juegosIds.length < 1 || juegosIds.length > 3) return alert('Selecciona entre 1 y 3 juegos.');
  if (!nombre) return alert('Ingresa un nombre para el ciclo.');

  ui.btnCrearPublicar.disabled = true; setMsg('Creando ciclo…');
  try {
    const cicloId = await crearCiclo({ grado, nombre, descripcion, lecturaId, desafioId, juegosIds });
    setMsg('Publicando ciclo…'); await publicarCiclo(cicloId);
    setMsg('Ciclo creado y publicado.'); await cargarCiclos();
  } catch (e) { console.error(e); alert('No se pudo crear/publicar el ciclo (ver consola).'); }
  finally { ui.btnCrearPublicar.disabled = false; setTimeout(()=>setMsg(''), 1000); }
}

/* ====== Init ====== */
function llenarGrados() {
  ui.grado.innerHTML = '';
  const def = document.createElement('option'); def.value=''; def.textContent='Selecciona…'; ui.grado.appendChild(def);
  for (let g=3; g<=11; g++){ const op=document.createElement('option'); op.value=String(g); op.textContent=`${g}°`; ui.grado.appendChild(op); }
  ui.grado.value='5';
}
function resetWizard() {
  ui.lectura.innerHTML=''; ui.desafio.innerHTML=''; ui.juegos.innerHTML='';
  ui.nombre.value=''; ui.descripcion.value='';
}
function wire() {
  ui.grado.addEventListener('change', ()=> cargarCatalogos(ui.grado.value));
  ui.btnCrearPublicar.addEventListener('click', onCrearPublicar);
  ui.btnReset.addEventListener('click', ()=>{ resetWizard(); cargarCatalogos(ui.grado.value); });
  ui.btnRecargar.addEventListener('click', cargarCiclos);
  ui.filtro.addEventListener('input', ()=>{ clearTimeout(window._t); window._t=setTimeout(cargarCiclos,250); });
  ui.tbody.addEventListener('click', async (e)=>{
    const id = e.target?.dataset?.dup; if (!id) return;
    try { e.target.disabled = true; await duplicarCiclo(id); await cargarCiclos(); }
    catch(err){ console.error(err); alert('No se pudo duplicar el ciclo.'); }
    finally{ e.target.disabled = false; }
  });
}
document.addEventListener('DOMContentLoaded', async ()=>{
  llenarGrados(); await cargarCatalogos(ui.grado.value); await cargarCiclos(); wire();
});
