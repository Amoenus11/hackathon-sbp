// Pruebas de los casos límite que la revisión comparativa encontró sin cubrir:
// fechas imposibles, un mismo mes en dos archivos, banco desconocido (R3 que falla), morosidad según la SBP,
// saldo 0 en las comparaciones, catálogos repetidos y rechazos en la API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { leerCatalogos } from '../motor/cargar.js';
import {
  procesarArchivo, procesarArchivos, compararPeriodos, cargarCatalogos, fechaValida, estadoMora, ErrorDatos,
} from '../motor/motor.js';
import { escribirCsv } from '../motor/csv.js';
import { generar } from '../motor/exportar.js';
import { crearApp } from '../servidor/app.js';
import { huellaClave } from '../servidor/sesion.js';

const catalogos = leerCatalogos('datos/reto');
const HIPOTECARIO = 'L.68.681.6810.00000';

function at03(filas, fecha = '20260731') {
  const base = Object.fromEntries(catalogos.columnas.map((c) => [c, 'NA']));
  Object.assign(base, { Fecha: fecha, Codigo_Banco: '101', Destino: 'L', Saldo: '100.00', Tipo_Actividad: HIPOTECARIO, Facilidad_Crediticia: '01', Dias_Mora: '0' });
  return escribirCsv(catalogos.columnas, filas.map((f, k) => ({ ...base, Numero_Prestamo: `P${k}`, ...f })));
}

test('fecha: solo acepta fechas que existen en el calendario', () => {
  for (const ok of ['20260731', '20240229', '20261231']) assert.equal(fechaValida(ok), true, ok);
  for (const mal of ['20261331', '20260031', '20260230', '20250229', '2026-07-31', '2026073', '00000000']) assert.equal(fechaValida(mal), false, mal);
});

test('un archivo con mes 13 se rechaza con un mensaje que nombra el archivo, la fila y la fecha', () => {
  assert.throws(
    () => procesarArchivo(at03([{}, { Fecha: '20261331' }]), 'agosto.csv', catalogos),
    (e) => e instanceof ErrorDatos && /agosto\.csv/.test(e.message) && /fila 2/.test(e.message) && /20261331/.test(e.message),
  );
});

test('un mismo período en dos archivos se REÚNE: ninguno reemplaza en silencio al otro', () => {
  const a = at03([{ Numero_Prestamo: 'X1', Saldo: '100.00' }, { Numero_Prestamo: 'X2', Saldo: '200.00' }]);
  const b = at03([{ Numero_Prestamo: 'X3', Saldo: '300.00' }, { Numero_Prestamo: 'X1', Saldo: '999.00' }]); // X1 repetido entre archivos
  const [p, ...resto] = procesarArchivos([{ texto: a, nombre: 'a.csv' }, { texto: b, nombre: 'b.csv' }], catalogos);
  assert.equal(resto.length, 0);
  assert.equal(p.filas_leidas, 4);
  assert.deepEqual(p.archivos, ['a.csv', 'b.csv']);
  assert.equal(p.cascada.E1, 1); // el duplicado entre archivos también cuenta como E1
  assert.equal(p.universo, 3);
  assert.equal(p.saldo_universo, 60000n); // 100 + 200 + 300, y se conserva el X1 del primer archivo
  assert.match(p.excluidas[0].motivo, /se conserva la fila 1 de a\.csv/);
  assert.ok(p.cuadra);
});

test('banco desconocido: alerta, la fila se queda en el universo, R3 falla y Cuadra dice NO', () => {
  const [p] = procesarArchivo(at03([{ Codigo_Banco: '101', Saldo: '100.00' }, { Codigo_Banco: '999', Saldo: '50.00' }]), 'x.csv', catalogos);
  assert.equal(p.universo, 2);
  assert.ok(p.alertas.some((a) => a.tipo === 'banco_desconocido'));
  const r3 = p.reconciliaciones.find((r) => r.id === 'R3');
  assert.equal(r3.ok, false);
  assert.equal(p.cuadra, false);
  assert.equal(p.identidad_filas, true); // la identidad de filas sí se cumple; lo que falla es R3
  const calidad = generar.calidad([p]);
  assert.match(calidad, /,NO\r?\n?$/m);
  const alertas = generar.alertas([p]);
  assert.match(alertas, /banco_desconocido/);
  assert.match(alertas, /reconciliacion_R3/);
});

test('morosidad según el Acuerdo 4-2013 de la SBP: 30 → ni morosa ni vencida; 31–90 morosa; más de 90 vencida; sobregiro desde 31 vencida', () => {
  assert.equal(estadoMora(0, '01'), 'al_dia_o_menor');
  assert.equal(estadoMora(30, '01'), 'al_dia_o_menor');
  assert.equal(estadoMora(31, '01'), 'morosa');
  assert.equal(estadoMora(90, '01'), 'morosa');
  assert.equal(estadoMora(91, '01'), 'vencida');
  assert.equal(estadoMora(31, '04'), 'vencida'); // sobregiro contractual
  assert.equal(estadoMora(31, '05'), 'vencida'); // sobregiro ocasional
  assert.equal(estadoMora(30, '05'), 'al_dia_o_menor');
  const [p] = procesarArchivo(at03([
    { Dias_Mora: '0', Saldo: '100.00' }, { Dias_Mora: '15', Saldo: '200.00' }, { Dias_Mora: '45', Saldo: '300.00' },
    { Dias_Mora: '120', Saldo: '400.00' }, { Dias_Mora: '31', Saldo: '500.00', Facilidad_Crediticia: '04' },
  ]), 'x.csv', catalogos);
  assert.equal(p.indicadores.morosa, 30000n);          // solo los 45 días
  assert.equal(p.indicadores.vencida, 90000n);         // 120 días + sobregiro de 31
  assert.equal(p.indicadores.atraso, 140000n);         // todo lo que tiene algún día de atraso (informativo)
});

test('saldos con espacios o sin 2 decimales se normalizan sin cambiar el valor y dejan una alerta; los ambiguos se excluyen', () => {
  const [p] = procesarArchivo(at03([
    { Saldo: ' 500.00' }, { Saldo: '500' }, { Saldo: '250.50' }, { Saldo: '1e3' },
  ]), 'x.csv', catalogos);
  assert.equal(p.saldo_universo, 125050n); // 500 + 500 + 250.50
  assert.equal(p.cascada.E3, 1);           // «1e3» es ambiguo: saldo ilegible
  const normalizado = p.alertas.find((a) => a.tipo === 'saldo_normalizado');
  assert.equal(normalizado.cantidad, 2);
  assert.equal(normalizado.severidad, 'baja');
  assert.ok(p.alertas.some((a) => a.tipo === 'saldo_ilegible'));
  // Los datos reales no traen ninguno: no aparece la alerta.
  assert.ok(!procesarArchivo(at03([{ Saldo: '100.00' }]), 'y.csv', catalogos)[0].alertas.some((a) => a.tipo === 'saldo_normalizado'));
});

test('control C: se calcula de verdad y cuadra con tarjetas reclasificadas', () => {
  const [p] = procesarArchivo(at03([
    { Tipo_Actividad: 'K.64.649.6492.64921', Facilidad_Crediticia: '07', Saldo: '300.00' },
    { Tipo_Actividad: 'K.64.649.6492.64921', Facilidad_Crediticia: '01', Saldo: '200.00' },
  ]), 'x.csv', catalogos);
  const c = p.reconciliaciones.find((r) => r.id === 'C');
  assert.equal(c.ok, true);
  assert.equal(c.diferencias, 0);
});

test('catálogo CINU con códigos repetidos o columnas faltantes se rechaza', () => {
  const leer = (n) => readFileSync(join('datos/reto', n), 'utf8').replace(/^﻿/, '');
  const base = { sb21: leer('Tabla_SB21_simplificada.csv'), bancos: leer('Bancos_ficticios.csv'), diccionario: leer('Diccionario_datos_AT03_reto.csv') };
  const cinu = leer('Catalogo_CINU_SB109_reto.csv');
  const lineas = cinu.trim().split(/\r?\n/);
  assert.throws(() => cargarCatalogos({ ...base, cinu: `${cinu.trim()}\r\n${lineas[1]}\r\n` }), /repetidos/);
  assert.throws(() => cargarCatalogos({ ...base, cinu: 'Codigo_CINU,Descripcion\r\nA,B\r\n' }), /no tiene las columnas/);
});

// ---------------------------------------------------------------- comparación con saldo 0
function periodo(fecha, filas) { return procesarArchivo(at03(filas, fecha), `${fecha}.csv`, catalogos)[0]; }

test('saldo 0: entrar o salir de un sector se marca; un banco en 0 los dos meses no se mueve; los textos no salen cortados', () => {
  const antes = periodo('20260630', [{ Codigo_Banco: '101', Saldo: '1000.00' }, { Codigo_Banco: '102', Saldo: '500.00' }]);
  const despues = periodo('20260731', [{ Codigo_Banco: '101', Saldo: '1000.00' }, { Codigo_Banco: '103', Saldo: '2000.00' }]);
  const c = compararPeriodos(antes, despues);
  const hip = (cod) => c.filas.find((f) => f.ranking === 'HIPOTECARIO' && f.codigo_banco === cod);
  assert.ok(hip('103').motivos.includes('Entra al sector'));
  assert.ok(hip('102').motivos.includes('Sale del sector'));
  assert.ok(hip('101').motivos.includes('Pierde el liderazgo'));
  assert.ok(hip('103').motivos.includes('Nuevo líder'));
  for (const cod of ['104', '105', '106', '107', '108', '109', '110', '111', '112']) {
    assert.equal(hip(cod).significativo, false, `el banco ${cod} sigue en 0 y no debe marcarse`);
  }
  for (const e of c.explicaciones) {
    assert.ok(!/; \./.test(e.texto) && !/NaN|undefined|0\.0 M/.test(e.texto), `texto roto: ${e.texto}`);
  }
  assert.ok(c.explicaciones.some((e) => /pierde el liderazgo de Hipotecario frente a/.test(e.texto)));
  assert.ok(c.explicaciones.some((e) => /entra al sector con 2,000\.00/.test(e.texto)));
  assert.ok(c.explicaciones.some((e) => /su saldo no varió \(1,000\.00\)/.test(e.texto)));
  assert.equal(c.meses_entre, 1);
});

test('frente al sector: puntos porcentuales sobre la variación de todo el ranking, y meses entre períodos', () => {
  const antes = periodo('20260531', [{ Codigo_Banco: '101', Saldo: '1000.00' }, { Codigo_Banco: '102', Saldo: '1000.00' }]);
  const despues = periodo('20260731', [{ Codigo_Banco: '101', Saldo: '1200.00' }, { Codigo_Banco: '102', Saldo: '1000.00' }]);
  const c = compararPeriodos(antes, despues);
  const f = c.filas.find((x) => x.ranking === 'HIPOTECARIO' && x.codigo_banco === '101');
  assert.equal(f.var_saldo_pct, '20.0000');
  assert.equal(f.var_sector_pct, '10.0000'); // el sector pasó de 2000 a 2200
  assert.equal(f.var_vs_sector_pp, '10.0000');
  assert.equal(c.meses_entre, 2); // mayo → julio: falta junio
  assert.ok(c.resumen.var_p90_pct !== null);
});

// ---------------------------------------------------------------- API
let servidor;
let base;
const entorno = {
  USUARIO_1: `ana:analista:${huellaClave('clave-de-prueba-1')}`,
  USUARIO_2: `admin:administrador:${huellaClave('clave-de-prueba-2')}`,
  CARGA_INICIAL: 'julio-agosto',
};
before(async () => {
  const { app } = crearApp({ entorno, carpetaLocal: mkdtempSync(join(tmpdir(), 'syntropy-revision-')), carpetaWeb: 'no-existe' });
  await new Promise((r) => { servidor = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

const pedir = (ruta, { cookie, ...o } = {}) => fetch(base + ruta, { ...o, headers: { 'X-Syntropy': '1', ...(cookie ? { cookie } : {}), ...(o.headers || {}) } });
async function entrar(usuario, clave) {
  const r = await pedir('/api/sesion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, clave }) });
  return r.headers.get('set-cookie').split(';')[0];
}
const subir = (cookie, nombre, contenido) => {
  const f = new FormData();
  f.append('archivo', new Blob([contenido]), nombre);
  return pedir('/api/periodos', { method: 'POST', cookie, body: f });
};

test('API: la calidad de datos exige analista, como dice la documentación', async () => {
  assert.equal((await pedir('/api/calidad')).status, 401);
  const ana = await entrar('ana', 'clave-de-prueba-1');
  assert.equal((await pedir('/api/calidad', { cookie: ana })).status, 200);
});

test('API: una carga rechazada devuelve 400 claro y queda en el registro; un archivo Latin-1 se convierte y se acepta', async () => {
  const adm = await entrar('admin', 'clave-de-prueba-2');
  const mes13 = await subir(adm, 'mes13.csv', at03([{ Fecha: '20261331' }]));
  assert.equal(mes13.status, 400);
  assert.match((await mes13.json()).error, /mes13\.csv.*20261331/);
  // La conversión de codificación es de la carga por archivo (main): un Latin-1 válido se acepta y se anota la conversión.
  const latin1 = await subir(adm, 'latin1.csv', Buffer.from(at03([{ Nombre_Cliente: 'Peña' }], '20261031'), 'latin1'));
  assert.equal(latin1.status, 200);
  const registro = await (await pedir('/api/registro', { cookie: adm })).json();
  assert.ok(registro.filter((x) => x.accion === 'carga_fallida').length >= 1);
});

test('API: reemplazar un mes con un archivo parcial avisa cuántas filas se perdieron', async () => {
  const adm = await entrar('admin', 'clave-de-prueba-2');
  const parcial = at03([{ Numero_Prestamo: 'Z1' }, { Numero_Prestamo: 'Z2' }], '20260731');
  const r = await subir(adm, 'parcial.csv', parcial);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.reemplazo, true);
  assert.equal(j.reemplazados[0].filas_antes, 25000);
  assert.equal(j.reemplazados[0].filas_despues, 2);
  assert.ok(j.avisos.some((t) => /solo 2/.test(t)));
});

test('API: el parámetro «cambio de líder» con el texto "false" queda en falso (no en verdadero)', async () => {
  const adm = await entrar('admin', 'clave-de-prueba-2');
  const r = await pedir('/api/parametros', {
    method: 'PUT', cookie: adm, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mov_min_posiciones: 2, mov_cambio_lider: 'false', mov_var_saldo_pct: 15 }),
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).mov_cambio_lider, false);
  const mala = await pedir('/api/parametros', {
    method: 'PUT', cookie: adm, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mov_min_posiciones: 2, mov_cambio_lider: 'quizás', mov_var_saldo_pct: 15 }),
  });
  assert.equal(mala.status, 400);
});

test('API: con una base de comparación elegida, rankings, panel y movimientos dicen lo mismo (el reporte usa una sola base)', async () => {
  const { app } = crearApp({ entorno: { ...entorno, CARGA_INICIAL: 'todos' }, carpetaLocal: mkdtempSync(join(tmpdir(), 'syntropy-base-')), carpetaWeb: 'no-existe' });
  const srv = await new Promise((r) => { const x = app.listen(0, '127.0.0.1', () => r(x)); });
  try {
    const url = `http://127.0.0.1:${srv.address().port}`;
    const ana = await (async () => {
      const r = await fetch(`${url}/api/sesion`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Syntropy': '1' }, body: JSON.stringify({ usuario: 'ana', clave: 'clave-de-prueba-1' }) });
      return r.headers.get('set-cookie').split(';')[0];
    })();
    const ver = (ruta) => fetch(url + ruta, { headers: { 'X-Syntropy': '1', cookie: ana } }).then((r) => r.json());
    const movs = await ver('/api/movimientos?desde=20260731&hasta=20260930');
    let distintas = 0;
    for (const macro of ['HIPOTECARIO', 'CONSTRUCCION', 'INDUSTRIA', 'AGROPECUARIO', 'COMERCIO', 'CONSUMO']) {
      const conBase = await ver(`/api/rankings?fecha=20260930&ranking=${macro}&comparar=20260731`);
      const porDefecto = await ver(`/api/rankings?fecha=20260930&ranking=${macro}`);
      assert.equal(conBase.fecha_anterior, '20260731');
      assert.equal(porDefecto.fecha_anterior, '20260831');
      for (const f of conBase.filas) {
        const m = movs.filas.find((x) => x.ranking === macro && x.codigo_banco === f.codigo_banco);
        assert.equal(f.cambio, m.cambio, `${macro} ${f.codigo_banco}: el ranking y los movimientos deben coincidir`);
        assert.equal(f.var_saldo_pct, m.var_saldo_pct);
        if (porDefecto.filas.find((x) => x.codigo_banco === f.codigo_banco).cambio !== f.cambio) distintas++;
      }
    }
    assert.ok(distintas > 0, 'la base elegida debe poder cambiar la columna «Cambio» respecto de la base por defecto');
    const panel = await ver('/api/panel?fecha=20260930&comparar=20260731');
    assert.equal(panel.fecha_anterior, '20260731');
    assert.equal(panel.meses_desde_anterior, 2);
    const sin = await ver('/api/rankings?fecha=20260930&ranking=CONSUMO&comparar=ninguna');
    assert.equal(sin.fecha_anterior, null);
    assert.ok(sin.filas.every((f) => f.cambio === null));
    const mala = await fetch(`${url}/api/rankings?fecha=20260731&ranking=CONSUMO&comparar=20260930`, { headers: { 'X-Syntropy': '1' } });
    assert.equal(mala.status, 400);
  } finally { srv.close(); }
});
