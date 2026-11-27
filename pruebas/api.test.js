// Pruebas de la API: perfiles y permisos, exportaciones, carga de un período nuevo sin tocar código.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearApp } from '../servidor/app.js';
import { huella, guardarUsuarios, claveAleatoria } from '../servidor/acceso.js';
import { DATOS } from './ayuda.js';

const local = mkdtempSync(join(tmpdir(), 'rankings-prueba-'));
// Claves de prueba generadas en cada corrida (no hay contraseñas fijas en el repositorio)
const claves = { analista: claveAleatoria(), admin: claveAleatoria() };
guardarUsuarios(join(local, 'usuarios.json'), [
  { usuario: 'analista', perfil: 'analista', ...huella(claves.analista) },
  { usuario: 'admin', perfil: 'administrador', ...huella(claves.admin) },
]);
process.env.IA_DESACTIVADA = '1';

let servidor, base;
before(async () => {
  const app = crearApp({ carpetaDatos: DATOS, carpetaLocal: local });
  await new Promise((ok) => { servidor = app.listen(0, '127.0.0.1', ok); });
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => { servidor?.close(); rmSync(local, { recursive: true, force: true }); });

const pedir = async (ruta, { metodo = 'GET', cookie, cuerpo, cabecera = true, form } = {}) => {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (cabecera && metodo !== 'GET') headers['X-Syntropy'] = '1';
  if (cuerpo) headers['Content-Type'] = 'application/json';
  const r = await fetch(base + ruta, { method: metodo, headers, body: form ?? (cuerpo ? JSON.stringify(cuerpo) : undefined) });
  const tipo = r.headers.get('content-type') ?? '';
  return { estado: r.status, datos: tipo.includes('json') ? await r.json() : await r.text(), r };
};
const entrar = async (usuario) => {
  const { estado, r } = await pedir('/api/sesion', { metodo: 'POST', cuerpo: { usuario, clave: claves[usuario] } });
  assert.equal(estado, 200);
  return r.headers.get('set-cookie').split(';')[0];
};
const archivoAt03 = (nombre) => {
  const form = new FormData();
  form.append('archivo', new Blob([readFileSync(join(DATOS, nombre))], { type: 'text/csv' }), nombre);
  return form;
};

test('meta: 3 períodos, 6 rankings, 12 bancos, fuente y aviso de datos ficticios', async () => {
  const { estado, datos } = await pedir('/api/meta');
  assert.equal(estado, 200);
  assert.deepEqual(datos.periodos.map((p) => p.fecha), ['20260731', '20260831', '20260930']);
  assert.equal(datos.ultimo, '20260930');
  assert.equal(datos.rankings.length, 6);
  assert.equal(datos.bancos.length, 12);
  assert.match(datos.aviso, /ficticios/);
});

test('público: consulta rankings y descarga rankings/desglose, pero no ve análisis ni administración', async () => {
  const rk = await pedir('/api/rankings?fecha=20260930&ranking=HIPOTECARIO');
  assert.equal(rk.estado, 200);
  assert.equal(rk.datos.filas.length, 12);
  assert.equal(typeof rk.datos.filas[0].saldo_actividad, 'string');
  assert.equal((await pedir('/api/exportar/rankings.csv')).estado, 200);
  assert.equal((await pedir('/api/exportar/desglose.csv?fecha=20260930')).estado, 200);
  assert.equal((await pedir('/api/exportar/calidad.csv')).estado, 401);
  assert.equal((await pedir('/api/calidad')).estado, 401);
  assert.equal((await pedir('/api/movimientos')).estado, 401);
  assert.equal((await pedir('/api/periodos', { metodo: 'POST', form: archivoAt03('AT03_sintetico_202609.csv') })).estado, 401);
  assert.equal((await pedir('/api/registro')).estado, 401);
});

test('escrituras sin la cabecera X-Syntropy se rechazan; contraseña errónea da 401', async () => {
  assert.equal((await pedir('/api/sesion', { metodo: 'POST', cuerpo: { usuario: 'admin', clave: 'x' }, cabecera: false })).estado, 403);
  assert.equal((await pedir('/api/sesion', { metodo: 'POST', cuerpo: { usuario: 'admin', clave: 'incorrecta' } })).estado, 401);
});

test('analista: ve calidad, movimientos y exportaciones completas, pero no puede cargar períodos', async () => {
  const c = await entrar('analista');
  const cal = await pedir('/api/calidad?fecha=20260731', { cookie: c });
  assert.equal(cal.estado, 200);
  assert.equal(cal.datos.cuadra, true);
  const mov = await pedir('/api/movimientos?desde=20260731&hasta=20260930', { cookie: c });
  assert.equal(mov.estado, 200);
  assert.equal(mov.datos.filas.length, 72);
  const csv = await pedir('/api/exportar/calidad.csv', { cookie: c });
  assert.match(csv.datos, /^Fecha,Filas_Leidas,E1_Duplicados/);
  assert.equal((await pedir('/api/periodos', { metodo: 'POST', cookie: c, form: archivoAt03('AT03_sintetico_202609.csv') })).estado, 403);
  const rep = await pedir('/api/exportar/reporte.html?fecha=20260930', { cookie: c });
  assert.equal(rep.estado, 200);
  assert.match(rep.datos, /datos 100 % ficticios/i);
});

test('administrador: quita septiembre, lo vuelve a cargar y el sistema recalcula y detecta movimientos', async () => {
  const c = await entrar('admin');
  assert.equal((await pedir('/api/periodos/20260930', { metodo: 'DELETE', cookie: c })).estado, 200);
  assert.deepEqual((await pedir('/api/meta')).datos.periodos.map((p) => p.fecha), ['20260731', '20260831']);
  const carga = await pedir('/api/periodos', { metodo: 'POST', cookie: c, form: archivoAt03('AT03_sintetico_202609.csv') });
  assert.equal(carga.estado, 200);
  assert.deepEqual(carga.datos.procesados.map((p) => [p.fecha, p.filas_leidas]), [['20260930', 30000]]);
  assert.ok(carga.datos.movimientos_significativos > 0);
  assert.ok(carga.datos.explicaciones.length > 0);
  assert.deepEqual((await pedir('/api/meta')).datos.periodos.map((p) => p.fecha), ['20260731', '20260831', '20260930']);
  const reg = await pedir('/api/registro', { cookie: c });
  assert.ok(reg.datos.some((e) => e.accion === 'cargar_periodo' && e.usuario === 'admin'));
});

test('administrador: un archivo inválido se rechaza con un mensaje claro y no cambia nada', async () => {
  const c = await entrar('admin');
  const form = new FormData();
  form.append('archivo', new Blob(['Fecha,Codigo_Banco\r\n20261031,101\r\n'], { type: 'text/csv' }), 'AT03_malo.csv');
  const r = await pedir('/api/periodos', { metodo: 'POST', cookie: c, form });
  assert.equal(r.estado, 400);
  assert.match(r.datos.error, /estructura AT03/);
  assert.ok(r.datos.detalles.length > 0);
  assert.equal((await pedir('/api/meta')).datos.periodos.length, 3);
});

test('administrador: parámetros de movimiento significativo configurables y validados', async () => {
  const c = await entrar('admin');
  const mal = await pedir('/api/parametros', { metodo: 'PUT', cookie: c, cuerpo: { mov_min_posiciones: 0, mov_cambio_lider: true, mov_var_saldo_pct: '10' } });
  assert.equal(mal.estado, 400);
  const antes = (await pedir('/api/movimientos', { cookie: c })).datos.filas.filter((f) => f.significativo).length;
  const ok = await pedir('/api/parametros', { metodo: 'PUT', cookie: c, cuerpo: { mov_min_posiciones: 1, mov_cambio_lider: true, mov_var_saldo_pct: '5' } });
  assert.equal(ok.estado, 200);
  const despues = (await pedir('/api/movimientos', { cookie: c })).datos.filas.filter((f) => f.significativo).length;
  assert.ok(despues > antes);
  await pedir('/api/parametros', { metodo: 'PUT', cookie: c, cuerpo: { mov_min_posiciones: 2, mov_cambio_lider: true, mov_var_saldo_pct: '15.00' } });
});
