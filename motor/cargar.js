// Lectura desde disco: catálogos y archivos AT03 de una carpeta (lo usan la CLI, el servidor y las pruebas).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { construirCatalogos } from './catalogos.js';
import { procesarAt03 } from './periodo.js';

export const ARCHIVOS_CATALOGO = {
  cinu: 'Catalogo_CINU_SB109_reto.csv',
  sb21: 'Tabla_SB21_simplificada.csv',
  bancos: 'Bancos_ficticios.csv',
  diccionario: 'Diccionario_datos_AT03_reto.csv',
};

export function leerCatalogos(carpeta) {
  const texto = Object.fromEntries(Object.entries(ARCHIVOS_CATALOGO).map(([k, n]) => [k, readFileSync(join(carpeta, n), 'utf8')]));
  return construirCatalogos(texto);
}

/** Lista los archivos AT03 de una carpeta, ordenados por nombre. */
export const archivosAt03 = (carpeta) => readdirSync(carpeta).filter((n) => /^AT03.*\.csv$/i.test(n)).sort();

/** Procesa todos los AT03 de la carpeta. Si dos archivos traen la misma Fecha, gana el último. */
export function procesarCarpeta(carpeta, cat) {
  const porFecha = new Map();
  for (const nombre of archivosAt03(carpeta)) {
    for (const p of procesarAt03(readFileSync(join(carpeta, nombre), 'utf8'), nombre, cat)) porFecha.set(p.fecha, p);
  }
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
