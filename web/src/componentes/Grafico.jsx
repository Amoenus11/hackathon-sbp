// Envoltura de ECharts con el tema de Syntropy. Cada gráfico lleva una descripción para lectores de pantalla.
import ReactECharts from 'echarts-for-react';
import { TEMA } from '../tema.js';

export default function Grafico({ opcion, alto = 320, etiqueta, alEventos, svg = false }) {
  return (
    <div className="grafico" role="img" aria-label={etiqueta}>
      <ReactECharts
        option={opcion}
        theme={TEMA}
        notMerge
        lazyUpdate
        style={{ height: alto, width: '100%' }}
        opts={{ renderer: svg ? 'svg' : 'canvas' }}
        onEvents={alEventos}
      />
    </div>
  );
}
