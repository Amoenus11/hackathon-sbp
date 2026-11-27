// Cuentas de la versión en internet (syntropy.com.pa).
// Cada cuenta recibe una contraseña al azar MUY fuerte y un enlace de un solo uso que la muestra una vez.
// En disco solo quedan la huella scrypt y, hasta que se use el enlace, la contraseña cifrada con una
// llave que viaja únicamente en el enlace. Localmente se usa .env (npm run configurar) y esto no hace falta.
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { join } from 'node:path';
import { huellaClave } from './sesion.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const huella = (t) => createHash('sha256').update(t).digest('hex');
const flujo = (token, n) => createHash('shake256', { outputLength: n }).update(`revelar:${token}`).digest();
const xor = (datos, llave) => Buffer.from(datos.map((b, k) => b ^ llave[k]));

function claveAlAzar() {
  for (;;) {
    const c = Array.from({ length: 25 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
    if (/[a-z]/.test(c) && /[A-Z]/.test(c) && /\d/.test(c)) return c.match(/.{5}/g).join('-'); // ~143 bits
  }
}

export function crearCuentas(carpetaLocal, definicion, urlPublica) {
  const ruta = join(carpetaLocal, 'cuentas.json');
  let cuentas = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : [];
  const guardar = () => { writeFileSync(`${ruta}.tmp`, JSON.stringify(cuentas, null, 1), { mode: 0o600 }); renameSync(`${ruta}.tmp`, ruta); };

  function nuevoEnlace(cuenta) {
    const clave = claveAlAzar();
    const token = randomBytes(32).toString('base64url');
    cuenta.huella = huellaClave(clave);
    cuenta.enlace = { token: huella(token), cifrado: xor(Buffer.from(clave), flujo(token, Buffer.byteLength(clave))).toString('base64'), caduca: Date.now() + 48 * 3600 * 1000 };
    return `${urlPublica}/revelar#${token}`;
  }

  // CUENTAS="admin:administrador,gui:administrador,…": crea las que falten (y muestra sus enlaces en el
  // registro del contenedor) y mantiene el perfil de cada una según esta definición.
  const enlaces = [];
  let cambios = false;
  for (const par of String(definicion || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const [usuario, perfil] = par.split(':');
    const existente = cuentas.find((c) => c.usuario === usuario);
    if (!existente) {
      const c = { usuario, perfil };
      enlaces.push(`${usuario.padEnd(14)} ${nuevoEnlace(c)}`);
      cuentas.push(c);
      cambios = true;
    } else if (existente.perfil !== perfil) {
      existente.perfil = perfil;
      cambios = true;
    }
  }
  // importar.json (una sola vez): contraseñas que el equipo ya había creado, solo como huella.
  const rutaImportar = join(carpetaLocal, 'importar.json');
  if (existsSync(rutaImportar)) {
    const importadas = [];
    for (const { usuario, huella: h } of JSON.parse(readFileSync(rutaImportar, 'utf8')) || []) {
      const c = cuentas.find((x) => x.usuario === usuario);
      if (c && typeof h === 'string' && h.startsWith('scrypt$')) {
        c.huella = h;
        delete c.enlace; // su enlace nuevo ya no hace falta: sigue con su contraseña de siempre
        importadas.push(usuario);
      }
    }
    renameSync(rutaImportar, join(carpetaLocal, `importado-${Date.now()}.json`));
    console.log(`  Contraseñas conservadas de la primera versión: ${importadas.join(', ') || 'ninguna'}`);
    cambios = true;
  }
  if (cambios) guardar();
  if (enlaces.length) console.log(`\n  Enlaces de un solo uso (48 h):\n  ${enlaces.join('\n  ')}\n`);

  return {
    lista: () => cuentas.map(({ usuario, perfil, huella: h }) => ({ usuario, perfil, huella: h })),
    /** Devuelve { usuario, clave } y borra el enlace: solo funciona una vez. */
    revelar(token) {
      const c = cuentas.find((x) => x.enlace && x.enlace.token === huella(String(token)) && x.enlace.caduca > Date.now());
      if (!c) return null;
      const clave = xor(Buffer.from(c.enlace.cifrado, 'base64'), flujo(String(token), Buffer.from(c.enlace.cifrado, 'base64').length)).toString();
      delete c.enlace;
      guardar();
      return { usuario: c.usuario, perfil: c.perfil, clave };
    },
    /** Para el administrador de la plataforma: nueva contraseña y nuevo enlace. */
    regenerar(usuario) {
      const c = cuentas.find((x) => x.usuario === usuario);
      if (!c) return null;
      const enlace = nuevoEnlace(c);
      guardar();
      return enlace;
    },
  };
}
