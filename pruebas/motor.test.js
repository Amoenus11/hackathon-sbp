// Pruebas del motor de rankings: reglas del reto con casos pequeños hechos a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cat, fila, csvAt03, CINU } from './ayuda.js';
import { procesarAt03 } from '../motor/periodo.js';
import { compararPeriodos, normalizarParametros, PARAMETROS_POR_DEFECTO } from '../motor/comparacion.js';
import { centavos, monto, porcentaje4, diezmilesimas } from '../motor/dinero.js';
import { analizarCsv } from '../motor/csv.js';
import { ErrorValidacion } from '../motor/catalogos.js';

const procesar = (filas, nombre = 'AT03_prueba.csv') => procesarAt03(csvAt03(filas), nombre, cat);
const uno = (filas) => procesar(filas)[0];
const posicion = (p, ranking, banco) => p.rankings[ranking].find((f) => f.codigo_banco === banco);

test('dinero: texto ↔ centavos exactos, sin punto flotante', () => {
  assert.equal(centavos('84556.97'), 8455697);
  assert.equal(centavos('0.1'), 10);
  assert.equal(centavos('-802.93'), -80293);
  assert.equal(centavos('12'), 1200);
  assert.equal(centavos('1.234'), null);
  assert.equal(centavos('abc'), null);
  assert.equal(monto(8455697), '84556.97');
  assert.equal(monto(-5), '-0.05');
  // 0.1 + 0.2 en float da 0.30000000000000004; en centavos es exacto
  assert.equal(monto(centavos('0.10') + centavos('0.20')), '0.30');
});

test('ponderación: 4 decimales con redondeo aritmético (mitad hacia arriba)', () => {
  assert.equal(porcentaje4(1, 3), '33.3333');
  assert.equal(porcentaje4(2, 3), '66.6667');
  assert.equal(porcentaje4(1, 128), '0.7813'); // 0.78125 → 0.7813 (no 0.7812 «del banquero»)
  assert.equal(porcentaje4(3, 128), '2.3438'); // 2.34375 → 2.3438
  assert.equal(porcentaje4(5, 5), '100.0000');
  assert.equal(porcentaje4(0, 5), '0.0000');
  assert.equal(porcentaje4(5, 0), null);
  assert.equal(porcentaje4(-1, 128), '-0.7813');
  assert.equal(diezmilesimas('15.00'), 150000);
  assert.equal(diezmilesimas('-2.5'), -25000);
});

test('CSV: los códigos se leen como texto y conservan ceros a la izquierda; BOM y comillas', () => {
  const { encabezado, filas } = analizarCsv('﻿a,b,c\r\n07,001,"x, ""y"""\r\n');
  assert.deepEqual(encabezado, ['a', 'b', 'c']);
  assert.deepEqual(filas[0], ['07', '001', 'x, "y"']);
});

test('cascada E1→E4: cada fila cuenta una sola vez, en el primer filtro que incumple', () => {
  const p = uno([
    fila({ Numero_Prestamo: 'P1' }),                                   // válida
    fila({ Numero_Prestamo: 'P1', Saldo: '50.00' }),                   // E1 (duplicado; gana la primera)
    fila({ Destino: 'E', Saldo: '-5.00' }),                            // E2 (aunque también tiene saldo negativo)
    fila({ Destino: 'l' }),                                            // E2 (comparación exacta: «l» ≠ «L»)
    fila({ Saldo: '0.00' }),                                           // E3
    fila({ Saldo: '-1.00', Tipo_Actividad: 'X.00.000.0000.00000' }),   // E3 (aunque tampoco está catalogada)
    fila({ Tipo_Actividad: 'X.00.000.0000.00000' }),                   // E4
    fila({ Numero_Prestamo: 'P2', Destino: 'E' }),                     // E2
    fila({ Numero_Prestamo: 'P2' }),                                   // E1: la primera aparición fue extranjera
  ]);
  assert.deepEqual(p.cascada, { E1: 2, E2: 3, E3: 2, E4: 1 });
  assert.equal(p.universo, 1);
  assert.equal(p.filas_leidas, p.cascada.E1 + p.cascada.E2 + p.cascada.E3 + p.cascada.E4 + p.universo);
  assert.equal(p.cuadra, true);
  assert.equal(p.saldo_universo, 10000); // se conservó la PRIMERA aparición de P1 (100.00), no la segunda
  assert.deepEqual(p.independientes, { E1: 2, E2: 3, E3: 3, E4: 2 }); // conteo de cada regla por separado
  assert.deepEqual(p.excluidas.map((e) => e.filtro), ['E1', 'E2', 'E2', 'E3', 'E3', 'E4', 'E2', 'E1']);
  assert.equal(p.excluidas[0].fila, 2);
});

test('regla SB21: Crédito personal con facilidad 07 pasa a Tarjeta y el total de CONSUMO no cambia', () => {
  const p = uno([
    fila({ Codigo_Banco: '105', Tipo_Actividad: CINU.personal, Facilidad_Crediticia: '07', Saldo: '300.00' }),
    fila({ Codigo_Banco: '105', Tipo_Actividad: CINU.personal, Facilidad_Crediticia: '7', Saldo: '40.00' }), // «7» no es «07»
    fila({ Codigo_Banco: '105', Tipo_Actividad: CINU.personal, Facilidad_Crediticia: '02', Saldo: '200.00' }),
    fila({ Codigo_Banco: '105', Tipo_Actividad: CINU.tarjeta, Facilidad_Crediticia: '07', Saldo: '100.00' }),
    fila({ Codigo_Banco: '105', Tipo_Actividad: CINU.tarjeta, Facilidad_Crediticia: '01', Saldo: '10.00' }), // alerta
    fila({ Codigo_Banco: '105', Tipo_Actividad: CINU.auto, Facilidad_Crediticia: '03', Saldo: '50.00' }),
  ]);
  const subs = Object.fromEntries(p.desglose.CONSUMO.filter((d) => d.codigo_banco === '105').map((d) => [d.subactividad, d.saldo]));
  assert.equal(subs['Credito personal'], 24000);
  assert.equal(subs.Tarjeta, 41000);
  assert.equal(subs.Automovil, 5000);
  assert.equal(posicion(p, 'CONSUMO', '105').saldo_actividad, 70000);
  assert.equal(p.reclasificadas_sb21, 1);
  assert.ok(p.alertas.some((a) => a.tipo === 'consumo_incoherente' && a.cantidad === 1));
  assert.ok(p.alertas.some((a) => a.tipo === 'facilidad_desconocida')); // «7» no está en SB21
  assert.ok(p.reconciliaciones.every((r) => r.ok));
});

test('ranking: siempre 12 bancos, posiciones 1..12, desempate por Codigo_Banco ascendente', () => {
  const p = uno([
    fila({ Codigo_Banco: '107', Saldo: '500.00' }),
    fila({ Codigo_Banco: '103', Saldo: '500.00' }), // empata con 107 → va antes por código
    fila({ Codigo_Banco: '110', Saldo: '900.00' }),
  ]);
  const h = p.rankings.HIPOTECARIO;
  assert.equal(h.length, 12);
  assert.deepEqual(h.map((f) => f.posicion), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(h.slice(0, 3).map((f) => f.codigo_banco), ['110', '103', '107']);
  // Bancos sin saldo: 0.00, ordenados por código
  assert.deepEqual(h.slice(3).map((f) => f.codigo_banco), ['101', '102', '104', '105', '106', '108', '109', '111', '112']);
  assert.equal(h[3].saldo_actividad, 0);
  assert.equal(h[3].ponderacion_pct, '0.0000');
});

test('ponderación: el denominador es TODA la cartera válida del banco, igual en los 6 rankings', () => {
  const p = uno([
    fila({ Codigo_Banco: '101', Tipo_Actividad: CINU.vivienda, Saldo: '100.00' }),
    fila({ Codigo_Banco: '101', Tipo_Actividad: CINU.infraestructura, Saldo: '200.00' }),
    fila({ Codigo_Banco: '101', Tipo_Actividad: CINU.auto, Facilidad_Crediticia: '03', Saldo: '100.00' }),
  ]);
  const totales = new Set(cat.rankings.map((r) => posicion(p, r.nombre, '101').total_cartera));
  assert.deepEqual([...totales], [40000]);
  assert.equal(posicion(p, 'HIPOTECARIO', '101').ponderacion_pct, '25.0000');
  assert.equal(posicion(p, 'CONSTRUCCION', '101').ponderacion_pct, '50.0000');
  assert.equal(posicion(p, 'CONSUMO', '101').ponderacion_pct, '25.0000');
});

test('el período sale del campo Fecha, no del nombre del archivo; un archivo puede traer varios', () => {
  const ps = procesar([fila({ Fecha: '20260831' }), fila({ Fecha: '20260731' })], 'AT03_sintetico_202609.csv');
  assert.deepEqual(ps.map((p) => p.fecha), ['20260731', '20260831']);
  // Un préstamo presente en dos meses NO es duplicado
  const dos = procesar([fila({ Fecha: '20260731', Numero_Prestamo: 'Z' }), fila({ Fecha: '20260831', Numero_Prestamo: 'Z' })]);
  assert.ok(dos.every((p) => p.cascada.E1 === 0 && p.universo === 1));
});

test('esquema: rechaza archivos con columnas de menos, de más o en otro orden, con mensaje claro', () => {
  const columnas = [...cat.columnas];
  assert.throws(() => procesarAt03(csvAt03([fila()], columnas.slice(1)), 'malo.csv', cat), ErrorValidacion);
  const desordenadas = [columnas[1], columnas[0], ...columnas.slice(2)];
  assert.throws(() => procesarAt03(csvAt03([fila()], desordenadas), 'malo.csv', cat), (e) => e instanceof ErrorValidacion && /orden/.test(e.detalles.join(' ')));
  assert.throws(() => procesarAt03(csvAt03([fila({ Fecha: '2026-07-31' })]), 'malo.csv', cat), /Fecha inválida/);
  assert.throws(() => procesarAt03('', 'vacio.csv', cat), /vacío/);
});

test('movimientos: Cambio_Posicion = anterior − actual y la regla de significancia es configurable', () => {
  const [jul, ago] = procesar([
    fila({ Fecha: '20260731', Codigo_Banco: '101', Saldo: '300.00' }),
    fila({ Fecha: '20260731', Codigo_Banco: '102', Saldo: '200.00' }),
    fila({ Fecha: '20260731', Codigo_Banco: '103', Saldo: '100.00' }),
    fila({ Fecha: '20260831', Codigo_Banco: '101', Saldo: '150.00' }),
    fila({ Fecha: '20260831', Codigo_Banco: '102', Saldo: '200.00' }),
    fila({ Fecha: '20260831', Codigo_Banco: '103', Saldo: '400.00' }),
  ]);
  const c = compararPeriodos(jul, ago, cat, PARAMETROS_POR_DEFECTO);
  const de = (b) => c.filas.find((f) => f.ranking === 'HIPOTECARIO' && f.codigo_banco === b);
  assert.equal(de('103').cambio, 2);   // 3.º → 1.º: sube
  assert.equal(de('101').cambio, -2);  // 1.º → 3.º: baja
  assert.equal(de('103').var_saldo, 30000);
  assert.equal(de('103').var_saldo_pct, '300.0000');
  assert.equal(de('101').var_saldo_pct, '-50.0000');
  assert.ok(de('103').motivos.includes('Nuevo líder'));
  assert.equal(de('102').significativo, false);
  assert.equal(de('104').var_saldo_pct, null); // saldo anterior 0
  assert.equal(c.explicaciones[0].tipo, 'lider');
  // Con un umbral de 3 posiciones y sin regla de líder ni de saldo, nada es significativo
  const estricta = compararPeriodos(jul, ago, cat, normalizarParametros({ mov_min_posiciones: 3, mov_cambio_lider: false, mov_var_saldo_pct: '1000' }));
  assert.equal(estricta.filas.filter((f) => f.significativo).length, 0);
  assert.throws(() => normalizarParametros({ mov_min_posiciones: 0, mov_var_saldo_pct: '10' }));
});
