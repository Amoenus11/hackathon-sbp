// Utilidades para las pruebas: catálogos reales del paquete y un generador de filas AT03 mínimas.
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { leerCatalogos } from '../motor/cargar.js';
import { generarCsv } from '../motor/csv.js';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DATOS = join(RAIZ, 'datos', 'reto');
export const cat = leerCatalogos(DATOS);

export const CINU = {
  vivienda: 'L.68.681.6810.00000',
  infraestructura: 'F.42.421.4210.00000',
  personal: 'K.64.649.6492.64921',
  auto: 'K.64.649.6492.64922',
  tarjeta: 'K.64.649.6499.64991',
};

let secuencia = 0;
/** Una fila AT03 válida y local, con los campos que importan sobrescribibles. */
export function fila(o = {}) {
  secuencia++;
  const base = Object.fromEntries(cat.columnas.map((c) => [c, 'NA']));
  return {
    ...base,
    Fecha: '20260731', Codigo_Banco: '101', Facilidad_Crediticia: '01', Destino: 'L',
    Numero_Prestamo: `T-${String(secuencia).padStart(6, '0')}`, Tipo_Actividad: CINU.vivienda,
    Saldo: '100.00', Dias_Mora: '0', Tasa_Interes: '5', ...o,
  };
}

/** Texto CSV AT03 con las filas dadas (columnas en el orden del diccionario). */
export const csvAt03 = (filas, columnas = cat.columnas) => generarCsv(columnas, filas);
