// js/ciclos.js
import {
  listarLecturas, listarDesafios, listarJuegos,
  crearCiclo, publicarCiclo, listarCiclos, duplicarCiclo
} from './api-ciclos.js';
import { SUPABASE_URL } from './supabaseClient.js';

/* ====== Guard Admin ====== */
(function ensureAdmin() {
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const sA = read('tsp_admin_session');
  const sU = read('tsp_user_session');
  const role = String(
    sA?.rol ?? sA?.role ?? sA?.perfil ??
    sU?.rol ?? sU?.role ?? sU?.perfil ?? ''
  ).toLowerCase();
  const isAdmin = (role === 'admin') || (sA?.is_admin === true) || (sU?.is_admin === true);
  if (!isAdmin) { alert('Acceso solo para Administrador.'); location.href='../../login.html'; }
})();

/* ====== DOM ====== */
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const byId = (id)=>document.getElementById(id);

const ui = {
  grado: byId('grado'),
  lectura: byId('lectura'), lecturaInfo: byId('lecturasInfo'), btnPrevLec: byId('btnPreviewLectura'),
  desafio: byId('desafio'), desafioInfo: byId('desafiosInfo'), btnPrevDes: byId('btnPreviewDesafio'),
  juegos: byId('juegos'),
  nombre: byId('nombre'), descripcion: byId('descripcion'),
  btnCrearPublicar: byId('btnCrearPublicar'), btnReset: byId('btnReset'),
  filtro: byId('filtro'), btnRecargar: byId('btnRecargar'),
  tbody: byId('tbodyCiclos'), msg: byId('msg'),
};
const setMsg = (t='') => (ui.msg && (ui.msg.textContent = t));

/* ====== Helpers ====== */
const PUBLIC_BASE = `${SUPABASE_URL}/storage/v1/object/public`;
const toInt = (x)=> Number.parseInt(String(x||'').trim(), 10) || 0;

function buildLecturaPath(grado, numero) {
  const g = toInt(grado), n = toInt(numero);
  return `tsp-lecturas/grado-${g}/ciclo-${n}/g${g}c${n}.pdf`;
}
function buildDesafioPath(grado, numero) {
  const g = toInt(grado), n = toInt(numero);
  return `tsp-desafios/grado-${g}/ciclo-${n}/dcg${g}c${n}.pdf`;
}
function buildLecturaURL(grado, numero) {
  return `${PUBLIC_BASE}/${buildLecturaPath(grado, numero)}`;
}
function buildDesafioURL(grado, numero) {
  return `${PUBLIC_BASE}/${buildDesafioPath(grado, numero)}`;
}
function getSelectedNumero(selectEl) {
  const opt = selectEl.options[selectEl.selectedIndex];
  return opt?.dataset?.num ? Number(opt.dataset.num) : 0;
}

/* Verifica si un objeto existe en Storage (HEAD) */
async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

/* ====== Preview con verificación ====== */
async function openPreviewLectura() {
  const grado = ui.grado.value;
  const numero = getSelectedNumero(ui.lectura);
  if (!grado || !numero) return alert('Selecciona grado y lectura.');

  const g = toInt(grado), n = toInt(numero);
  const url = buildLecturaURL(g, n);

  if (await urlExists(url)) {
    window.open(url, '_blank', 'noopener');
  } else {
    const fullPath = buildLecturaPath(g, n);
    alert(
`Archivo no encontrado (404).
Sube el PDF con esta ruta COMPLETA:

${fullPath}

Ejemplo existente:
tsp-lecturas/grado-3/ciclo-1/g3c1.pdf`
    );
  }
}

async function openPreviewDesafio() {
  const grado = ui.grado.value;
  const numero = getSelectedNumero(ui.desafio);
  if (!grado || !numero) return alert('Selecciona grado y desafío.');

  const g = toInt(grado), n = toInt(numero);
  const url = buildDesafioURL(g, n);

  if (await urlExists(url)) {
    window.open(url, '_blank', 'noopener');
  } else {
    const fullPath = buildDesafioPath(g, n);
    alert(
`Archivo no encontrado (404).
Sube el PDF con esta ruta COMPLETA:

${fullPath}

Ejemplo existente:
tsp-desafios/grado-3/ciclo-1/dcg3c1.pdf`
    );
  }
}

/* ====== Renders ====== */
function renderOptions(selectEl, items, map) {
  selectEl.innerHTML = '';
  const def = document.createElement('option'); def.value=''; def.textContent='Selecciona…';
  selectEl.appendChild(def);
  items.forEach((it, i) => {
    const opt = document.createElement('option');
    const { value, label, numero } = map(it, i);
    opt.value = value; opt.textContent = label;
    if (numero != null) opt.dataset.num = numero; else opt.dataset.num = String(i+1);
    selectEl.appendChild(opt);
  });
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

/* ====== Carga de catálogos ====== */
async function cargarCatalogos(grado) {
  ui.btnPrevLec.disabled = true; ui.btnPrevDes.disabled = true;
  if (!grado) { ui.lectura.innerHTML=''; ui.desafio.innerHTML=''; ui.juegos.innerHTML=''; return; }
  setMsg('Cargando catálogos…');
  try {
    const [lecturas, desafios, juegos] = await Promise.all([
      listarLecturas(grado), listarDesafios(grado), listarJuegos(grado)
    ]);
    // lecturas
    renderOptions(ui.lectura, lecturas, (l)=>({
      value: l.id, label: (l.numero? `${l.numero}. `:'') + l.titulo, numero: l.numero ?? null
    }));
    ui.lecturaInfo && (ui.lecturaInfo.textContent = `${lecturas.length} lecturas.`);
    // desafíos
    renderOptions(ui.desafio, desafios, (d,i)=>({
      value: d.id, label: d.titulo, numero: d.numero ?? (i+1)
    }));
    ui.desafioInfo && (ui.desafioInfo.textContent = `${desafios.length} desafíos.`);
    renderJuegos(juegos);
  } catch (e) { console.error(e); alert('Error cargando catálogos (ver consola).'); }
  finally { setMsg(''); }
}

/* ====== Listado ====== */
const fmtDate = (s)=> new Date(s).toLocaleString();
const juegosCount = (r)=> r.juegos_count ?? (Array.isArray(r.juegos)? r.juegos.length : '-');

async function cargarCiclos() {
  try {
    const rows = await listarCiclos({ filtro: ui.filtro?.value || '' });
    if (!ui.tbody) return;
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

/* ====== Grados ====== */
const GRADOS = [
  { value: '1',  label: '1°' },  { value: '2',  label: '2°' },  { value: '3',  label: '3°' },
  { value: '4',  label: '4°' },  { value: '5',  label: '5°' },  { value: '6',  label: '6°' },
  { value: '7',  label: '7°' },  { value: '8',  label: '8°' },  { value: '9',  label: '9°' },
  { value: '10', label: '10°' }, { value: '11', label: '11°' },
  { value: '12', label: 'Profesional' }
];
function renderOptionsSimple(selectEl, items) {
  selectEl.innerHTML = '';
  const def = document.createElement('option'); def.value=''; def.textContent='Selecciona…';
  selectEl.appendChild(def);
  items.forEach(it=>{
    const opt = document.createElement('option');
    opt.value = it.value; opt.textContent = it.label;
    selectEl.appendChild(opt);
  });
}
function llenarGrados(){ renderOptionsSimple(ui.grado, GRADOS); }

/* ====== Estado botones Preview ====== */
function updatePreviewButtonsState() {
  ui.btnPrevLec.disabled = !ui.lectura.value;
  ui.btnPrevDes.disabled = !ui.desafio.value;
}

/* ====== Init ====== */
function resetWizard() {
  ui.lectura.innerHTML=''; ui.desafio.innerHTML=''; ui.juegos.innerHTML='';
  ui.nombre.value=''; ui.descripcion.value='';
  ui.btnPrevLec.disabled = true; ui.btnPrevDes.disabled = true;
}
function wire() {
  ui.grado.addEventListener('change', ()=> cargarCatalogos(ui.grado.value));
  ui.btnCrearPublicar.addEventListener('click', onCrearPublicar);
  ui.btnReset.addEventListener('click', ()=>{ resetWizard(); cargarCatalogos(ui.grado.value); });
  ui.btnRecargar && ui.btnRecargar.addEventListener('click', cargarCiclos);
  ui.filtro && ui.filtro.addEventListener('input', ()=>{ clearTimeout(window._t); window._t=setTimeout(cargarCiclos,250); });
  ui.tbody && ui.tbody.addEventListener('click', async (e)=>{
    const id = e.target?.dataset?.dup; if (!id) return;
    try { e.target.disabled = true; await duplicarCiclo(id); await cargarCiclos(); }
    catch(err){ console.error(err); alert('No se pudo duplicar el ciclo.'); }
    finally{ e.target.disabled = false; }
  });

  // Preview enable/disable + click
  ui.lectura.addEventListener('change', updatePreviewButtonsState);
  ui.desafio.addEventListener('change', updatePreviewButtonsState);
  ui.btnPrevLec.addEventListener('click', openPreviewLectura);
  ui.btnPrevDes.addEventListener('click', openPreviewDesafio);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  llenarGrados();
  await cargarCiclos();
  wire();
});
