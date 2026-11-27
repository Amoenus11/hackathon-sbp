// Reporte ejecutivo descargable (HTML autocontenido, listo para imprimir o guardar como PDF).
// Se arma automáticamente con los resultados del motor: no hay texto escrito a mano por período.
import { panel, rankings, calidad, movimientos, FUENTE, AVISO } from './vistas.js';
import { etiqueta } from './estado.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = new Intl.NumberFormat('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const din = (t) => (t === null ? '—' : num.format(Number(t)));
const pct = (t, d = 2) => (t === null || t === undefined ? '—' : `${Number(t).toFixed(d).replace('.', ',')} %`);
const flecha = (c) => (c === null ? '' : c > 0 ? `▲ ${c}` : c < 0 ? `▼ ${-c}` : '＝');

/**
 * @param {object} opciones { fecha, rankings: string[] | null, banco: string | null, usuario }
 */
export function reporteHtml(estado, { fecha, rankings: elegidos, banco, usuario } = {}) {
  const pan = panel(estado, fecha);
  const cal = calidad(estado, pan.fecha);
  const mov = pan.fecha_anterior ? movimientos(estado, pan.fecha_anterior, pan.fecha) : null;
  const lista = estado.cat.rankings.filter((r) => !elegidos?.length || elegidos.includes(r.nombre));
  const k = pan.kpis;

  const tablas = lista.map((r) => {
    const rk = rankings(estado, pan.fecha, r.nombre);
    const filas = rk.filas.filter((f) => !banco || f.codigo_banco === banco).map((f) => `
      <tr${banco && f.codigo_banco === banco ? ' class="sel"' : ''}><td class="n">${f.posicion}</td><td>${esc(f.banco)} <span class="cod">${f.codigo_banco}</span></td>
      <td class="n">${din(f.saldo_actividad)}</td><td class="n">${din(f.total_cartera)}</td><td class="n">${pct(f.ponderacion_pct, 4)}</td>
      <td class="n">${pct(f.participacion_pct)}</td><td class="n ${f.cambio > 0 ? 'sube' : f.cambio < 0 ? 'baja' : ''}">${flecha(f.cambio)}</td></tr>`).join('');
    return `<section><h3>${esc(r.titulo)} <small>${esc(r.tipo)}</small></h3>
      <table><thead><tr><th>Pos.</th><th>Banco</th><th>Saldo de la actividad</th><th>Total cartera local válida</th><th>Ponderación</th><th>Cuota del ranking</th><th>Cambio</th></tr></thead>
      <tbody>${filas}</tbody></table></section>`;
  }).join('');

  const explicaciones = (mov?.explicaciones ?? []).filter((_, i) => i < 12).map((t) => `<li>${esc(t)}</li>`).join('');
  const recs = cal.reconciliaciones.map((r) => `<li class="${r.ok ? 'ok' : 'mal'}">${r.ok ? '✔' : '✘'} ${esc(r.id)} · ${esc(r.nombre)}</li>`).join('');

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Reporte de rankings de crédito · ${esc(pan.etiqueta)}</title>
<style>
  body{font:14px/1.45 system-ui,"Segoe UI",Arial,sans-serif;color:#1d2433;margin:32px auto;max-width:1000px;padding:0 24px}
  h1{font-size:26px;margin:0 0 4px} h2{font-size:19px;margin:28px 0 8px} h3{font-size:16px;margin:22px 0 6px} small{color:#667;font-weight:400;font-size:12px}
  .aviso{background:#fff4e5;border:1px solid #f0c27b;padding:8px 12px;border-radius:6px;margin:12px 0}
  .meta{color:#556;font-size:13px} .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
  .kpi{border:1px solid #dde2ea;border-radius:8px;padding:10px 12px} .kpi b{display:block;font-size:20px}
  table{border-collapse:collapse;width:100%;font-size:13px} th,td{border-bottom:1px solid #e4e8ef;padding:5px 8px;text-align:left}
  th{background:#f4f6f9;font-weight:600} td.n{text-align:right;font-variant-numeric:tabular-nums} .cod{color:#889;font-size:11px}
  .sube{color:#0a7a3c} .baja{color:#b42318} tr.sel td{background:#eef4ff} li.ok{color:#0a7a3c} li.mal{color:#b42318}
  @media print{body{margin:0} section{break-inside:avoid}}
</style></head><body>
<h1>Rankings de crédito por actividad económica</h1>
<div class="meta">Período: <b>${esc(pan.etiqueta)}</b> (${pan.fecha})${pan.fecha_anterior ? ` · comparado con ${esc(etiqueta(pan.fecha_anterior))}` : ''} · Fuente: ${esc(FUENTE)} · Generado ${esc(new Date().toLocaleString('es-PA'))}${usuario ? ` por ${esc(usuario)}` : ''}</div>
<div class="aviso">${esc(AVISO)}</div>
<h2>Resumen</h2>
<div class="kpis">
  <div class="kpi">Cartera local válida<b>${din(k.cartera_total)}</b>${k.var_cartera_pct ? `${pct(k.var_cartera_pct)} vs. mes anterior` : ''}</div>
  <div class="kpi">Operaciones válidas<b>${num.format(k.operaciones).replace(',00', '')}</b>de ${k.filas_leidas} filas leídas</div>
  <div class="kpi">Filas excluidas<b>${k.excluidas}</b>${pct(k.pct_excluidas)} del archivo</div>
  <div class="kpi">Morosidad (saldo con días de mora)<b>${pct(pan.indicadores.morosidad_pct)}</b>indicador adicional</div>
</div>
${explicaciones ? `<h2>Principales movimientos</h2><ul>${explicaciones}</ul>` : ''}
<h2>Rankings</h2>${tablas}
<h2>Calidad de datos</h2>
<p>Filas leídas ${cal.filas_leidas} = E1 duplicados ${cal.cascada.E1} + E2 destino extranjero ${cal.cascada.E2} + E3 saldo no positivo ${cal.cascada.E3} + E4 actividad no catalogada ${cal.cascada.E4} + universo local válido ${cal.universo} → ${cal.cuadra ? 'cuadra' : 'NO cuadra'}.</p>
<ul>${recs}</ul>
<p class="meta">Reglas: exclusiones en cascada E1→E4, clasificación por catálogo CINU/SB109 con reclasificación SB21 de Crédito personal con facilidad 07 a Tarjeta, sumas exactas en centavos, ponderación = saldo de la actividad / total de cartera local válida del banco × 100 con 4 decimales, desempate por código de banco. Movimiento significativo: |cambio| ≥ ${mov?.regla.mov_min_posiciones ?? estado.parametros.mov_min_posiciones} posiciones${(mov?.regla ?? estado.parametros).mov_cambio_lider ? ', cambio de líder' : ''} o variación de saldo ≥ ${esc((mov?.regla ?? estado.parametros).mov_var_saldo_pct)} %.</p>
</body></html>`;
}
