// Aritmética exacta: todos los montos se manejan como centavos enteros (BigInt).
// Así una suma de miles de saldos nunca pierde un centavo (el punto flotante sí puede).

const MONTO = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** "1234.5" → 123450n. Devuelve null si el texto no es un monto válido. */
export function aCentavos(texto) {
  const m = MONTO.exec(String(texto).trim());
  if (!m) return null;
  const centavos = BigInt(m[2]) * 100n + BigInt((m[3] || '').padEnd(2, '0') || '0');
  return m[1] === '-' ? -centavos : centavos;
}

/** 123450n → "1234.50" (sin separador de miles, punto decimal). */
export function aTexto(centavos) {
  const negativo = centavos < 0n;
  const v = negativo ? -centavos : centavos;
  const entero = v / 100n;
  const resto = (v % 100n).toString().padStart(2, '0');
  return `${negativo ? '-' : ''}${entero}.${resto}`;
}

/**
 * Porcentaje exacto con 4 decimales y redondeo aritmético (la mitad se aleja de cero):
 * pct(parte, total) = parte / total × 100, devuelto como texto "12.3456".
 */
export function porcentaje(parte, total) {
  if (total === 0n) return null;
  // parte/total×100 con 4 decimales  =  round(parte × 10^6 / total) / 10^4
  let num = parte * 1000000n;
  let den = total;
  if (den < 0n) { num = -num; den = -den; }
  const negativo = num < 0n;
  if (negativo) num = -num;
  const redondeado = (num * 2n + den) / (den * 2n); // mitad hacia arriba sobre el valor absoluto
  const entero = redondeado / 10000n;
  const dec = (redondeado % 10000n).toString().padStart(4, '0');
  const signo = negativo && redondeado !== 0n ? '-' : '';
  return `${signo}${entero}.${dec}`;
}

/** Comparación para ordenar BigInt de mayor a menor. */
export const mayorPrimero = (a, b) => (a > b ? -1 : a < b ? 1 : 0);
