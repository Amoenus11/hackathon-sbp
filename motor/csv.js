// Lector y escritor de CSV (RFC 4180). Todo se lee como TEXTO: así los códigos conservan
// sus ceros a la izquierda ("07" sigue siendo "07", nunca 7).

/** Convierte el texto de un CSV en { encabezado, filas } (filas = arreglos de texto). */
export function leerCsv(texto) {
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1); // quita el BOM si lo hay
  const filas = [];
  let fila = [];
  let campo = '';
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      filas.push(fila); fila = [];
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  const utiles = filas.filter((f) => !(f.length === 1 && f[0] === ''));
  return { encabezado: utiles[0] || [], filas: utiles.slice(1) };
}

/** Lee un CSV como lista de objetos { columna: valor }. */
export function leerCsvObjetos(texto) {
  const { encabezado, filas } = leerCsv(texto);
  return filas.map((f) => Object.fromEntries(encabezado.map((c, i) => [c, f[i] ?? ''])));
}

const escapar = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Escribe un CSV (UTF-8, coma, fin de línea CRLF como los archivos del reto). */
export function escribirCsv(columnas, filas) {
  const lineas = [columnas.map(escapar).join(',')];
  for (const f of filas) lineas.push(columnas.map((c) => escapar(f[c])).join(','));
  return lineas.join('\r\n') + '\r\n';
}
