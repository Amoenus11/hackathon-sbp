// Uso: node motor/cli.js [carpeta-datos=datos/reto] [carpeta-salida=exportaciones]
// Calcula todo desde los archivos y escribe las 5 exportaciones (reproducible, sin intervención manual).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerCatalogos, procesarCarpeta } from './cargar.js';
import { compararPeriodos, PARAMETROS_POR_DEFECTO } from './comparacion.js';
import { exportarCsv, TIPOS_EXPORTACION } from './exportar.js';
import { monto } from './dinero.js';

const [entrada = 'datos/reto', salida = 'exportaciones'] = process.argv.slice(2);
const t0 = performance.now();
const cat = leerCatalogos(entrada);
const periodos = procesarCarpeta(entrada, cat);
const comparaciones = periodos.slice(1).map((p, k) => compararPeriodos(periodos[k], p, cat, PARAMETROS_POR_DEFECTO));
mkdirSync(salida, { recursive: true });
for (const tipo of TIPOS_EXPORTACION) writeFileSync(join(salida, `${tipo}.csv`), exportarCsv(tipo, { periodos, comparaciones, cat }));

for (const p of periodos) {
  const rec = p.reconciliaciones.map((r) => `${r.id}:${r.ok ? 'ok' : 'FALLA'}`).join(' ');
  console.log(`${p.fecha}  leídas ${p.filas_leidas}  E1 ${p.cascada.E1}  E2 ${p.cascada.E2}  E3 ${p.cascada.E3}  E4 ${p.cascada.E4}  universo ${p.universo}  saldo ${monto(p.saldo_universo)}  SB21→Tarjeta ${p.reclasificadas_sb21}  ${rec}`);
}
for (const c of comparaciones) console.log(`${c.desde}→${c.hasta}  movimientos significativos: ${c.filas.filter((f) => f.significativo).length}`);
console.log(`Listo en ${Math.round(performance.now() - t0)} ms → ${salida}/`);
