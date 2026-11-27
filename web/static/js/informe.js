import { api, el } from './comun.js';
import { pintarRespuesta, tarjetaGrafico } from './render.js';
const $ = (id) => document.getElementById(id);
$('imprimir').addEventListener('click', () => window.print());
$('fecha').textContent = new Date().toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'long', timeStyle: 'short' });
(async () => {
  const d = await api('/api/panel');
  const c = $('contenido');
  c.replaceChildren();
  if (!d.panel) { c.append(el('p', 'nota', 'Todavía no hay panel. Genéralo en la app con «Generar panel con IA».')); return; }
  c.append(pintarRespuesta(d.panel.datos, { completo: true, renderer: 'svg', abrirEvidencia: true }));
  if (d.fijados.length) {
    c.append(el('h3', 'subtitulo-informe', 'Análisis adicionales'));
    const g = el('div', 'graficos');
    d.fijados.forEach((x) => g.append(tarjetaGrafico(x.datos, { renderer: 'svg' })));
    c.append(g);
  }
})().catch((x) => { $('contenido').textContent = x.message; });
