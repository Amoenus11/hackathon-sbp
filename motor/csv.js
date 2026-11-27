// Lectura y escritura de CSV (RFC 4180) sin dependencias.
//
// Regla de oro del reto: TODO se lee como texto. Así los códigos conservan sus ceros a la
// izquierda ("07" sigue siendo "07", "001" sigue siendo "001") y nadie convierte tipos a escondidas.

const BOM = 0xfeff;

/**
 * Convierte el texto de un CSV en { encabezado: string[], filas: string[][] }.
 * - Quita el BOM UTF-8 si lo hay (los catálogos del paquete lo traen, los AT03 no).
 * - Acepta fin de línea CRLF o LF y campos entre comillas con comas o comillas dobles dentro.
 * - Ignora líneas totalmente vacías.
 */
export function analizarCsv(texto) {
  if (texto.length && texto.charCodeAt(0) === BOM) texto = texto.slice(1);
  const filas = [];
  let fila = [];
  let inicio = 0;
  let i = 0;
  const n = texto.length;

  const cerrarFila = () => {
    if (!(fila.length === 1 && fila[0] === '')) filas.push(fila);
    fila = [];
  };

  while (i <= n) {
    if (i < n && texto[i] === '"' && i === inicio) {
      // Campo entre comillas
      let valor = '';
      let j = i + 1;
      for (;;) {
        const k = texto.indexOf('"', j);
        if (k === -1) throw new Error('CSV mal formado: comillas sin cerrar.');
        valor += texto.slice(j, k);
        if (texto[k + 1] === '"') { valor += '"'; j = k + 2; continue; }
        i = k + 1;
        break;
      }
      fila.push(valor);
      if (texto[i] === ',') { i++; inicio = i; continue; }
      if (texto[i] === '\r') i++;
      if (texto[i] === '\n') i++;
      inicio = i;
      cerrarFila();
      if (i >= n) break;
      continue;
    }
    // Campo sin comillas: avanzar hasta coma o fin de línea
    let k = i;
    while (k < n) {
      const c = texto.charCodeAt(k);
      if (c === 44 /* , */ || c === 10 /* \n */ || c === 13 /* \r */) break;
      k++;
    }
    fila.push(texto.slice(inicio, k));
    if (k >= n) { cerrarFila(); break; }
    if (texto.charCodeAt(k) === 44) { i = k + 1; inicio = i; continue; }
    // Fin de línea
    i = texto.charCodeAt(k) === 13 && texto.charCodeAt(k + 1) === 10 ? k + 2 : k + 1;
    inicio = i;
    cerrarFila();
    if (i >= n) break;
  }
  return { encabezado: filas[0] ?? [], filas: filas.slice(1) };
}

/** Lee un CSV de catálogo como lista de objetos { columna: valor }. */
export function csvAObjetos(texto) {
  const { encabezado, filas } = analizarCsv(texto);
  return filas.map((f) => {
    const o = {};
    encabezado.forEach((c, k) => { o[c] = f[k] ?? ''; });
    return o;
  });
}

const citar = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** Genera un CSV (UTF-8 sin BOM, coma, CRLF — igual que los archivos del reto). */
export function generarCsv(columnas, filas) {
  let salida = columnas.map(citar).join(',') + '\r\n';
  for (const f of filas) salida += columnas.map((c) => citar(f[c])).join(',') + '\r\n';
  return salida;
}
