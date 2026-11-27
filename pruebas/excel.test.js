// Un Excel con los «daños» típicos (07 → 7, fechas convertidas, coma decimal, columnas con tildes) se repara
// solo y da EXACTAMENTE el mismo resultado que el CSV original. Cada reparación queda en la bitácora.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { leerCsv } from '../motor/csv.js';
import { leerCatalogos } from '../motor/cargar.js';
import { procesarArchivo } from '../motor/motor.js';
import { leerArchivoSubido } from '../servidor/leerArchivo.js';

const catalogos = leerCatalogos('datos/reto');

test('Excel dañado por la conversión: se repara solo, con bitácora, y da el mismo resultado que el CSV', async () => {
  const texto = readFileSync('datos/reto/AT03_sintetico_202607.csv', 'utf8');
  const { encabezado, filas } = leerCsv(texto);
  const muestra = filas.slice(0, 400);
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('AT03');
  hoja.addRow(encabezado.map((h) => (h === 'Numero_Prestamo' ? 'Número Préstamo' : h))); // encabezado con tilde y espacio
  const i = Object.fromEntries(encabezado.map((h, k) => [h, k]));
  for (const f of muestra) {
    const fila = [...f];
    fila[i.Facilidad_Crediticia] = Number(f[i.Facilidad_Crediticia]); // Excel: 07 → 7
    fila[i.Codigo_Region] = f[i.Codigo_Region] === 'NA' ? 'NA' : Number(f[i.Codigo_Region]);
    const d = f[i.Fecha];
    fila[i.Fecha] = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6))); // fecha de Excel
    fila[i.Saldo] = f[i.Saldo].replace('.', ','); // coma decimal
    hoja.addRow(fila);
  }
  const contenido = Buffer.from(await libro.xlsx.writeBuffer());
  const { csv, conversion } = await leerArchivoSubido('corte.xlsx', contenido, catalogos);
  const tipos = conversion.correcciones.map((c) => c.tipo);
  for (const t of ['encabezado', 'ceros_izquierda', 'fecha_excel', 'decimal']) assert.ok(tipos.includes(t), `falta ${t} en la bitácora`);

  const original = [encabezado.join(','), ...muestra.map((f) => f.join(','))].join('\r\n');
  const [a] = procesarArchivo(csv, 'corte.xlsx', catalogos);
  const [b] = procesarArchivo(original, 'corte.csv', catalogos);
  assert.deepEqual(a.cascada, b.cascada);
  assert.equal(a.saldo_universo, b.saldo_universo);
  for (const m of Object.keys(b.rankings)) {
    assert.deepEqual(a.rankings[m].map((f) => [f.codigo_banco, f.saldo_actividad]), b.rankings[m].map((f) => [f.codigo_banco, f.saldo_actividad]));
  }
});

test('CSV oficial: la conversión no cambia nada', async () => {
  const contenido = readFileSync('datos/reto/AT03_sintetico_202608.csv');
  const { csv, conversion } = await leerArchivoSubido('AT03_sintetico_202608.csv', contenido, catalogos);
  assert.equal(conversion.correcciones.length, 0);
  assert.equal(csv, contenido.toString('utf8'));
});

test('columna con nombre parecido: error claro con sugerencia', async () => {
  const texto = readFileSync('datos/reto/AT03_sintetico_202607.csv', 'utf8').replace('Numero_Prestamo', 'Num_Prestamo');
  await assert.rejects(leerArchivoSubido('x.csv', Buffer.from(texto), catalogos), (e) => e.detalle?.sugerencias?.Num_Prestamo === 'Numero_Prestamo');
});
