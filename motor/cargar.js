// Carga los catálogos y los archivos AT03 desde una carpeta (lo usan el servidor, la CLI y las pruebas).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cargarCatalogos, procesarArchivos } from './motor.js';

export function leerCatalogos(carpeta) {
  const leer = (n) => readFileSync(join(carpeta, n), 'utf8');
  return cargarCatalogos({
    cinu: leer('Catalogo_CINU_SB109_reto.csv'),
    sb21: leer('Tabla_SB21_simplificada.csv'),
    bancos: leer('Bancos_ficticios.csv'),
    diccionario: leer('Diccionario_datos_AT03_reto.csv'),
  });
}

/**
 * Procesa todos los AT03_*.csv de la carpeta (en orden de nombre) y devuelve los períodos ordenados.
 * Si un mismo período (Fecha) viene en más de un archivo, sus filas se REÚNEN: ningún archivo
 * reemplaza en silencio a otro (los cálculos son por Fecha, no por archivo).
 */
export function procesarCarpeta(carpeta, catalogos) {
  const archivos = readdirSync(carpeta).filter((n) => /^AT03.*\.csv$/i.test(n)).sort();
  return procesarArchivos(archivos.map((nombre) => ({ texto: readFileSync(join(carpeta, nombre), 'utf8'), nombre })), catalogos);
}
