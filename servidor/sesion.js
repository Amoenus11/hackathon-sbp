// Perfiles y sesiones. Público no necesita sesión; analista y administrador entran con usuario y
// contraseña definidos en .env (guardadas como huella scrypt, nunca en claro ni en el repositorio).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const PERMISOS = {
  publico: ['panel', 'rankings', 'metodologia', 'descargas'],
  analista: ['panel', 'rankings', 'metodologia', 'descargas', 'comparar', 'calidad', 'reportes', 'asistente', 'exportar_todo'],
  administrador: ['panel', 'rankings', 'metodologia', 'descargas', 'comparar', 'calidad', 'reportes', 'asistente', 'exportar_todo',
    'cargar', 'parametros', 'catalogos', 'perfiles', 'registro'],
};
export const NOMBRE_PERFIL = { publico: 'Público', analista: 'Analista', administrador: 'Administrador' };

export function huellaClave(clave, sal = randomBytes(16).toString('hex')) {
  return `scrypt$${sal}$${scryptSync(clave, sal, 32).toString('hex')}`;
}

function claveCorrecta(clave, huella) {
  const [tipo, sal, hash] = String(huella).split('$');
  if (tipo !== 'scrypt' || !sal || !hash) return false;
  const calculada = scryptSync(clave, sal, 32);
  const guardada = Buffer.from(hash, 'hex');
  return guardada.length === calculada.length && timingSafeEqual(calculada, guardada);
}

/** USUARIO_<n>=usuario:perfil:huella  (lo escribe `npm run configurar`). */
export function usuariosDesdeEntorno(entorno) {
  const usuarios = new Map();
  for (const [k, v] of Object.entries(entorno)) {
    if (!k.startsWith('USUARIO_')) continue;
    const [usuario, perfil, ...resto] = String(v).split(':');
    if (usuario && PERMISOS[perfil]) usuarios.set(usuario.toLowerCase(), { usuario: usuario.toLowerCase(), perfil, huella: resto.join(':') });
  }
  return usuarios;
}

const DURACION_MS = 8 * 60 * 60 * 1000;
const MAX_FALLOS = 5;

export function crearSesiones(usuarios) {
  const buscar = typeof usuarios === 'function' ? usuarios : (n) => usuarios.get(n);
  const sesiones = new Map();
  const fallos = new Map(); // usuario → { n, hasta }
  return {
    entrar(usuario, clave) {
      const nombre = String(usuario || '').toLowerCase();
      const u = buscar(nombre);
      const f = fallos.get(nombre) || { n: 0, hasta: 0 };
      if (f.hasta > Date.now()) return { error: 'Demasiados intentos fallidos. Espera 5 minutos.' };
      if (!u || !claveCorrecta(String(clave || ''), u.huella)) {
        f.n += 1;
        if (f.n >= MAX_FALLOS) { f.n = 0; f.hasta = Date.now() + 5 * 60 * 1000; }
        fallos.set(nombre, f);
        return { error: 'Usuario o contraseña incorrectos.' };
      }
      fallos.set(nombre, { n: 0, hasta: 0 });
      const token = randomBytes(32).toString('hex');
      sesiones.set(token, { usuario: u.usuario, perfil: u.perfil, expira: Date.now() + DURACION_MS });
      return { token, usuario: u.usuario, perfil: u.perfil };
    },
    leer(token) {
      const s = token ? sesiones.get(token) : null;
      if (!s || s.expira < Date.now()) return null;
      return s;
    },
    salir(token) {
      const s = sesiones.get(token);
      if (s) s.expira = 0;
    },
  };
}
