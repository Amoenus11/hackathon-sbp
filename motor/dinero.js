// Aritmética exacta para montos.
//
// Los montos se convierten de texto a CENTAVOS ENTEROS sin pasar nunca por punto flotante
// ("84556.97" → 8455697). Se suman como enteros de JavaScript, que son exactos hasta 2^53
// (≈ 90 billones de unidades monetarias); cada suma se vigila con Number.isSafeInteger.
// Los porcentajes, que multiplican por 10^6, se calculan con BigInt.

const PATRON_MONTO = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** Texto → centavos enteros. Devuelve null si el texto no es un monto válido con hasta 2 decimales. */
export function centavos(texto) {
  const m = PATRON_MONTO.exec(texto);
  if (!m) return null;
  const valor = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(valor)) return null;
  return m[1] === '-' ? -valor : valor;
}

/** Suma segura de centavos: lanza error si el resultado deja de ser exacto. */
export function sumar(a, b) {
  const r = a + b;
  if (!Number.isSafeInteger(r)) throw new RangeError('Suma de montos fuera del rango exacto.');
  return r;
}

/** Centavos → texto con 2 decimales, sin separador de miles ("1234.50", "-0.05"). */
export function monto(c) {
  const signo = c < 0 ? '-' : '';
  const v = Math.abs(c);
  return `${signo}${Math.trunc(v / 100)}.${String(v % 100).padStart(2, '0')}`;
}

/**
 * parte / total × 100 con 4 decimales y redondeo aritmético (la mitad se aleja de cero).
 * Devuelve texto ("12.3456") o null si total es 0.
 */
export function porcentaje4(parte, total) {
  if (total === 0) return null;
  let p = BigInt(parte) * 1000000n; // ×100 (porcentaje) ×10^4 (4 decimales)
  let t = BigInt(total);
  if (t < 0n) { p = -p; t = -t; }
  const negativo = p < 0n;
  if (negativo) p = -p;
  const q = (2n * p + t) / (2n * t); // redondeo half-up sobre el valor absoluto
  if (q === 0n) return '0.0000';
  const s = q.toString().padStart(5, '0');
  return `${negativo ? '-' : ''}${s.slice(0, -4)}.${s.slice(-4)}`;
}

/**
 * Porcentaje en texto ("12.3456", "15", "-2.5") → diezmilésimas enteras (123456, 150000, -25000),
 * sin pasar por float. Sirve para comparar contra umbrales. Devuelve null si no es un número.
 */
export function diezmilesimas(p) {
  const m = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(String(p ?? '').trim());
  if (!m) return null;
  const v = Number(m[2]) * 10000 + Number((m[3] ?? '').padEnd(4, '0'));
  return m[1] === '-' ? -v : v;
}
