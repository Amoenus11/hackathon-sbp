// Envoltorio mínimo de ECharts (renderizador SVG, solo los módulos que se usan).
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, HeatmapChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkLineComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { TINTA } from '../formato.js';

echarts.use([BarChart, LineChart, HeatmapChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkLineComponent, SVGRenderer]);

/** Estilo común: tipografía del sistema, ejes y rejilla discretos, tooltip claro. */
export const BASE = {
  textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: TINTA.secundaria },
  animationDuration: 350,
  tooltip: {
    backgroundColor: '#ffffff', borderColor: 'rgba(11,11,11,0.10)', borderWidth: 1, padding: [8, 10],
    textStyle: { color: TINTA.primaria, fontSize: 12 }, extraCssText: 'box-shadow:0 4px 14px rgba(0,0,0,.08);border-radius:8px;',
  },
};
export const EJE_VALOR = {
  type: 'value', axisLine: { show: false }, axisTick: { show: false },
  splitLine: { lineStyle: { color: TINTA.rejilla, width: 1 } }, axisLabel: { color: TINTA.tenue, fontSize: 11 },
};
export const EJE_CATEGORIA = {
  type: 'category', axisLine: { lineStyle: { color: TINTA.eje } }, axisTick: { show: false },
  axisLabel: { color: TINTA.secundaria, fontSize: 12 },
};

export default function Grafico({ opcion, alto = 320, descripcion, alClic }) {
  const nodo = useRef(null);
  const instancia = useRef(null);

  useEffect(() => {
    const g = echarts.init(nodo.current, null, { renderer: 'svg' });
    instancia.current = g;
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(nodo.current);
    return () => { ro.disconnect(); g.dispose(); };
  }, []);

  useEffect(() => {
    instancia.current?.setOption({ ...BASE, ...opcion, tooltip: { ...BASE.tooltip, ...(opcion.tooltip ?? {}) } }, true);
  }, [opcion]);

  useEffect(() => {
    const g = instancia.current;
    if (!g || !alClic) return undefined;
    g.on('click', alClic);
    return () => g.off('click', alClic);
  }, [alClic]);

  return <div ref={nodo} className="grafico" style={{ height: alto }} role="img" aria-label={descripcion} />;
}
