// Modo producto (demo.syntropy.com.pa): cuentas que crea cada persona y verificación en 2 pasos SIMULADA.
// En una versión real, el código vendría de una app autenticadora (TOTP); aquí se muestra en pantalla.
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';
import { join } from 'node:path';
import { huellaClave } from './sesion.js';
import { ErrorDatos } from '../motor/motor.js';

const codigo = () => String(randomInt(0, 1000000)).padStart(6, '0');
const VENCE_MS = 5 * 60 * 1000;

export function crearProducto(carpetaLocal) {
  const ruta = join(carpetaLocal, 'cuentas-producto.json');
  let cuentas = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : [];
  const guardar = () => { writeFileSync(`${ruta}.tmp`, JSON.stringify(cuentas, null, 1), { mode: 0o600 }); renameSync(`${ruta}.tmp`, ruta); };
  const desafios = new Map(); // id → { usuario, token, codigo, expira }
  const configurando = new Map(); // usuario → { codigo, expira }

  return {
    buscar: (n) => cuentas.find((c) => c.usuario === n),
    lista: () => cuentas.map(({ usuario, nombre, perfil, dos_pasos }) => ({ usuario, nombre, perfil, dos_pasos: Boolean(dos_pasos) })),
    crear({ usuario, nombre, clave }) {
      const u = String(usuario || '').trim().toLowerCase();
      const n = String(nombre || '').trim().slice(0, 60);
      const c = String(clave || '');
      if (!/^[a-z0-9-]{3,24}$/.test(u)) throw new ErrorDatos('El usuario debe tener de 3 a 24 letras, números o guiones (sin espacios).');
      if (!n) throw new ErrorDatos('Escribe tu nombre.');
      if (c.length < 12 || !/[a-zA-Z]/.test(c) || !/\d/.test(c)) throw new ErrorDatos('La contraseña debe tener al menos 12 caracteres, con letras y números.');
      if (cuentas.some((x) => x.usuario === u)) throw new ErrorDatos('Ese usuario ya existe: elige otro o inicia sesión.');
      if (cuentas.length >= 50) throw new ErrorDatos('Este espacio de demostración ya tiene el máximo de cuentas.');
      const perfil = cuentas.length === 0 ? 'administrador' : 'analista'; // la primera persona administra el espacio
      cuentas.push({ usuario: u, nombre: n, perfil, huella: huellaClave(c), dos_pasos: false, creada: new Date().toISOString() });
      guardar();
      return { usuario: u, nombre: n, perfil };
    },
    /** Tras validar la contraseña: si tiene 2 pasos, se guarda el token y se pide el código. */
    retener(usuario, token) {
      const id = randomBytes(16).toString('hex');
      const c = codigo();
      desafios.set(id, { usuario, token, codigo: c, expira: Date.now() + VENCE_MS });
      return { desafio: id, codigo_demo: c };
    },
    resolver(id, cod) {
      const d = desafios.get(String(id));
      if (!d || d.expira < Date.now()) throw new ErrorDatos('El código venció. Vuelve a iniciar sesión.');
      if (String(cod).trim() !== d.codigo) throw new ErrorDatos('Código incorrecto.');
      desafios.delete(String(id));
      return d;
    },
    configurar(usuario) {
      const c = codigo();
      configurando.set(usuario, { codigo: c, expira: Date.now() + VENCE_MS });
      return { codigo_demo: c };
    },
    confirmar(usuario, cod) {
      const p = configurando.get(usuario);
      if (!p || p.expira < Date.now()) throw new ErrorDatos('El código venció. Pide uno nuevo.');
      if (String(cod).trim() !== p.codigo) throw new ErrorDatos('Código incorrecto.');
      configurando.delete(usuario);
      const cuenta = cuentas.find((x) => x.usuario === usuario);
      if (cuenta) { cuenta.dos_pasos = true; guardar(); }
    },
    fijarPerfil(usuario, perfil) {
      const c = cuentas.find((x) => x.usuario === usuario);
      if (!c) return false;
      c.perfil = perfil; guardar(); return true;
    },
    tieneDosPasos: (usuario) => Boolean(cuentas.find((x) => x.usuario === usuario)?.dos_pasos),
  };
}
