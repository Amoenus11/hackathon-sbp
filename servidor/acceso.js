// Perfiles, usuarios y sesiones (control básico de acceso, ejecución local).
//
// - Público: entra sin sesión.
// - Analista y Administrador: usuario y contraseña. Las contraseñas NUNCA están en el repositorio:
//   `npm run configurar` las toma de .env (no versionado) o las genera al azar, y guarda solo
//   su huella scrypt en datos-locales/usuarios.json (también fuera del repositorio).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const PERFILES = ['publico', 'analista', 'administrador'];

/** Qué módulo ve cada perfil (cada perfil ve todo lo del anterior y algo más). */
export const PERMISOS = {
  publico: ['panel', 'rankings', 'metodologia', 'descargas'],
  analista: ['panel', 'rankings', 'metodologia', 'descargas', 'comparar', 'calidad', 'reportes', 'asistente'],
  administrador: ['panel', 'rankings', 'metodologia', 'descargas', 'comparar', 'calidad', 'reportes', 'asistente',
    'cargar', 'parametros', 'catalogos', 'perfiles', 'registro'],
};

export const nivel = (perfil) => PERFILES.indexOf(perfil);

// ---------------------------------------------------------------------------- contraseñas
export function huella(clave, sal = randomBytes(16).toString('hex')) {
  return { sal, hash: scryptSync(clave, sal, 64).toString('hex') };
}

export function verificarClave(clave, { sal, hash }) {
  const calculado = scryptSync(String(clave), sal, 64);
  const guardado = Buffer.from(hash, 'hex');
  return guardado.length === calculado.length && timingSafeEqual(guardado, calculado);
}

export function claveAleatoria() {
  return randomBytes(12).toString('base64url'); // ~96 bits
}

export function leerUsuarios(ruta) {
  if (!existsSync(ruta)) return [];
  return JSON.parse(readFileSync(ruta, 'utf8'));
}

export function guardarUsuarios(ruta, usuarios) {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(usuarios, null, 2));
}

// ---------------------------------------------------------------------------- sesiones
export const COOKIE = 'syntropy_sesion';
const DURACION_MS = 8 * 60 * 60 * 1000;
const MAX_FALLOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;

export class Sesiones {
  constructor() {
    this.activas = new Map();
    this.fallos = new Map();
  }

  crear(usuario, perfil) {
    const token = randomBytes(32).toString('base64url');
    this.activas.set(token, { usuario, perfil, expira: Date.now() + DURACION_MS });
    return token;
  }

  leer(token) {
    const s = token && this.activas.get(token);
    if (!s) return null;
    if (s.expira < Date.now()) { this.activas.delete(token); return null; }
    return s;
  }

  cerrar(token) { this.activas.delete(token); }

  /** Devuelve los segundos que faltan si el usuario está bloqueado por intentos fallidos. */
  bloqueado(usuario) {
    const f = this.fallos.get(usuario);
    if (!f || f.n < MAX_FALLOS) return 0;
    const resta = f.desde + BLOQUEO_MS - Date.now();
    if (resta <= 0) { this.fallos.delete(usuario); return 0; }
    return Math.ceil(resta / 1000);
  }

  fallo(usuario) {
    const f = this.fallos.get(usuario) ?? { n: 0, desde: Date.now() };
    f.n++; f.desde = Date.now();
    this.fallos.set(usuario, f);
  }

  exito(usuario) { this.fallos.delete(usuario); }
}

/** Lee una cookie del encabezado sin dependencias. */
export function leerCookie(req, nombre) {
  const c = req.headers.cookie;
  if (!c) return null;
  for (const parte of c.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}
