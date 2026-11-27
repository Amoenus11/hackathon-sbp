// Pruebas del motor: reglas del reto con casos pequeños hechos a mano y propiedades sobre los datos reales.
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerCatalogos, procesarCarpeta } from '../motor/cargar.js';
import { procesarArchivo, compararPeriodos, anatomiaDelCambio, ORDEN_RANKINGS, ErrorDatos } from '../motor/motor.js';
import { aCentavos, aTexto, porcentaje } from '../motor/dinero.js';
import { escribirCsv } from '../motor/csv.js';

const catalogos = leerCatalogos('datos/reto');

// Arma un AT03 mínimo con las 61 columnas del diccionario; cada fila parte de valores válidos.
function at03(filas) {
  const base = Object.fromEntries(catalogos.columnas.map((c) => [c, 'NA']));
  Object.assign(base, { Fecha: '20260731', Codigo_Banco: '101', Destino: 'L', Saldo: '100.00', Tipo_Actividad: 'L.68.681.6810.00000', Facilidad_Crediticia: '01', Dias_Mora: '0' });
  return escribirCsv(catalogos.columnas, filas.map((f, k) => ({ ...base, Numero_Prestamo: `P${k}`, ...f })));
}

test('dinero: centavos exactos y redondeo aritmético a 4 decimales', () => {
  assert.equal(aCentavos('1234.5'), 123450n);
  assert.equal(aCentavos('-0.07'), -7n);
  assert.equal(aCentavos('12,5'), null);
  assert.equal(aTexto(-123456n), '-1234.56');
  assert.equal(porcentaje(1n, 3n), '33.3333');
  assert.equal(porcentaje(2n, 3n), '66.6667');
  assert.equal(porcentaje(1n, 8n), '12.5000');
  assert.equal(porcentaje(1n, 200000n), '0.0005'); // 0.0005 exacto
  assert.equal(porcentaje(1n, 2000000n), '0.0001'); // 0.00005 → sube a 0.0001 (mitad hacia arriba)
  assert.equal(porcentaje(5n, 0n), null);
});

test('cascada E1→E4: cada fila cuenta una sola vez, en el primer filtro que incumple', () => {
  const [p] = procesarArchivo(at03([
    { Numero_Prestamo: 'A', Destino: 'E' },                 // primera aparición de A (extranjera) → E2
    { Numero_Prestamo: 'A' },                               // duplicado de A → E1 aunque sea local
    { Numero_Prestamo: 'B', Destino: 'E', Saldo: '-5.00' }, // extranjera y negativa → solo E2
    { Numero_Prestamo: 'C', Saldo: '0.00' },                // E3
    { Numero_Prestamo: 'D', Tipo_Actividad: 'Z.99.999.9999.99999' }, // E4
    { Numero_Prestamo: 'E', Destino: 'l' },                 // «l» minúscula no es «L» → E2
    { Numero_Prestamo: 'F' },                               // válida
  ]), 'prueba.csv', catalogos);
  assert.deepEqual(p.cascada, { E1: 1, E2: 3, E3: 1, E4: 1 });
  assert.equal(p.universo, 1);
  assert.equal(p.filas_leidas, 7);
  assert.ok(p.cuadra);
  assert.deepEqual(p.independientes, { E1: 1, E2: 3, E3: 2, E4: 1 }); // conteo independiente, rotulado aparte
});

test('regla SB21: crédito personal con facilidad 07 pasa a Tarjeta sin cambiar el total de CONSUMO', () => {
  const [p] = procesarArchivo(at03([
    { Tipo_Actividad: 'K.64.649.6492.64921', Facilidad_Crediticia: '07', Saldo: '300.00' },
    { Tipo_Actividad: 'K.64.649.6492.64921', Facilidad_Crediticia: '01', Saldo: '200.00' },
    { Tipo_Actividad: 'K.64.649.6499.64991', Facilidad_Crediticia: '02', Saldo: '50.00' }, // incoherente: alerta, sigue en Tarjeta
  ]), 'prueba.csv', catalogos);
  const consumo = p.desglose.CONSUMO.filter((f) => f.codigo_banco === '101');
  const sub = (n) => consumo.find((f) => f.subactividad === n);
  assert.equal(sub('Tarjeta').saldo, 35000n);
  assert.equal(sub('Credito personal').saldo, 20000n);
  assert.equal(sub('Tarjeta').reclasificadas_sb21, 1);
  assert.equal(p.rankings.CONSUMO.find((f) => f.codigo_banco === '101').saldo_actividad, 55000n);
  assert.ok(p.alertas.some((a) => a.tipo === 'consumo_incoherente'));
});

test('ranking: siempre 12 bancos, desempate por Codigo_Banco y ponderación con el denominador correcto', () => {
  const [p] = procesarArchivo(at03([
    { Codigo_Banco: '105', Saldo: '500.00' },
    { Codigo_Banco: '103', Saldo: '500.00' },
    { Codigo_Banco: '103', Saldo: '1500.00', Tipo_Actividad: 'G.46.469.4690.46900' }, // COMERCIO
  ]), 'prueba.csv', catalogos);
  const h = p.rankings.HIPOTECARIO;
  assert.equal(h.length, 12);
  assert.deepEqual(h.slice(0, 2).map((f) => f.codigo_banco), ['103', '105']); // empate → 103 primero
  assert.equal(h[0].ponderacion_pct, '25.0000'); // 500 / (500 + 1500)
  assert.equal(h[2].saldo_actividad, 0n);
  assert.deepEqual(h.map((f) => f.posicion), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('archivo inválido: mensaje claro, sin procesar nada', () => {
  assert.throws(() => procesarArchivo('a,b\n1,2\n', 'x.csv', catalogos), ErrorDatos);
  assert.throws(() => procesarArchivo(at03([{ Fecha: '2026-07-31' }]), 'x.csv', catalogos), /Fecha inválida/);
});

// ---------------------------------------------------------------- datos reales del reto
const periodos = procesarCarpeta('datos/reto', catalogos);

test('datos reales: 3 períodos, identidad de la cascada y reconciliaciones al centavo', () => {
  assert.deepEqual(periodos.map((p) => p.fecha), ['20260731', '20260831', '20260930']);
  for (const p of periodos) {
    const { E1, E2, E3, E4 } = p.cascada;
    assert.equal(E1 + E2 + E3 + E4 + p.universo, p.filas_leidas, p.fecha);
    for (const r of p.reconciliaciones) assert.ok(r.ok, `${p.fecha} ${r.id}`);
  }
});

test('datos reales: rankings completos, denominador único y ponderaciones que suman ~100', () => {
  for (const p of periodos) {
    for (const macro of ORDEN_RANKINGS) {
      const posiciones = p.rankings[macro].map((f) => f.posicion);
      assert.deepEqual(posiciones, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      for (let k = 1; k < 12; k++) assert.ok(p.rankings[macro][k - 1].saldo_actividad >= p.rankings[macro][k].saldo_actividad);
    }
    for (const b of catalogos.bancos) {
      const filas = ORDEN_RANKINGS.map((m) => p.rankings[m].find((f) => f.codigo_banco === b.codigo));
      assert.equal(new Set(filas.map((f) => f.total_cartera)).size, 1, 'mismo denominador en los 6 rankings');
      const suma = filas.reduce((s, f) => s + Number(f.ponderacion_pct), 0);
      assert.ok(Math.abs(suma - 100) <= 0.0006, `${p.fecha} ${b.codigo}: ${suma}`);
    }
  }
});

test('automatización: un período nuevo se calcula y compara sin tocar el código', () => {
  const [jul, ago, sep] = periodos;
  const c = compararPeriodos(ago, sep, { mov_min_posiciones: 2, mov_cambio_lider: true, mov_var_saldo_pct: '15.00' });
  assert.equal(c.filas.length, 6 * 12);
  for (const f of c.filas) assert.equal(f.cambio, f.posicion_anterior - f.posicion_actual);
  // La regla es configurable: con un umbral imposible no hay movimientos por saldo
  const estricta = compararPeriodos(jul, ago, { mov_min_posiciones: 12, mov_cambio_lider: false, mov_var_saldo_pct: '1000' });
  assert.equal(estricta.filas.filter((f) => f.significativo).length, 0);
});

test('anatomía del cambio: saldo anterior + nuevos − terminados + variación = saldo actual, al centavo', () => {
  for (let k = 1; k < periodos.length; k++) {
    const [antes, ahora] = [periodos[k - 1], periodos[k]];
    const anatomia = anatomiaDelCambio(antes, ahora);
    for (const macro of ORDEN_RANKINGS) {
      for (const b of catalogos.bancos) {
        const a = anatomia(macro, b.codigo);
        const saldoAntes = antes.rankings[macro].find((f) => f.codigo_banco === b.codigo).saldo_actividad;
        const saldoAhora = ahora.rankings[macro].find((f) => f.codigo_banco === b.codigo).saldo_actividad;
        assert.equal(saldoAntes + a.nuevos - a.terminados + a.variacion, saldoAhora, `${ahora.fecha} ${macro} ${b.codigo}`);
      }
    }
  }
});
