// npm run configurar  → crea .env con los usuarios de prueba y contraseñas al azar (se muestran UNA vez).
// npm run configurar -- agregar <usuario> <analista|administrador>  → agrega otro usuario.
// Las contraseñas nunca se guardan en claro ni van al repositorio (.env está en .gitignore).
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { huellaClave } from './sesion.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function claveAlAzar() {
  const c = Array.from({ length: 16 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}-${c.slice(12)}`;
}
const [accion, nuevoUsuario, nuevoPerfil] = process.argv.slice(2);

if (accion === 'agregar') {
  if (!nuevoUsuario || !['analista', 'administrador'].includes(nuevoPerfil)) {
    console.error('Uso: npm run configurar -- agregar <usuario> <analista|administrador>');
    process.exit(1);
  }
  const n = existsSync('.env') ? (readFileSync('.env', 'utf8').match(/^USUARIO_/gm) || []).length + 1 : 1;
  const clave = claveAlAzar();
  appendFileSync('.env', `USUARIO_${n}=${nuevoUsuario.toLowerCase()}:${nuevoPerfil}:${huellaClave(clave)}\n`);
  console.log(`Usuario «${nuevoUsuario}» (${nuevoPerfil}) creado. Contraseña: ${clave}`);
  process.exit(0);
}
if (existsSync('.env')) {
  console.log('Ya existe .env (no lo sobrescribo). Para empezar de cero, bórralo y vuelve a ejecutar.');
  process.exit(0);
}
const usuarios = [['analista', 'analista'], ['admin', 'administrador']];
const lineas = ['# Generado por «npm run configurar». NO subir al repositorio.', 'PUERTO=3000'];
console.log('\nUsuarios de prueba (guarda estas contraseñas; no se vuelven a mostrar):\n');
usuarios.forEach(([u, p], k) => {
  const clave = claveAlAzar();
  lineas.push(`USUARIO_${k + 1}=${u}:${p}:${huellaClave(clave)}`);
  console.log(`  ${p.padEnd(14)} usuario: ${u.padEnd(10)} contraseña: ${clave}`);
});
writeFileSync('.env', lineas.join('\n') + '\n', { mode: 0o600 });
console.log('\nEl perfil Público no necesita usuario. Listo: .env creado.\n');
