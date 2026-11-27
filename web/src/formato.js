// Formatos de presentación (es-PA: punto decimal, coma de miles). Los montos llegan como texto exacto.
const dos = new Intl.NumberFormat('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uno = new Intl.NumberFormat('es-PA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const entero = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 0 });

export const dinero = (t) => (t === null || t === undefined ? '—' : dos.format(Number(t)));
/** Millones con un decimal: "448.1 M". */
export const millones = (t) => (t === null || t === undefined ? '—' : `${uno.format(Number(t) / 1e6)} M`);
export const numero = (n) => (n === null || n === undefined ? '—' : entero.format(n));
export const pct = (t, d = 2) => (t === null || t === undefined ? '—' : `${Number(t).toFixed(d)} %`);
export const pctSigno = (t, d = 1) => (t === null || t === undefined ? '—' : `${Number(t) > 0 ? '+' : ''}${Number(t).toFixed(d)} %`);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const mes = (f) => (f ? `${MESES[Number(f.slice(4, 6)) - 1]} ${f.slice(0, 4)}` : '—');
export const mesCorto = (f) => (f ? `${MESES[Number(f.slice(4, 6)) - 1].slice(0, 3)} ${f.slice(2, 4)}` : '—');
export const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-PA', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export const escaparHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Paleta de datos (validada: categórica en orden fijo, secuencial azul, tinta de texto)
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const AZUL = { 100: '#cde2fb', 150: '#b7d3f6', 200: '#9ec5f4', 250: '#86b6ef', 300: '#6da7ec', 400: '#3987e5', 450: '#2a78d6', 500: '#256abf', 550: '#1c5cab', 600: '#184f95', 650: '#104281', 700: '#0d366b' };
export const TINTA = { primaria: '#0b0b0b', secundaria: '#52514e', tenue: '#898781', rejilla: '#e1e0d9', eje: '#c3c2b7', superficie: '#fcfcfb', gris: '#c9c8c1' };
