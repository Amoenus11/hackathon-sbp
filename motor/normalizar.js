// Normalización de archivos que vienen de Excel o de un CSV «a mano», con BITÁCORA de cada cambio.
// Solo se corrigen artefactos típicos de conversión (no reglas de negocio):
//   - encabezados con tildes, espacios o mayúsculas distintas;
//   - ceros a la izquierda perdidos en códigos (Excel convierte «07» en 7);
//   - fechas convertidas por Excel (número de serie o fecha) o escritas como 31/07/2026;
//   - montos con coma decimal (1.234,56).
// Lo que podría cambiar un resultado oficial (por ejemplo, espacios en «Destino») NO se toca: se avisa.

// Largo de cada código del AT03 (según el diccionario y las tablas del reto)
export const LARGO_CODIGO = {
  Preferencial_No_Preferencial: 4, Tipo_Credito: 3, Facilidad_Crediticia: 2, Clasificacion_Prestamo: 2,
  Codigo_Region: 3, Tamano_Empresa: 2, Genero: 2, Primera_Garantia: 4, Segunda_Garantia: 4,
  Periodicidad_Pago_Capital: 2, Periodicidad_Pago_Intereses: 2, Perfil_Vencimiento: 2, Metodologia_Calculo_Intereses: 2,
  Codigo_Banco: 3,
};

const sinTildes = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '');
const clave = (s) => sinTildes(s).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Distancia de edición (para sugerir el nombre correcto de una columna). */
function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

/** Fecha de Excel (número de serie, Date o texto) → AAAAMMDD. Devuelve null si no se reconoce. */
function aFecha(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10).replace(/-/g, '');
  const t = String(v).trim();
  if (/^\d{8}$/.test(t)) return null; // ya está bien
  if (/^\d{5}(\.\d+)?$/.test(t)) { // número de serie de Excel (días desde 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  }
  let m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(t); // 31/07/2026
  if (m) return `${m[3]}${m[2].padStart(2, '0')}${m[1].padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); // 2026-07-31
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  return null;
}

/**
 * Normaliza un archivo ya leído como filas de texto.
 * @param encabezado arreglo de nombres tal como vienen
 * @param filas arreglo de arreglos (valores tal como vienen: texto, número o Date)
 * @param catalogos con `columnas` (orden oficial) y `tipos` (Campo → Tipo del diccionario)
 */
export function normalizar(encabezado, filas, catalogos) {
  const bitacora = new Map(); // tipo|columna → { tipo, columna, cantidad, descripcion, ejemplos }
  const advertencias = new Map();
  const anotar = (mapa, tipo, columna, descripcion, fila, antes, despues) => {
    const k = `${tipo}|${columna}`;
    if (!mapa.has(k)) mapa.set(k, { tipo, columna, cantidad: 0, descripcion, ejemplos: [] });
    const e = mapa.get(k);
    e.cantidad++;
    if (e.ejemplos.length < 3) e.ejemplos.push({ fila, antes: String(antes), despues: despues === undefined ? undefined : String(despues) });
  };

  // 1. Encabezados: se reconocen aunque tengan tildes, espacios o mayúsculas distintas
  const porClave = new Map(catalogos.columnas.map((c) => [clave(c), c]));
  const nuevoEncabezado = encabezado.map((h, i) => {
    const original = String(h ?? '').replace(/^﻿/, '').trim();
    const oficial = porClave.get(clave(original));
    if (oficial && oficial !== original) anotar(bitacora, 'encabezado', oficial, 'Nombre de columna corregido al del diccionario', 1, original || `(columna ${i + 1})`, oficial);
    return oficial || original;
  });
  const faltan = catalogos.columnas.filter((c) => !nuevoEncabezado.includes(c));
  const sobran = nuevoEncabezado.filter((c) => !catalogos.columnas.includes(c));
  const sugerencias = {};
  for (const s of sobran) {
    const mejor = faltan.map((f) => [f, distancia(clave(s), clave(f))]).sort((a, b) => a[1] - b[1])[0];
    if (mejor && mejor[1] <= Math.max(3, Math.floor(mejor[0].length / 3))) sugerencias[s] = mejor[0];
  }

  // 2. Valores, columna por columna (se reordena al orden oficial si todas las columnas existen)
  const indice = Object.fromEntries(nuevoEncabezado.map((c, i) => [c, i]));
  const completas = faltan.length === 0;
  const orden = completas ? catalogos.columnas : nuevoEncabezado;
  let vacias = 0;
  const salida = [];
  filas.forEach((original, k) => {
    const numFila = k + 2; // fila 1 = encabezado
    if (original.every((v) => v === null || v === undefined || String(v).trim() === '')) { vacias++; return; }
    salida.push(orden.map((col) => {
      let v = original[indice[col]];
      if (v === null || v === undefined || v === '') {
        anotar(advertencias, 'celda_vacia', col, 'Celdas vacías (el reto usa «NA» cuando no aplica)', numFila, '(vacía)');
        return '';
      }
      const tipo = catalogos.tipos?.[col] || '';
      if (/^Fecha/.test(tipo) || /^Fecha/.test(col)) {
        if (String(v).trim() === 'NA') return 'NA';
        const f = aFecha(v);
        if (f) {
          anotar(bitacora, v instanceof Date || /^\d{5}/.test(String(v)) ? 'fecha_excel' : 'fecha_texto', col,
            v instanceof Date || /^\d{5}/.test(String(v)) ? 'Fecha convertida por Excel → AAAAMMDD' : 'Fecha escrita como día/mes/año → AAAAMMDD', numFila, v instanceof Date ? v.toISOString().slice(0, 10) : v, f);
          return f;
        }
        return String(v).trim();
      }
      if (LARGO_CODIGO[col]) {
        const t = String(v).trim();
        if (t !== 'NA' && /^\d+$/.test(t) && t.length < LARGO_CODIGO[col]) {
          const c = t.padStart(LARGO_CODIGO[col], '0');
          anotar(bitacora, 'ceros_izquierda', col, `Ceros a la izquierda restaurados (código de ${LARGO_CODIGO[col]} dígitos)`, numFila, t, c);
          return c;
        }
        return String(v);
      }
      if (/Decimal/.test(tipo)) {
        if (typeof v === 'number') {
          const t = v.toFixed(2);
          return t;
        }
        const t = String(v).trim();
        if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(t) || /^-?\d+,\d+$/.test(t)) {
          const c = t.replace(/\./g, '').replace(',', '.');
          anotar(bitacora, 'decimal', col, 'Coma decimal convertida a punto (1.234,56 → 1234.56)', numFila, t, c);
          return c;
        }
        return t;
      }
      const t = typeof v === 'number' ? String(v) : String(v);
      if (t !== t.trim()) anotar(advertencias, 'espacios', col, 'Valores con espacios al inicio o al final (no se cambian: las reglas comparan exacto)', numFila, JSON.stringify(t));
      return t;
    }));
  });
  if (vacias) advertencias.set('filas_vacias|', { tipo: 'filas_vacias', columna: '', cantidad: vacias, descripcion: 'Filas en blanco ignoradas', ejemplos: [] });

  return {
    encabezado: orden, filas: salida, faltan, sobran, sugerencias,
    correcciones: [...bitacora.values()], advertencias: [...advertencias.values()],
  };
}
