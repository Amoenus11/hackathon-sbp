// Configuración de cada gráfico (ECharts). Separado de las páginas para que se lea fácil.
import { COLORES, COLORES_RANKING, colorBanco } from './tema.js';
import { monto, montoCorto, num } from './formato.js';

const ATENUADO = 0.18;

// Los textos que van dentro de un tooltip (HTML) se escapan: un nombre nunca puede inyectar código.
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Barras horizontales del ranking: el 1.º arriba, un color fijo por banco.
export function opcionBarrasRanking(filas, { resaltado, campo = 'saldo_actividad' } = {}) {
  const ordenadas = [...filas].sort((a, b) => a.posicion - b.posicion);
  return {
    grid: { left: 8, right: 72, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const f = ordenadas[p.dataIndex];
        const ponderacion = num(f.ponderacion_pct) !== null ? `<br/>Ponderación: ${f.ponderacion_pct} %` : '';
        return `<b>${f.posicion}.º ${esc(f.banco)}</b><br/>Saldo: ${monto(f[campo])}${ponderacion}`;
      },
    },
    xAxis: { type: 'value', axisLabel: { formatter: (v) => montoCorto(v) } },
    yAxis: {
      type: 'category', inverse: true,
      data: ordenadas.map((f) => `${f.posicion}. ${f.banco}`),
      axisLabel: { color: COLORES.texto, fontSize: 12 },
    },
    series: [{
      type: 'bar', barMaxWidth: 22,
      data: ordenadas.map((f) => ({
        value: num(f[campo]) ?? 0,
        itemStyle: { color: colorBanco(f.codigo_banco), opacity: resaltado && resaltado !== f.codigo_banco ? ATENUADO : 1 },
      })),
      label: { show: true, position: 'right', formatter: (p) => montoCorto(p.value), color: COLORES.textoSuave, fontSize: 11 },
    }],
  };
}

// Posiciones en el tiempo (bump chart): eje Y invertido 1..12.
export function opcionPosiciones(etiquetas, bancos, { resaltado } = {}) {
  return {
    grid: { left: 40, right: 150, top: 24, bottom: 32 },
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const b = bancos[p.seriesIndex];
        return `<b>${esc(b.banco)}</b><br/>${esc(etiquetas[p.dataIndex])}: ${p.value}.º lugar<br/>Saldo: ${monto(b.saldos?.[p.dataIndex])}`;
      },
    },
    xAxis: { type: 'category', data: etiquetas, boundaryGap: false, axisLabel: { fontWeight: 600 } },
    yAxis: {
      type: 'value', inverse: true, min: 1, max: Math.max(12, bancos.length), interval: 1,
      axisLabel: { formatter: (v) => `${v}.º` }, splitLine: { lineStyle: { type: 'dashed', color: COLORES.rejilla } },
    },
    series: bancos.map((b) => {
      const atenuar = resaltado && resaltado !== b.codigo_banco;
      return {
        type: 'line', name: b.banco, data: b.posiciones,
        smooth: 0.25, symbol: 'circle', symbolSize: 10,
        lineStyle: { width: atenuar ? 2 : 4, color: colorBanco(b.codigo_banco), opacity: atenuar ? ATENUADO : 1 },
        itemStyle: { color: colorBanco(b.codigo_banco), opacity: atenuar ? ATENUADO : 1 },
        emphasis: { focus: 'series', lineStyle: { width: 5 } },
        endLabel: { show: true, formatter: () => b.banco, color: colorBanco(b.codigo_banco), fontWeight: 600, distance: 8 },
      };
    }),
  };
}

// Composición de la cartera por actividad (dona)
export function opcionComposicion(composicion, titulos) {
  return {
    tooltip: { trigger: 'item', formatter: (p) => `<b>${esc(p.name)}</b><br/>${monto(composicion[p.dataIndex].saldo)}<br/>${composicion[p.dataIndex].pct} % de la cartera` },
    legend: { orient: 'vertical', right: 0, top: 'middle', textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['48%', '76%'], center: ['36%', '50%'], avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: (p) => `${Number(p.percent).toFixed(1)} %`, fontSize: 11, color: COLORES.textoSuave },
      data: composicion.map((c) => ({ name: titulos(c.ranking), value: num(c.saldo), itemStyle: { color: COLORES_RANKING[c.ranking] } })),
    }],
  };
}

// Concentración (HHI) por actividad, con las franjas de referencia 1 500 y 2 500
export function opcionHHI(concentracion, titulos) {
  const color = { baja: '#59a14f', moderada: '#edc948', alta: '#e15759' };
  return {
    grid: { left: 8, right: 24, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: 'item', formatter: (p) => { const c = concentracion[p.dataIndex]; return `<b>${esc(titulos(c.ranking))}</b><br/>HHI: ${c.hhi} (${c.nivel})<br/>3 mayores: ${c.top3_pct} %`; } },
    xAxis: { type: 'category', data: concentracion.map((c) => titulos(c.ranking)), axisLabel: { interval: 0, fontSize: 11 } },
    yAxis: { type: 'value', name: 'HHI', nameTextStyle: { color: COLORES.textoSuave } },
    series: [{
      type: 'bar', barMaxWidth: 36,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      data: concentracion.map((c) => ({ value: c.hhi, itemStyle: { color: color[c.nivel] || COLORES.acento } })),
      label: { show: true, position: 'top', fontSize: 11, color: COLORES.textoSuave },
      markLine: {
        symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#94a3b8' },
        label: { formatter: (p) => (p.value === 1500 ? 'moderada' : 'alta'), color: COLORES.textoSuave, fontSize: 10 },
        data: [{ yAxis: 1500 }, { yAxis: 2500 }],
      },
    }],
  };
}

// Pendiente: posición antes y después, una línea por banco
export function opcionPendiente(filas, etiquetas) {
  return {
    grid: { left: 150, right: 150, top: 24, bottom: 24 },
    tooltip: { trigger: 'item', formatter: (p) => { const f = filas[p.seriesIndex]; return `<b>${esc(f.banco)}</b><br/>${f.posicion_anterior}.º → ${f.posicion_actual}.º (${f.cambio > 0 ? '+' : ''}${f.cambio})`; } },
    xAxis: { type: 'category', data: etiquetas, boundaryGap: false, axisLabel: { fontWeight: 600 } },
    yAxis: { type: 'value', inverse: true, min: 1, max: 12, interval: 1, show: false },
    series: filas.map((f) => {
      const color = f.cambio > 0 ? COLORES.sube : f.cambio < 0 ? COLORES.baja : '#9aa7b5';
      return {
        type: 'line', symbol: 'circle', symbolSize: 9,
        lineStyle: { width: f.significativo ? 4 : 2, color, opacity: f.significativo || f.cambio !== 0 ? 1 : 0.45 },
        itemStyle: { color },
        label: {
          show: true, fontSize: 11, color: COLORES.texto,
          formatter: (p) => (p.dataIndex === 0 ? `${f.banco}  ${f.posicion_anterior}.º` : `${f.posicion_actual}.º  ${f.banco}`),
        },
        emphasis: { focus: 'series' },
        // Etiqueta a la izquierda en el primer punto y a la derecha en el último
        data: [
          { value: f.posicion_anterior, label: { position: 'left' } },
          { value: f.posicion_actual, label: { position: 'right' } },
        ],
      };
    }),
  };
}

// Barras agrupadas: bancos elegidos × actividades
export function opcionBarrasAgrupadas(rankings, bancos, valor, titulos, { formato = montoCorto } = {}) {
  return {
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: rankings.map(titulos), axisLabel: { interval: 0, fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { formatter: (v) => formato(v) } },
    series: bancos.map((b) => ({
      type: 'bar', name: b.banco, barMaxWidth: 26,
      itemStyle: { color: colorBanco(b.codigo_banco), borderRadius: [3, 3, 0, 0] },
      data: rankings.map((r) => valor(b, r)),
    })),
  };
}

// Mapa de calor banco × actividad (ponderación oficial del reto)
export function opcionCalor(matriz, titulos, { seleccion = [] } = {}) {
  const datos = [];
  let maximo = 0;
  matriz.bancos.forEach((b, fila) => {
    matriz.rankings.forEach((r, col) => {
      const c = b.celdas.find((x) => x.ranking === r);
      const v = num(c?.ponderacion_pct) ?? 0;
      maximo = Math.max(maximo, v);
      datos.push([col, fila, v, c?.posicion ?? null]);
    });
  });
  return {
    grid: { left: 8, right: 16, top: 8, bottom: 56, containLabel: true },
    tooltip: {
      formatter: (p) => {
        const b = matriz.bancos[p.value[1]];
        return `<b>${esc(b.banco)}</b> · ${esc(titulos(matriz.rankings[p.value[0]]))}<br/>Ponderación: ${p.value[2].toFixed(4)} %<br/>Posición: ${p.value[3] ?? '—'}.º`;
      },
    },
    xAxis: { type: 'category', data: matriz.rankings.map(titulos), splitArea: { show: true }, axisLabel: { interval: 0, fontSize: 11 } },
    yAxis: {
      type: 'category', inverse: true,
      data: matriz.bancos.map((b) => b.banco),
      axisLabel: {
        fontSize: 11,
        formatter: (v, i) => (seleccion.includes(matriz.bancos[i]?.codigo_banco) ? `{sel|${v}}` : v),
        rich: { sel: { fontWeight: 700, color: COLORES.acento } },
      },
    },
    visualMap: {
      min: 0, max: Math.ceil(maximo || 1), calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#f1f7f8', '#7cc5cb', '#0e7c86', '#0b2545'] }, text: ['más peso', 'menos'], textStyle: { fontSize: 11 },
    },
    series: [{
      type: 'heatmap', data: datos,
      label: { show: true, formatter: (p) => `${p.value[2].toFixed(1)}`, fontSize: 11 },
      itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,.25)' } },
    }],
  };
}

// Cascada de calidad como diagrama de Sankey: filas leídas → E1 … E4 → universo local válido
export function opcionSankey(c) {
  const L = c.filas_leidas;
  const { E1, E2, E3, E4 } = c.cascada;
  const unicas = L - E1;
  const locales = unicas - E2;
  const positivas = locales - E3;
  const nodos = [
    { name: 'Filas leídas', itemStyle: { color: COLORES.marino } },
    { name: 'E1 · Duplicados', itemStyle: { color: '#e15759' } },
    { name: 'Únicas', itemStyle: { color: '#4e79a7' } },
    { name: 'E2 · Destino extranjero', itemStyle: { color: '#f28e2b' } },
    { name: 'Locales', itemStyle: { color: '#4e79a7' } },
    { name: 'E3 · Saldo ≤ 0', itemStyle: { color: '#b07aa1' } },
    { name: 'Saldo positivo', itemStyle: { color: '#4e79a7' } },
    { name: 'E4 · Actividad no catalogada', itemStyle: { color: '#9c755f' } },
    { name: 'Universo local válido', itemStyle: { color: COLORES.acento } },
  ];
  const enlaces = [
    { source: 'Filas leídas', target: 'E1 · Duplicados', value: E1 },
    { source: 'Filas leídas', target: 'Únicas', value: unicas },
    { source: 'Únicas', target: 'E2 · Destino extranjero', value: E2 },
    { source: 'Únicas', target: 'Locales', value: locales },
    { source: 'Locales', target: 'E3 · Saldo ≤ 0', value: E3 },
    { source: 'Locales', target: 'Saldo positivo', value: positivas },
    { source: 'Saldo positivo', target: 'E4 · Actividad no catalogada', value: E4 },
    { source: 'Saldo positivo', target: 'Universo local válido', value: c.universo },
  ].filter((e) => e.value > 0);
  return {
    tooltip: { trigger: 'item', formatter: (p) => (p.dataType === 'edge' ? `${esc(p.data.source)} → ${esc(p.data.target)}: <b>${p.data.value.toLocaleString('es-PA')}</b> filas` : `<b>${esc(p.name)}</b>`) },
    series: [{
      type: 'sankey', left: 8, right: 170, top: 12, bottom: 12, nodeGap: 14, nodeWidth: 14, layoutIterations: 0,
      emphasis: { focus: 'adjacency' },
      lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
      label: { fontSize: 12, color: COLORES.texto },
      data: nodos, links: enlaces,
    }],
  };
}

// Desglose de un banco por subactividad (barras)
export function opcionDesglose(filas, codigo) {
  return {
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'item', formatter: (p) => `<b>${esc(filas[p.dataIndex].subactividad)}</b><br/>${monto(filas[p.dataIndex].saldo)}` },
    xAxis: { type: 'value', axisLabel: { formatter: (v) => montoCorto(v) } },
    yAxis: { type: 'category', inverse: true, data: filas.map((f) => f.subactividad), axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar', barMaxWidth: 18,
      itemStyle: { color: colorBanco(codigo) },
      data: filas.map((f) => num(f.saldo) ?? 0),
      label: { show: true, position: 'right', formatter: (p) => montoCorto(p.value), fontSize: 11, color: COLORES.textoSuave },
    }],
  };
}
