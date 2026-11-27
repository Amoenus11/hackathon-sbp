// Pruebas sobre los 3 cortes reales del paquete: invariantes de la Sección 12 (lista de autoverificación).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cat, DATOS, RAIZ } from './ayuda.js';
import { procesarCarpeta } from '../motor/cargar.js';
import { compararPeriodos } from '../motor/comparacion.js';
import { diezmilesimas } from '../motor/dinero.js';

const periodos = procesarCarpeta(DATOS, cat);
// Cifras de control publicadas por la verificación independiente del equipo (verificacion/README.md).
// NO las usa la aplicación: solo sirven aquí para detectar regresiones.
const control = JSON.parse(readFileSync(join(RAIZ, 'pruebas', 'control-equipo.json'), 'utf8'));

test('se procesan los 3 períodos, identificados por el campo Fecha', () => {
  assert.deepEqual(periodos.map((p) => p.fecha), ['20260731', '20260831', '20260930']);
});

for (const p of periodos) {
  test(`${p.fecha}: cascada, universo y reconciliaciones`, () => {
    assert.equal(p.filas_leidas, p.cascada.E1 + p.cascada.E2 + p.cascada.E3 + p.cascada.E4 + p.universo);
    for (const r of p.reconciliaciones) assert.ok(r.ok, `${r.id} no cuadra: ${r.nombre}`);
    assert.ok(p.esquema.ok);
    const esperado = control[p.fecha];
    assert.deepEqual({ ...p.cascada, universo: p.universo }, esperado.cascada);
    assert.equal(String(p.saldo_universo), esperado.saldo_universo_centavos);
  });

  test(`${p.fecha}: cada ranking tiene 12 bancos, posiciones sin huecos y orden correcto`, () => {
    for (const r of cat.rankings) {
      const filas = p.rankings[r.nombre];
      assert.equal(filas.length, 12);
      assert.deepEqual(filas.map((f) => f.posicion), Array.from({ length: 12 }, (_, k) => k + 1));
      for (let k = 1; k < filas.length; k++) {
        const a = filas[k - 1], b = filas[k];
        assert.ok(a.saldo_actividad > b.saldo_actividad || (a.saldo_actividad === b.saldo_actividad && a.codigo_banco < b.codigo_banco));
      }
    }
  });

  test(`${p.fecha}: el denominador es el mismo en los 6 rankings y las ponderaciones suman ~100`, () => {
    for (const b of cat.bancos) {
      const filas = cat.rankings.map((r) => p.rankings[r.nombre].find((f) => f.codigo_banco === b.codigo));
      assert.equal(new Set(filas.map((f) => f.total_cartera)).size, 1);
      const suma = filas.reduce((t, f) => t + diezmilesimas(f.ponderacion_pct), 0);
      assert.ok(Math.abs(suma - 1000000) <= 3, `${b.codigo}: las ponderaciones suman ${suma / 10000}`);
    }
  });
}

test('comparaciones julio→agosto y agosto→septiembre: 72 filas cada una', () => {
  const comps = periodos.slice(1).map((p, k) => compararPeriodos(periodos[k], p, cat));
  for (const c of comps) {
    assert.equal(c.filas.length, cat.rankings.length * cat.bancos.length);
    for (const f of c.filas) assert.equal(f.cambio, f.posicion_anterior - f.posicion_actual);
  }
});
