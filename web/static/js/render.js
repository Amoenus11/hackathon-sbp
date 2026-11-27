// Dibuja las respuestas del analista (panel completo o respuesta del chat). Solo textContent: nada se ejecuta.
import { el } from './comun.js';

const PALETA = ['#0e7c86', '#5b4bdb', '#f59e0b', '#e11d48', '#10b981', '#3b82f6', '#a855f7', '#64748b'];
let temaListo = false;

function tema() {
  if (temaListo || !window.echarts) return;
  window.echarts.registerTheme('syntropy', {
    color: PALETA,
    textStyle: { fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
    title: { textStyle: { color: '#0f172a', fontSize: 14 } },
    legend: { textStyle: { color: '#334155' } },
    categoryAxis: { axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#475569' }, splitLine: { show: false } },
    valueAxis: { axisLine: { show: false }, axisLabel: { color: '#475569' }, splitLine: { lineStyle: { color: '#eef2f7' } } },
  });
  temaListo = true;
}

// Quita lo que no debe venir de la IA (formatters con HTML) y pone valores por defecto agradables.
function preparar(opcion) {
  const o = JSON.parse(JSON.stringify(opcion || {}));
  (function limpiar(x) {
    if (Array.isArray(x)) { x.forEach(limpiar); return; }
    if (x && typeof x === 'object') {
      for (const k of Object.keys(x)) {
        if (k === 'formatter' && typeof x[k] === 'string' && /[<>]|function|=>/.test(x[k])) delete x[k];
        else limpiar(x[k]);
      }
    }
  })(o);
  delete o.title;
  delete o.toolbox;
  if (!o.tooltip) o.tooltip = { trigger: o.xAxis || o.yAxis ? 'axis' : 'item' };
  if ((o.xAxis || o.yAxis) && !o.grid) o.grid = { left: 8, right: 18, top: o.legend ? 40 : 18, bottom: 8, containLabel: true };
  if (o.legend && !Array.isArray(o.legend)) o.legend = { type: 'scroll', top: 0, ...o.legend };
  o.animationDuration = 600;
  return o;
}

export function grafico(contenedor, opcion, renderer = 'canvas') {
  tema();
  if (!window.echarts) { contenedor.textContent = 'No se pudo cargar la librería de gráficos.'; return null; }
  const g = window.echarts.init(contenedor, 'syntropy', { renderer });
  try { g.setOption(preparar(opcion)); } catch (e) { contenedor.textContent = 'Este gráfico no se pudo dibujar.'; }
  new ResizeObserver(() => g.resize()).observe(contenedor);
  return g;
}

const FLECHA = { sube: '▲', baja: '▼', estable: '●' };

function kpis(lista) {
  const c = el('div', 'kpis');
  for (const k of lista || []) {
    const t = el('div', 'kpi');
    t.append(el('div', 'kpi-nombre', k.nombre));
    const v = el('div', 'kpi-valor num', k.valor);
    if (FLECHA[k.tendencia]) v.append(el('span', `tendencia ${k.tendencia}`, ` ${FLECHA[k.tendencia]}`));
    t.append(v);
    if (k.detalle) t.append(el('div', 'kpi-detalle', k.detalle));
    c.append(t);
  }
  return c;
}

export function tarjetaGrafico(g, { alFijar, alQuitar, renderer } = {}) {
  const t = el('figure', 'grafico');
  const cab = el('figcaption', 'grafico-cab');
  cab.append(el('strong', null, g.titulo || 'Gráfico'));
  if (alFijar) {
    const b = el('button', 'boton secundario chico', 'Fijar al panel');
    b.type = 'button';
    b.addEventListener('click', async () => { b.disabled = true; try { await alFijar(g); b.textContent = 'Fijado ✓'; } catch { b.disabled = false; } });
    cab.append(b);
  }
  if (alQuitar) {
    const b = el('button', 'boton secundario chico', 'Quitar');
    b.type = 'button';
    b.addEventListener('click', () => alQuitar(t));
    cab.append(b);
  }
  t.append(cab);
  const lienzo = el('div', 'lienzo');
  t.append(lienzo);
  if (g.explicacion) t.append(el('p', 'grafico-nota', g.explicacion));
  requestAnimationFrame(() => grafico(lienzo, g.echarts, renderer));
  return t;
}

function lista(titulo, clase, elementos, pintar) {
  const s = el('section', `bloque ${clase}`);
  s.append(el('h3', null, titulo));
  const ul = el('ul');
  for (const x of elementos) ul.append(pintar(x));
  s.append(ul);
  return s;
}

// datos = respuesta del analista según el esquema. opciones: {completo, alFijar, renderer}
export function pintarRespuesta(datos, opciones = {}) {
  const r = el('article', opciones.completo ? 'respuesta completa' : 'respuesta');
  r.append(el(opciones.completo ? 'h2' : 'h3', 'respuesta-titulo', datos.titulo || 'Resultado'));
  if (datos.resumen) r.append(el('p', 'resumen', datos.resumen));
  if (datos.kpis && datos.kpis.length) r.append(kpis(datos.kpis));
  if (datos.graficos && datos.graficos.length) {
    const gs = el('div', 'graficos');
    for (const g of datos.graficos) gs.append(tarjetaGrafico(g, opciones));
    r.append(gs);
  }
  const columnas = el('div', 'columnas');
  if (datos.hallazgos && datos.hallazgos.length) {
    columnas.append(lista('Hallazgos', 'hallazgos', datos.hallazgos, (h) => {
      const li = el('li', null, h.texto);
      if (h.evidencia) li.append(el('span', 'evidencia', h.evidencia));
      return li;
    }));
  }
  if (datos.alertas && datos.alertas.length) {
    columnas.append(lista('Alertas', 'alertas', datos.alertas, (a) => {
      const li = el('li', `nivel-${a.nivel || 'media'}`);
      li.append(el('span', 'insignia', (a.nivel || 'media').toUpperCase()), document.createTextNode(' ' + (a.texto || '')));
      return li;
    }));
  }
  if (datos.recomendaciones && datos.recomendaciones.length) {
    columnas.append(lista('Recomendaciones', 'recomendaciones', datos.recomendaciones, (t) => el('li', null, t)));
  }
  if (columnas.childElementCount) r.append(columnas);
  if ((datos.consultas && datos.consultas.length) || (datos.limitaciones && datos.limitaciones.length)) {
    const d = el('details', 'evidencias');
    d.append(el('summary', null, `Ver evidencia: ${(datos.consultas || []).length} consultas y supuestos`));
    for (const q of datos.consultas || []) {
      d.append(el('p', 'consulta-desc', q.descripcion));
      d.append(el('pre', 'codigo', q.codigo));
    }
    if (datos.limitaciones && datos.limitaciones.length) {
      d.append(el('p', 'consulta-desc', 'Límites y supuestos'));
      const ul = el('ul');
      for (const l of datos.limitaciones) ul.append(el('li', null, l));
      d.append(ul);
    }
    if (opciones.abrirEvidencia) d.open = true;
    r.append(d);
  }
  return r;
}
