// Lee el archivo .env (sin dependencias). Nunca se sube al repositorio: lo crea `npm run configurar`.
import { existsSync, readFileSync } from 'node:fs';

export function leerEntorno(ruta = '.env') {
  const valores = {};
  if (existsSync(ruta)) {
    for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea);
      if (m && !linea.trim().startsWith('#')) valores[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  }
  return { ...valores, ...process.env };
}
