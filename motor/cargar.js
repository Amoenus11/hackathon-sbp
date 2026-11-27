// Carga los catálogos y los archivos AT03 desde una carpeta (lo usan el servidor, la CLI y las pruebas).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cargarCatalogos, procesarArchivo } from './motor.js';

export function leerCatalogos(carpeta) {
  const leer = (n) => readFileSync(join(carpeta, n), 'utf8');
  return cargarCatalogos({
    cinu: leer('Catalogo_CINU_SB109_reto.csv'),
    sb21: leer('Tabla_SB21_simplificada.csv'),
    bancos: leer('Bancos_ficticios.csv'),
    diccionario: leer('Diccionario_datos_AT03_reto.csv'),
  });
}

/** Procesa todos los AT03_*.csv de la carpeta (en orden de nombre) y devuelve los períodos ordenados. */
export function procesarCarpeta(carpeta, catalogos) {
  const archivos = readdirSync(carpeta).filter((n) => /^AT03.*\.csv$/i.test(n)).sort();
  const periodos = new Map();
  for (const nombre of archivos) {
    for (const p of procesarArchivo(readFileSync(join(carpeta, nombre), 'utf8'), nombre, catalogos)) periodos.set(p.fecha, p);
  }
  return [...periodos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
