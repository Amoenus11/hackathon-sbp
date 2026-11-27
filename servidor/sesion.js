// Perfiles y sesiones. Público no necesita sesión; analista y administrador entran con usuario y
// contraseña definidos en .env (guardadas como huella scrypt, nunca en claro ni en el repositorio).
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

const huellaToken = (t) => createHash('sha256').update(String(t)).digest('hex');

export const PERMISOS = {
  publico: ['panel', 'rankings', 'metodologia', 'descargas', 'asistente', 'equipo'],
  analista: ['panel', 'rankings', 'metodologia', 'descargas', 'equipo', 'comparar', 'calidad', 'reportes', 'asistente', 'exportar_todo'],
  administrador: ['panel', 'rankings', 'metodologia', 'descargas', 'equipo', 'comparar', 'calidad', 'reportes', 'asistente', 'exportar_todo',
    'cargar', 'parametros', 'catalogos', 'perfiles', 'registro'],
};
export const NOMBRE_PERFIL = { publico: 'Público', analista: 'Analista', administrador: 'Administrador' };

export function huellaClave(clave, sal = randomBytes(16).toString('hex')) {
  return `scrypt$${sal}$${scryptSync(clave, sal, 32).toString('hex')}`;
}

function claveCorrecta(clave, huella) {
  const partes = String(huella).split('$');
  if (partes[0] !== 'scrypt') return false;
  let calculada;
  let guardada;
  if (partes.length === 6) {
    // Huella de la primera versión (Python): scrypt$N$r$p$sal$hash en base64url. Así las contraseñas
    // que el equipo ya creó siguen sirviendo.
    const [, n, r, p, sal, hash] = partes;
    guardada = Buffer.from(hash, 'base64url');
    calculada = scryptSync(clave, Buffer.from(sal, 'base64url'), guardada.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024 });
  } else if (partes.length === 3) {
    const [, sal, hash] = partes;
    guardada = Buffer.from(hash, 'hex');
    calculada = scryptSync(clave, sal, 32);
  } else return false;
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

export function crearSesiones(usuarios, { archivo } = {}) {
  const buscar = typeof usuarios === 'function' ? usuarios : (n) => usuarios.get(n);
  // Las sesiones se guardan en disco (solo la huella SHA-256 del token): publicar una versión nueva
  // no cierra la sesión de nadie.
  let sesiones = new Map();
  if (archivo && existsSync(archivo)) {
    try { sesiones = new Map(Object.entries(JSON.parse(readFileSync(archivo, 'utf8')))); } catch { sesiones = new Map(); }
  }
  const guardar = () => {
    if (!archivo) return;
    const vivas = Object.fromEntries([...sesiones].filter(([, s]) => s.expira > Date.now()));
    writeFileSync(`${archivo}.tmp`, JSON.stringify(vivas), { mode: 0o600 });
    renameSync(`${archivo}.tmp`, archivo);
  };
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
      sesiones.set(huellaToken(token), { usuario: u.usuario, expira: Date.now() + DURACION_MS });
      guardar();
      return { token, usuario: u.usuario, perfil: u.perfil };
    },
    /** Acepta uno o varios tokens (si el navegador manda dos cookies con el mismo nombre). */
    leer(tokens) {
      for (const token of [].concat(tokens || [])) {
        const s = sesiones.get(huellaToken(token));
        if (!s || s.expira < Date.now()) continue;
        const u = buscar(s.usuario); // el perfil se lee siempre del usuario (si cambia, cambia al momento)
        if (u) return { usuario: u.usuario, perfil: u.perfil, token };
      }
      return null;
    },
    salir(tokens) {
      for (const token of [].concat(tokens || [])) sesiones.delete(huellaToken(token));
      guardar();
    },
  };
}
