// Pruebas de la API: perfiles con opciones distintas, protección de escrituras y exportaciones.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearApp } from '../servidor/app.js';
import { huellaClave } from '../servidor/sesion.js';
import { COLUMNAS } from '../motor/exportar.js';
// Contraseñas de prueba generadas al azar en cada ejecución (ninguna queda escrita en el repositorio)
import { randomBytes as __azar } from 'node:crypto';
const CLAVES = {};
const clave = (n) => (CLAVES[n] ||= `${__azar(12).toString('base64url')}Aa1`);


let servidor;
let base;
const entorno = {
  USUARIO_1: `ana:analista:${huellaClave(clave('0'))}`,
  USUARIO_2: `admin:administrador:${huellaClave(clave('1'))}`,
  CARGA_INICIAL: 'julio-agosto',
};

before(async () => {
  const { app } = crearApp({ entorno, carpetaLocal: mkdtempSync(join(tmpdir(), 'syntropy-prueba-')), carpetaWeb: 'no-existe' });
  await new Promise((r) => { servidor = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

const pedir = (ruta, { cookie, ...o } = {}) => fetch(base + ruta, { ...o, headers: { 'X-Syntropy': '1', ...(cookie ? { cookie } : {}), ...(o.headers || {}) } });
async function entrar(usuario, clave) {
  const r = await pedir('/api/sesion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, clave }) });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('público consulta rankings pero no puede cargar períodos ni ver calidad detallada', async () => {
  const r = await pedir('/api/rankings?ranking=HIPOTECARIO');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).filas.length, 12);
  assert.equal((await pedir('/api/periodos', { method: 'POST' })).status, 401);
  assert.equal((await pedir('/api/excluidas')).status, 401);
  assert.equal((await pedir('/api/exportar/calidad.csv')).status, 401);
});

test('contraseña incorrecta: rechazo con mensaje claro', async () => {
  const r = await pedir('/api/sesion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'admin', clave: 'x' }) });
  assert.equal(r.status, 401);
  assert.match((await r.json()).error, /incorrectos/);
});

test('escrituras sin la cabecera anti-CSRF se rechazan', async () => {
  const r = await fetch(`${base}/api/sesion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 403);
});

test('analista compara períodos pero no administra', async () => {
  const cookie = await entrar('ana', clave('0'));
  assert.equal((await pedir('/api/movimientos', { cookie })).status, 200);
  assert.equal((await pedir('/api/registro', { cookie })).status, 403);
});

test('administrador carga septiembre: se calcula y se comparan las posiciones automáticamente', async () => {
  const cookie = await entrar('admin', clave('1'));
  const meta = await (await pedir('/api/meta')).json();
  assert.deepEqual(meta.periodos.map((p) => p.fecha), ['20260731', '20260831']);
  const form = new FormData();
  form.append('archivo', new Blob([readFileSync('datos/reto/AT03_sintetico_202609.csv')]), 'AT03_sintetico_202609.csv');
  const r = await pedir('/api/periodos', { method: 'POST', body: form, cookie });
  assert.equal(r.status, 200);
  const res = await r.json();
  assert.equal(res.procesados[0].fecha, '20260930');
  assert.equal(res.comparado_con, '20260831');
  const registro = await (await pedir('/api/registro', { cookie })).json();
  assert.equal(registro[0].accion, 'cargar_periodo');
  // Archivo inválido → 400 con mensaje
  const malo = new FormData();
  malo.append('archivo', new Blob(['a,b\n1,2\n']), 'malo.csv');
  const r2 = await pedir('/api/periodos', { method: 'POST', body: malo, cookie });
  assert.equal(r2.status, 400);
  assert.match((await r2.json()).error, /estructura AT03/);
});

test('exportaciones con las columnas exactas de la Sección 10', async () => {
  for (const tipo of ['rankings', 'desglose']) {
    const texto = await (await pedir(`/api/exportar/${tipo}.csv`)).text();
    assert.equal(texto.split('\r\n')[0], COLUMNAS[tipo].join(','));
  }
});

test('descarga a tu medida: solo lo elegido, sin datos personales', async () => {
  const cuerpo = { cortes: ['20260831'], actividades: ['CONSUMO'], subactividades: ['Tarjeta'], bancos: ['112'], nivel: 'detalle', campos: ['Saldo', 'Dias_Mora'], formato: 'json' };
  const r = await (await pedir('/api/extraccion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })).json();
  assert.ok(r.total_filas > 0);
  assert.ok(!r.columnas.includes('Nombre_Cliente') && !r.columnas.includes('ID_Cliente'));
  assert.ok(r.filas.every((f) => f[0] === '20260831' && f[1] === '112' && f[5] === 'Tarjeta'));
  const resumen = await (await pedir('/api/extraccion', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cortes: ['20260831'], nivel: 'resumen', agrupar: ['actividad'], formato: 'json' }) })).json();
  assert.equal(resumen.total_filas, 6);
});
