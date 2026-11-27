// Tema de los gráficos (ECharts) y colores fijos por banco.
// Un banco tiene SIEMPRE el mismo color en todos los gráficos, para reconocerlo de un vistazo.
import * as echarts from 'echarts';

export const COLORES = {
  marino: '#0f172a',
  acento: '#0e7c86',
  acentoClaro: '#5fd3dc',
  texto: '#1b2a3a',
  textoSuave: '#5b6b7c',
  rejilla: '#e6ebf1',
  sube: '#15803d',
  baja: '#b42318',
};

// 12 colores distinguibles (paleta categórica de alto contraste), uno por código de banco 101..112
const PALETA_BANCOS = {
  101: '#4e79a7', 102: '#f28e2b', 103: '#e15759', 104: '#76b7b2',
  105: '#59a14f', 106: '#edc948', 107: '#b07aa1', 108: '#ff9da7',
  109: '#9c755f', 110: '#79706e', 111: '#1d3557', 112: '#a0cbe8',
};
const RESERVA = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#79706e'];

export function colorBanco(codigo) {
  if (PALETA_BANCOS[codigo]) return PALETA_BANCOS[codigo];
  const n = String(codigo).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return RESERVA[n % RESERVA.length];
}

// Colores de las 6 actividades (macroactividades)
export const COLORES_RANKING = {
  HIPOTECARIO: '#5b4bdb',
  CONSTRUCCION: '#0e7c86',
  INDUSTRIA: '#4e79a7',
  AGROPECUARIO: '#59a14f',
  COMERCIO: '#f28e2b',
  CONSUMO: '#b07aa1',
};

const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

echarts.registerTheme('syntropy', {
  color: ['#0e7c86', '#5b4bdb', '#f59e0b', '#e11d48', '#10b981', '#3b82f6', '#a855f7', '#64748b'],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: FUENTE, color: COLORES.texto },
  title: { textStyle: { color: COLORES.texto, fontWeight: 600, fontSize: 14 } },
  legend: { textStyle: { color: COLORES.textoSuave }, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
  tooltip: {
    backgroundColor: '#ffffff',
    borderColor: '#d6dee8',
    borderWidth: 1,
    textStyle: { color: COLORES.texto, fontSize: 12 },
    extraCssText: 'box-shadow: 0 8px 24px rgba(11,37,69,.12); border-radius: 8px;',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#c3ccd6' } },
    axisTick: { show: false },
    axisLabel: { color: COLORES.textoSuave },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: COLORES.textoSuave },
    splitLine: { lineStyle: { color: COLORES.rejilla } },
  },
  bar: { itemStyle: { borderRadius: [0, 4, 4, 0] } },
  line: { symbolSize: 8, lineStyle: { width: 3 } },
});

export const TEMA = 'syntropy';
