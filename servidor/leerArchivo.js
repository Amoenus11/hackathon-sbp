// Lee un archivo subido (CSV o Excel .xlsx), lo normaliza y devuelve el CSV limpio + la bitácora de conversión.
import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { leerCsv } from '../motor/csv.js';
import { normalizar } from '../motor/normalizar.js';
import { ErrorDatos } from '../motor/motor.js';

const escapar = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function valorCelda(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return valorCelda(v.result); // fórmula
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text); // hipervínculo
    return String(v);
  }
  return v;
}

async function leerExcel(contenido) {
  // Lectura por partes (streaming): un Excel de 30,000 filas no llena la memoria del servidor
  const lector = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(contenido), {
    sharedStrings: 'cache', hyperlinks: 'ignore', styles: 'cache', worksheets: 'emit',
  });
  let hoja = null;
  const filas = [];
  try {
    for await (const hojaLeida of lector) {
      const filasHoja = [];
      for await (const fila of hojaLeida) {
        const valores = Array.isArray(fila.values) ? fila.values.slice(1).map(valorCelda) : [];
        filasHoja.push(valores);
      }
      if (filasHoja.length > 1) { hoja = hojaLeida.name || 'Hoja1'; filas.push(...filasHoja); break; }
    }
  } catch {
    throw new ErrorDatos('No pude abrir el Excel. Guárdalo como «Libro de Excel (.xlsx)» o expórtalo a CSV (UTF-8).');
  }
  if (!filas.length) throw new ErrorDatos('El Excel no tiene hojas con datos.');
  const ancho = filas[0].length;
  return { hoja, encabezado: filas[0].map((h) => String(h ?? '')), filas: filas.slice(1).map((f) => (f.length < ancho ? [...f, ...Array(ancho - f.length).fill('')] : f)) };
}

function leerTexto(contenido) {
  let texto;
  let codificacion = 'utf-8';
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(contenido);
  } catch {
    texto = new TextDecoder('latin1').decode(contenido); // CSV guardado por Excel en Windows
    codificacion = 'latin-1';
  }
  const primera = texto.slice(0, texto.indexOf('\n') > 0 ? texto.indexOf('\n') : 2000);
  const separador = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
  const { encabezado, filas } = leerCsv(texto, separador);
  return { codificacion, separador, encabezado, filas };
}

/** Devuelve { csv, conversion } o lanza ErrorDatos con un mensaje claro (y detalle de columnas). */
export async function leerArchivoSubido(nombre, contenido, catalogos) {
  const esExcel = /\.xlsx$/i.test(nombre);
  if (!esExcel && !/\.(csv|txt)$/i.test(nombre)) {
    throw new ErrorDatos(/\.xls$/i.test(nombre)
      ? 'Ese es un Excel antiguo (.xls). Ábrelo y guárdalo como .xlsx, o expórtalo a CSV (UTF-8).'
      : 'El archivo debe ser un CSV o un Excel (.xlsx) con la estructura AT03.');
  }
  const leido = esExcel ? await leerExcel(contenido) : leerTexto(contenido);
  if (!leido.encabezado.length) throw new ErrorDatos('El archivo está vacío.');
  const n = normalizar(leido.encabezado, leido.filas, catalogos);
  const conversion = {
    formato: esExcel ? 'xlsx' : 'csv', hoja: leido.hoja || null, codificacion: leido.codificacion || null,
    separador: leido.separador || null, filas: n.filas.length, correcciones: n.correcciones, advertencias: n.advertencias,
  };
  if (leido.separador === ';') conversion.correcciones.unshift({ tipo: 'separador', columna: '', cantidad: 1, descripcion: 'Separador «;» (Excel en español) convertido a coma', ejemplos: [] });
  if (leido.codificacion === 'latin-1') conversion.correcciones.unshift({ tipo: 'codificacion', columna: '', cantidad: 1, descripcion: 'Codificación Latin-1 (Windows) convertida a UTF-8', ejemplos: [] });
  if (n.faltan.length || n.sobran.length) {
    const partes = [];
    if (n.faltan.length) partes.push(`faltan ${n.faltan.length} columnas (${n.faltan.slice(0, 4).join(', ')}${n.faltan.length > 4 ? '…' : ''})`);
    if (n.sobran.length) partes.push(`sobran ${n.sobran.length} (${n.sobran.slice(0, 4).join(', ')}${n.sobran.length > 4 ? '…' : ''})`);
    throw new ErrorDatos(`El archivo no tiene la estructura AT03: ${partes.join(' y ')}.`, { faltan: n.faltan, sobran: n.sobran, sugerencias: n.sugerencias, conversion });
  }
  const csv = [n.encabezado.join(','), ...n.filas.map((f) => f.map((v) => escapar(String(v))).join(','))].join('\r\n') + '\r\n';
  return { csv, conversion };
}
