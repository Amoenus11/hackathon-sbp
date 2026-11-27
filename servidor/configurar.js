// Crea los usuarios de prueba (analista y administrador) AL INSTALAR, fuera del repositorio.
//
//   npm run configurar
//
// Toma usuario y contraseña de .env (ANALISTA_USUARIO, ANALISTA_CLAVE, ADMIN_USUARIO, ADMIN_CLAVE).
// Si falta una contraseña, genera una al azar y la muestra UNA vez en esta consola.
// Guarda solo la huella scrypt en datos-locales/usuarios.json (ignorado por git).
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { huella, claveAleatoria, leerUsuarios, guardarUsuarios } from './acceso.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

export function asegurarUsuarios(carpetaLocal, { forzar = false, silencioso = false } = {}) {
  const ruta = join(carpetaLocal, 'usuarios.json');
  if (!forzar && leerUsuarios(ruta).length) return;
  const cuentas = [
    { perfil: 'analista', usuario: process.env.ANALISTA_USUARIO || 'analista', clave: process.env.ANALISTA_CLAVE },
    { perfil: 'administrador', usuario: process.env.ADMIN_USUARIO || 'admin', clave: process.env.ADMIN_CLAVE },
  ];
  const generadas = [];
  const usuarios = cuentas.map((c) => {
    let clave = c.clave;
    if (!clave) { clave = claveAleatoria(); generadas.push({ ...c, clave }); }
    return { usuario: c.usuario.trim().toLowerCase(), perfil: c.perfil, ...huella(clave) };
  });
  guardarUsuarios(ruta, usuarios);
  console.log(`Usuarios creados en ${ruta}: ${usuarios.map((u) => `${u.usuario} (${u.perfil})`).join(', ')}.`);
  if (generadas.length) {
    console.log('Contraseñas generadas (cópielas ahora; no se vuelven a mostrar):');
    for (const g of generadas) console.log(`  ${g.perfil.padEnd(13)} usuario: ${g.usuario}   contraseña: ${g.clave}`);
  } else if (!silencioso) {
    console.log('Se usaron las contraseñas definidas en .env.');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (existsSync(join(raiz, '.env'))) process.loadEnvFile(join(raiz, '.env'));
  asegurarUsuarios(process.env.CARPETA_LOCAL || join(raiz, 'datos-locales'), { forzar: true });
}
