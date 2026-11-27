// Uso: node motor/cli.js <carpeta-datos> <carpeta-salida>
// Calcula todo desde los archivos y escribe las 5 exportaciones oficiales (reproducible, sin intervención manual).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerCatalogos, procesarCarpeta } from './cargar.js';
import { compararPeriodos, PARAMETROS_INICIALES } from './motor.js';
import { generar } from './exportar.js';

const [entrada = 'datos/reto', salida = 'exportaciones'] = process.argv.slice(2);
const inicio = Date.now();
const catalogos = leerCatalogos(entrada);
const periodos = procesarCarpeta(entrada, catalogos);
const comparaciones = periodos.slice(1).map((p, k) => compararPeriodos(periodos[k], p, PARAMETROS_INICIALES));
mkdirSync(salida, { recursive: true });
for (const [tipo, fn] of Object.entries(generar)) writeFileSync(join(salida, `${tipo}.csv`), fn(periodos, comparaciones));
for (const p of periodos) {
  const r = p.reconciliaciones.map((x) => `${x.id}:${x.ok ? 'ok' : 'FALLA'}`).join(' ');
  console.log(`${p.fecha}  leídas ${p.filas_leidas}  E1 ${p.cascada.E1}  E2 ${p.cascada.E2}  E3 ${p.cascada.E3}  E4 ${p.cascada.E4}  universo ${p.universo}  cuadra ${p.cuadra ? 'sí' : 'NO'}  ${r}`);
}
console.log(`Listo en ${Date.now() - inicio} ms → ${salida}/`);
