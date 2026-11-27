// Comparación entre períodos y movimientos de posición (Sección 8 de las indicaciones).
//   Cambio_Posicion = Posicion_anterior − Posicion_actual   (positivo = sube)
//   Var_Saldo       = Saldo_actual − Saldo_anterior
//   Var_Saldo_Pct   = Var_Saldo / Saldo_anterior × 100      (null si el saldo anterior es 0)
// Qué es un «movimiento significativo» lo decide una regla CONFIGURABLE (parámetros).
import { porcentaje4, diezmilesimas } from './dinero.js';

export const PARAMETROS_POR_DEFECTO = Object.freeze({
  mov_min_posiciones: 2,      // |Cambio_Posicion| >= N
  mov_cambio_lider: true,     // un nuevo líder (o la pérdida del liderazgo) siempre es significativo
  mov_var_saldo_pct: '15.00', // |Var_Saldo_Pct| >= X %
});

/** Valida y normaliza los parámetros que llegan del administrador. Lanza Error con mensaje claro. */
export function normalizarParametros(p) {
  const n = Number(p?.mov_min_posiciones);
  if (!Number.isInteger(n) || n < 1 || n > 11) throw new Error('mov_min_posiciones debe ser un entero entre 1 y 11.');
  const pct = String(p?.mov_var_saldo_pct ?? '').trim();
  const d = diezmilesimas(pct);
  if (d === null || d < 0 || d > 10000000) throw new Error('mov_var_saldo_pct debe ser un porcentaje entre 0 y 1000 (por ejemplo «15.00»).');
  return {
    mov_min_posiciones: n,
    mov_cambio_lider: p?.mov_cambio_lider === true || p?.mov_cambio_lider === 'true',
    mov_var_saldo_pct: (d / 10000).toFixed(2),
  };
}

const formato1 = new Intl.NumberFormat('es-PA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const millones = (c) => `${formato1.format(c / 1e8)} M`;
const pct1 = (p) => `${formato1.format(Math.abs(Number(p)))} %`;
const lugar = (n) => (n === 1 ? '1.er' : `${n}.º`);

/**
 * Compara dos resultados de período (anterior → actual) para todos los rankings.
 * Devuelve { desde, hasta, regla, filas, explicaciones } con explicaciones deterministas (sin IA).
 */
export function compararPeriodos(anterior, actual, cat, parametros = PARAMETROS_POR_DEFECTO) {
  const regla = { ...parametros };
  const umbralPct = diezmilesimas(regla.mov_var_saldo_pct);
  const filas = [];
  const explicaciones = [];
  for (const r of cat.rankings) {
    const previo = new Map(anterior.rankings[r.nombre].map((f) => [f.codigo_banco, f]));
    const liderPrevio = anterior.rankings[r.nombre][0];
    const liderActual = actual.rankings[r.nombre][0];
    for (const f of actual.rankings[r.nombre]) {
      const p = previo.get(f.codigo_banco);
      const cambio = p.posicion - f.posicion;
      const varSaldo = f.saldo_actividad - p.saldo_actividad;
      const varPct = porcentaje4(varSaldo, p.saldo_actividad);
      const motivos = [];
      if (Math.abs(cambio) >= regla.mov_min_posiciones) motivos.push(cambio > 0 ? `Sube ${cambio} posiciones` : `Baja ${-cambio} posiciones`);
      if (regla.mov_cambio_lider && f.posicion === 1 && p.posicion !== 1) motivos.push('Nuevo líder');
      if (regla.mov_cambio_lider && p.posicion === 1 && f.posicion !== 1) motivos.push('Pierde el liderazgo');
      if (varPct !== null && Math.abs(diezmilesimas(varPct)) >= umbralPct) motivos.push(`Saldo ${varSaldo >= 0 ? '+' : '−'}${pct1(varPct)}`);
      const fila = {
        fecha_anterior: anterior.fecha, fecha_actual: actual.fecha, ranking: r.nombre,
        codigo_banco: f.codigo_banco, banco: f.banco,
        posicion_anterior: p.posicion, posicion_actual: f.posicion, cambio,
        saldo_anterior: p.saldo_actividad, saldo_actual: f.saldo_actividad,
        var_saldo: varSaldo, var_saldo_pct: varPct,
        significativo: motivos.length > 0, motivos,
      };
      filas.push(fila);
      if (fila.significativo) explicaciones.push(explicar(fila, r, liderPrevio, liderActual, anterior, actual));
    }
  }
  explicaciones.sort((a, b) => b.peso - a.peso || a.ranking.localeCompare(b.ranking));
  return { desde: anterior.fecha, hasta: actual.fecha, regla, filas, explicaciones };
}

/** Redacta en español, sin IA, por qué un movimiento es relevante. */
function explicar(f, r, liderPrevio, liderActual, anterior, actual) {
  const variacion = f.var_saldo_pct === null
    ? `empieza con saldo ${millones(f.saldo_actual)}`
    : `su saldo ${f.var_saldo >= 0 ? 'crece' : 'cae'} ${pct1(f.var_saldo_pct)} (${millones(f.saldo_anterior)} → ${millones(f.saldo_actual)})`;
  const antes = new Map(anterior.rankings[r.nombre].map((x) => [x.codigo_banco, x.posicion]));
  const cruzados = actual.rankings[r.nombre].filter((x) => x.codigo_banco !== f.codigo_banco && (
    f.cambio > 0
      ? antes.get(x.codigo_banco) < f.posicion_anterior && x.posicion > f.posicion_actual
      : antes.get(x.codigo_banco) > f.posicion_anterior && x.posicion < f.posicion_actual)).map((x) => x.banco);
  const nombres = (xs) => (xs.length <= 2 ? xs.join(' y ') : `${xs.slice(0, 2).join(', ')} y ${xs.length - 2} más`);

  let tipo, peso, texto;
  if (f.posicion_actual === 1 && f.posicion_anterior !== 1) {
    tipo = 'lider'; peso = 1000;
    texto = `Nuevo líder en ${r.titulo}: ${f.banco} pasa del ${lugar(f.posicion_anterior)} al 1.er lugar y desplaza a ${liderPrevio.banco}; ${variacion}.`;
  } else if (f.posicion_anterior === 1 && f.posicion_actual !== 1) {
    tipo = 'baja'; peso = 900;
    texto = `${f.banco} pierde el liderazgo de ${r.titulo} frente a ${liderActual.banco} y queda en el ${lugar(f.posicion_actual)} lugar; ${variacion}.`;
  } else if (f.cambio !== 0) {
    tipo = f.cambio > 0 ? 'sube' : 'baja'; peso = 100 + Math.abs(f.cambio) * 10;
    const cruce = cruzados.length ? ` ${f.cambio > 0 ? 'Supera a' : 'Lo superan'} ${nombres(cruzados)}.` : '';
    texto = `${f.banco} ${f.cambio > 0 ? 'sube' : 'baja'} del ${lugar(f.posicion_anterior)} al ${lugar(f.posicion_actual)} lugar en ${r.titulo} (${f.cambio > 0 ? '+' : ''}${f.cambio}); ${variacion}.${cruce}`;
  } else {
    tipo = 'saldo'; peso = Math.min(99, Math.abs(Number(f.var_saldo_pct ?? 0)));
    texto = `${f.banco} mantiene el ${lugar(f.posicion_actual)} lugar en ${r.titulo}, pero ${variacion}.`;
  }
  return { tipo, peso, ranking: r.nombre, codigo_banco: f.codigo_banco, texto };
}
