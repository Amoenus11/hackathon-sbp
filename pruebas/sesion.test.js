// Las contraseñas creadas en la primera versión (huella scrypt de Python) siguen funcionando.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearSesiones, huellaClave } from '../servidor/sesion.js';

test('acepta huellas scrypt de la versión anterior (formato Python) y de la actual', () => {
  const sal = randomBytes(16);
  const hash = scryptSync('Mi-Clave-Segura-2026', sal, 32, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const python = `scrypt$32768$8$1$${sal.toString('base64url')}$${hash.toString('base64url')}`;
  const usuarios = new Map([
    ['nath', { usuario: 'nath', perfil: 'administrador', huella: python }],
    ['ana', { usuario: 'ana', perfil: 'analista', huella: huellaClave('otra-clave-larga-1') }],
  ]);
  const s = crearSesiones(usuarios);
  assert.equal(s.entrar('nath', 'Mi-Clave-Segura-2026').perfil, 'administrador');
  assert.ok(s.entrar('nath', 'mi-clave-segura-2026').error);
  assert.equal(s.entrar('ana', 'otra-clave-larga-1').perfil, 'analista');
});

test('las sesiones sobreviven a un reinicio del servidor (solo se guarda la huella del token)', () => {
  const archivo = join(mkdtempSync(join(tmpdir(), 'syntropy-sesiones-')), 'sesiones.json');
  const usuarios = new Map([['gui', { usuario: 'gui', perfil: 'administrador', huella: huellaClave('clave-larga-de-gui') }]]);
  const antes = crearSesiones(usuarios, { archivo });
  const { token } = antes.entrar('gui', 'clave-larga-de-gui');
  const despues = crearSesiones(usuarios, { archivo }); // «reinicio»
  assert.equal(despues.leer(['cookie-vieja-invalida', token]).usuario, 'gui');
  despues.salir([token]);
  assert.equal(crearSesiones(usuarios, { archivo }).leer(token), null);
});
