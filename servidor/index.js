// Punto de entrada: `npm start` (compila la web y arranca) o `npm run servidor` (solo arranca).
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearApp } from './app.js';
import { asegurarUsuarios } from './configurar.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(raiz, '.env'))) process.loadEnvFile(join(raiz, '.env'));

const carpetaDatos = process.env.CARPETA_DATOS || join(raiz, 'datos', 'reto');
const carpetaLocal = process.env.CARPETA_LOCAL || join(raiz, 'datos-locales');
const puerto = Number(process.env.PUERTO || 3000);

asegurarUsuarios(carpetaLocal, { silencioso: true });
const t0 = performance.now();
const app = crearApp({ carpetaDatos, carpetaLocal, carpetaWeb: join(raiz, 'dist') });
const { estado } = app.locals;
console.log(`Períodos procesados en ${Math.round(performance.now() - t0)} ms: ${estado.periodos.map((p) => p.fecha).join(', ') || 'ninguno'}`);
if (!existsSync(join(raiz, 'dist', 'index.html'))) console.log('Aviso: no hay web compilada (dist/). Use `npm start` o, en desarrollo, `npm run dev:web`.');

// Por defecto solo escucha en esta computadora; ANFITRION=0.0.0.0 lo abre (por ejemplo, dentro de Docker).
const anfitrion = process.env.ANFITRION || '127.0.0.1';
app.listen(puerto, anfitrion, () => {
  console.log(`Plataforma de rankings lista en http://localhost:${puerto}`);
});
