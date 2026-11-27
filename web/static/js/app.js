import { api, flujo, el, salir } from './comun.js';
import { pintarRespuesta, tarjetaGrafico } from './render.js';

const $ = (id) => document.getElementById(id);
let yo = null;
const historial = [];
let ocupado = false;

// ------------------------------------------------------------ inicio
async function iniciar() {
  yo = await api('/api/yo');
  $('yo').textContent = yo.nombre;
  if (yo.rol === 'admin' || yo.rol === 'equipo') $('ir-equipo').classList.remove('oculto');
  if (yo.rol === 'admin') $('ir-admin').classList.remove('oculto');
  await Promise.all([cargarConjuntos(), cargarPanel()]);
}
$('salir').addEventListener('click', salir);

// Pestañas (teléfono)
$('pestanas').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-ir]');
  if (!b) return;
  document.querySelectorAll('#pestanas button').forEach((x) => x.classList.toggle('activa', x === b));
  document.querySelectorAll('.col').forEach((c) => c.classList.toggle('visible', c.id === b.dataset.ir));
});
$('col-panel').classList.add('visible');

// ------------------------------------------------------------ datos
async function cargarConjuntos() {
  const cat = await api('/api/conjuntos');
  const c = $('conjuntos');
  c.replaceChildren();
  if (!cat.conjuntos.length) { c.append(el('p', 'nota', 'Todavía no hay datos.')); return; }
  for (const x of cat.conjuntos) {
    const t = el('div', 'conjunto');
    t.append(el('strong', null, x.nombre));
    t.append(el('span', 'nota num', `${x.filas.toLocaleString('es-PA')} filas · ${x.columnas.length} columnas`));
    if (x.descripcion) t.append(el('span', 'nota', x.descripcion));
    const acciones = el('div', 'fila');
    const ver = el('button', 'boton secundario chico', 'Ver');
    ver.type = 'button';
    ver.addEventListener('click', () => verMuestra(x.nombre));
    acciones.append(ver);
    if (yo.rol !== 'sbp') {
      const b = el('button', 'boton secundario chico', 'Quitar');
      b.type = 'button';
      b.addEventListener('click', async () => {
        if (!confirm(`¿Quitar «${x.nombre}»?`)) return;
        await api(`/api/conjuntos/${encodeURIComponent(x.nombre)}`, { method: 'DELETE' });
        cargarConjuntos();
      });
      acciones.append(b);
    }
    t.append(acciones);
    c.append(t);
  }
}

async function subir(archivo) {
  $('error-datos').textContent = '';
  const fd = new FormData();
  fd.append('archivo', archivo);
  fd.append('descripcion', $('descripcion').value);
  $('soltar').classList.add('cargando');
  try {
    await api('/api/conjuntos', { method: 'POST', body: fd });
    $('descripcion').value = '';
    await cargarConjuntos();
  } catch (x) {
    $('error-datos').textContent = x.message;
  } finally {
    $('soltar').classList.remove('cargando');
    $('archivo').value = '';
  }
}
$('archivo').addEventListener('change', () => { if ($('archivo').files[0]) subir($('archivo').files[0]); });
['dragover', 'dragenter'].forEach((t) => $('soltar').addEventListener(t, (e) => { e.preventDefault(); $('soltar').classList.add('encima'); }));
['dragleave', 'drop'].forEach((t) => $('soltar').addEventListener(t, () => $('soltar').classList.remove('encima')));
$('soltar').addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) subir(e.dataTransfer.files[0]); });

async function verMuestra(nombre) {
  const m = await api(`/api/conjuntos/${encodeURIComponent(nombre)}/muestra`);
  $('muestra-titulo').textContent = `${nombre} · primeras ${m.filas.length} filas`;
  const t = $('muestra-tabla');
  t.replaceChildren();
  const cab = el('tr');
  m.columnas.forEach((c) => cab.append(el('th', null, c)));
  t.append(cab);
  for (const f of m.filas) {
    const tr = el('tr');
    f.forEach((v) => tr.append(el('td', null, v === null ? '' : v)));
    t.append(tr);
  }
  $('muestra').showModal();
}
$('muestra-cerrar').addEventListener('click', () => $('muestra').close());

// ------------------------------------------------------------ panel
async function fijar(g) { await api('/api/fijados', { method: 'POST', json: { grafico: g } }); cargarPanel(); }

async function cargarPanel() {
  const d = await api('/api/panel');
  const p = $('panel');
  p.replaceChildren();
  if (d.panel) {
    const cuando = new Date(d.panel.creado).toLocaleString('es-PA', { timeZone: 'America/Panama', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    $('panel-meta').textContent = `Generado por la IA a pedido de ${d.panel.usuario} · ${cuando}`;
    p.append(pintarRespuesta(d.panel.datos, { completo: true }));
  }
  const f = $('fijados');
  f.replaceChildren();
  $('fijados-zona').classList.toggle('oculto', !d.fijados.length);
  for (const x of d.fijados) {
    f.append(tarjetaGrafico(x.datos, yo.rol === 'sbp' ? {} : {
      alQuitar: async (nodo) => { await api(`/api/fijados/${x.id}`, { method: 'DELETE' }); nodo.remove(); },
    }));
  }
}

function reloj(nodo) {
  const t0 = Date.now();
  const i = setInterval(() => { nodo.textContent = `${Math.round((Date.now() - t0) / 1000)} s`; }, 1000);
  return () => clearInterval(i);
}

function agregarPaso(lista, ev) {
  const li = el('li', null, ev.texto);
  if (ev.detalle) {
    const d = el('details');
    d.append(el('summary', null, 'ver'), el('pre', 'codigo', ev.detalle));
    li.append(d);
  }
  lista.append(li);
  li.scrollIntoView({ block: 'nearest' });
}

$('generar').addEventListener('click', async () => {
  if (ocupado) return;
  ocupado = true;
  $('generar').disabled = true;
  $('trabajo').classList.remove('oculto');
  $('trabajo-titulo').textContent = 'El analista está armando el panel…';
  $('trabajo-pasos').replaceChildren();
  const parar = reloj($('trabajo-reloj'));
  try {
    await flujo('/api/preguntar', { modo: 'panel' }, (ev) => {
      if (ev.tipo === 'paso') agregarPaso($('trabajo-pasos'), ev);
      if (ev.tipo === 'error') agregarPaso($('trabajo-pasos'), { texto: `⚠ ${ev.texto}` });
      if (ev.tipo === 'fin' && ev.costo_usd != null) $('trabajo-titulo').textContent = `Listo en ${Math.round(ev.segundos)} s · US$ ${Number(ev.costo_usd).toFixed(2)}`;
    });
    await cargarPanel();
    setTimeout(() => $('trabajo').classList.add('oculto'), 2500);
  } catch (x) {
    agregarPaso($('trabajo-pasos'), { texto: `⚠ ${x.message}` });
  } finally {
    parar();
    ocupado = false;
    $('generar').disabled = false;
  }
});

// ------------------------------------------------------------ chat
async function preguntar(texto) {
  if (ocupado || !texto.trim()) return;
  ocupado = true;
  $('enviar').disabled = true;
  const conv = $('conversacion');
  conv.append(el('div', 'burbuja yo', texto));
  const b = el('div', 'burbuja ia');
  const cab = el('div', 'trabajo-cab');
  const titulo = el('strong', null, 'Analizando…');
  const t = el('span', 'nota num');
  cab.append(el('span', 'girando'), titulo, t);
  const pasos = el('ol', 'pasos');
  b.append(cab, pasos);
  conv.append(b);
  b.scrollIntoView({ block: 'end', behavior: 'smooth' });
  const parar = reloj(t);
  let respuesta = null;
  try {
    await flujo('/api/preguntar', { modo: 'pregunta', pregunta: texto, historial }, (ev) => {
      if (ev.tipo === 'paso') agregarPaso(pasos, ev);
      else if (ev.tipo === 'respuesta') respuesta = ev.datos;
      else if (ev.tipo === 'error') agregarPaso(pasos, { texto: `⚠ ${ev.texto}` });
      else if (ev.tipo === 'fin') titulo.textContent = `Listo en ${Math.round(ev.segundos || 0)} s${ev.costo_usd != null ? ` · US$ ${Number(ev.costo_usd).toFixed(2)}` : ''}`;
    });
  } catch (x) {
    agregarPaso(pasos, { texto: `⚠ ${x.message}` });
  } finally {
    parar();
    cab.querySelector('.girando')?.remove();
    ocupado = false;
    $('enviar').disabled = false;
  }
  if (respuesta) {
    pasos.classList.add('plegados');
    const d = el('details', 'ver-pasos');
    d.append(el('summary', null, `Cómo lo hizo (${pasos.childElementCount} pasos)`), pasos);
    b.append(d, pintarRespuesta(respuesta, { alFijar: fijar }));
    historial.push({ pregunta: texto, resumen: respuesta.resumen || '' });
    if (historial.length > 6) historial.shift();
  }
  b.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

$('preguntar').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('pregunta').value;
  $('pregunta').value = '';
  preguntar(t);
});
$('pregunta').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('preguntar').requestSubmit(); }
});
$('sugerencias').addEventListener('click', (e) => {
  const s = e.target.closest('.sugerencia');
  if (s) preguntar(s.textContent);
});

iniciar().catch((x) => { $('panel-meta').textContent = x.message; });
