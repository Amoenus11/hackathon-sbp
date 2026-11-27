// Formatos de números y fechas.
// Los montos llegan como texto exacto con 2 decimales ("1234567.89"): se formatean sin pasar por
// números de coma flotante, para mostrar exactamente lo que calculó el motor (al centavo).

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

function agrupar(entero) {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// "1234567.89" → "1,234,567.89" (exacto, convención de Panamá: coma de miles, punto decimal)
export function monto(texto) {
  if (texto === null || texto === undefined || texto === '') return '—';
  const s = String(texto);
  const negativo = s.startsWith('-');
  const [entero, decimales = '00'] = (negativo ? s.slice(1) : s).split('.');
  return `${negativo ? '−' : ''}${agrupar(entero)}.${decimales.padEnd(2, '0').slice(0, 2)}`;
}

// Monto abreviado para tarjetas y ejes: 12.3 M, 845.2 mil
export function montoCorto(texto) {
  const n = Number(texto);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e6).toLocaleString('es-PA', { maximumFractionDigits: 0 })} M`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString('es-PA', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString('es-PA', { maximumFractionDigits: 1 })} mil`;
  return n.toLocaleString('es-PA', { maximumFractionDigits: 2 });
}

// "12.3456" → "12.3456 %" (decimales: los que se pidan; por defecto, los que trae el texto)
export function pct(texto, decimales) {
  if (texto === null || texto === undefined || texto === '') return '—';
  if (decimales === undefined) return `${String(texto)} %`;
  const n = Number(texto);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('es-PA', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })} %`;
}

// Variación con signo: +4.12 % / −3.00 %
export function variacion(texto, decimales = 2) {
  if (texto === null || texto === undefined || texto === '') return '—';
  const n = Number(texto);
  if (!Number.isFinite(n)) return '—';
  const cuerpo = Math.abs(n).toLocaleString('es-PA', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${cuerpo} %`;
}

export function entero(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('es-PA', { maximumFractionDigits: 0 });
}

// "20260930" → "30/09/2026"
export function fechaCorte(aaaammdd) {
  if (!aaaammdd || String(aaaammdd).length !== 8) return aaaammdd || '—';
  const s = String(aaaammdd);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

// "20260930" → "septiembre 2026" (si el servidor ya mandó la etiqueta, se usa esa)
export function etiquetaPeriodo(aaaammdd, meta) {
  const p = meta?.periodos?.find((x) => x.fecha === aaaammdd);
  if (p?.etiqueta) return p.etiqueta;
  if (!aaaammdd || String(aaaammdd).length !== 8) return aaaammdd || '—';
  const s = String(aaaammdd);
  return `${MESES[Number(s.slice(4, 6)) - 1] || s.slice(4, 6)} ${s.slice(0, 4)}`;
}

export function etiquetaCorta(aaaammdd, meta) {
  const p = meta?.periodos?.find((x) => x.fecha === aaaammdd);
  if (p?.corta) return p.corta;
  const larga = etiquetaPeriodo(aaaammdd, meta);
  const [mes, anio] = larga.split(' ');
  return mes && anio ? `${mes.slice(0, 3)} ${anio}` : larga;
}

// Fecha y hora en hora de Panamá
export function fechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short' });
}

// Nombre bonito de un ranking: "CONSTRUCCION" → "Construcción"
const TITULOS = {
  HIPOTECARIO: 'Hipotecario', CONSTRUCCION: 'Construcción', INDUSTRIA: 'Industria',
  AGROPECUARIO: 'Agropecuario', COMERCIO: 'Comercio', CONSUMO: 'Consumo',
};
export function tituloRanking(nombre, meta) {
  const r = meta?.rankings?.find((x) => x.nombre === nombre);
  return r?.titulo || TITULOS[nombre] || nombre;
}

export const TIPOS_RANKING = {
  obligatorio: { texto: 'Obligatorio', clase: 'insignia-obligatorio' },
  recomendado: { texto: 'Recomendado', clase: 'insignia-recomendado' },
  bonus: { texto: 'Bonus', clase: 'insignia-bonus' },
};

// Cambio de posición: positivo = sube
export function cambioTexto(cambio) {
  if (cambio === null || cambio === undefined) return '—';
  if (cambio > 0) return `▲ ${cambio}`;
  if (cambio < 0) return `▼ ${Math.abs(cambio)}`;
  return '=';
}

export function claseCambio(cambio) {
  if (cambio === null || cambio === undefined || cambio === 0) return 'cambio-igual';
  return cambio > 0 ? 'cambio-sube' : 'cambio-baja';
}

// Número para ordenar o graficar a partir de un texto exacto
export function num(texto) {
  if (texto === null || texto === undefined || texto === '') return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}
