// «Descarga a tu medida» (pedido del stakeholder): el usuario elige cortes, actividades, bancos, clasificación
// y campos, y descarga SOLO eso (detalle por préstamo o resumen agrupado), en CSV o Excel. Sin código.
import ExcelJS from 'exceljs';
import { escribirCsv } from '../motor/csv.js';
import { ORDEN_RANKINGS, TITULO_RANKING, aTexto, porcentaje, etiquetaPeriodo, ErrorDatos } from '../motor/motor.js';

export const CLASIFICACIONES = [
  { codigo: '01', nombre: 'Normal' }, { codigo: '02', nombre: 'Mención especial' }, { codigo: '03', nombre: 'Subnormal' },
  { codigo: '04', nombre: 'Dudoso' }, { codigo: '05', nombre: 'Irrecuperable' },
];
export const CAMPOS = [
  { campo: 'Saldo', titulo: 'Saldo', grupo: 'Saldos', defecto: true },
  { campo: 'Valor_Inicial', titulo: 'Monto original', grupo: 'Saldos', defecto: false },
  { campo: 'Intereses_por_Cobrar', titulo: 'Intereses por cobrar', grupo: 'Saldos', defecto: false },
  { campo: 'Clasificacion_Prestamo', titulo: 'Clasificación de riesgo', grupo: 'Riesgo y mora', defecto: true },
  { campo: 'Dias_Mora', titulo: 'Días de mora', grupo: 'Riesgo y mora', defecto: true },
  { campo: 'Provision', titulo: 'Provisión', grupo: 'Riesgo y mora', defecto: false },
  { campo: 'Perfil_Vencimiento', titulo: 'Perfil de vencimiento', grupo: 'Riesgo y mora', defecto: false },
  { campo: 'Fecha_Inicial_Prestamo', titulo: 'Fecha de otorgamiento', grupo: 'Fechas y vencimiento', defecto: false },
  { campo: 'Fecha_Vencimiento', titulo: 'Fecha de vencimiento', grupo: 'Fechas y vencimiento', defecto: true },
  { campo: 'Fecha_Proximo_Pago_Capital', titulo: 'Próximo pago de capital', grupo: 'Fechas y vencimiento', defecto: false },
  { campo: 'Tasa_Interes', titulo: 'Tasa de interés', grupo: 'Condiciones', defecto: true },
  { campo: 'Facilidad_Crediticia', titulo: 'Facilidad (SB21)', grupo: 'Condiciones', defecto: false },
  { campo: 'Tipo_Credito', titulo: 'Tipo de crédito', grupo: 'Condiciones', defecto: false },
  { campo: 'Tipo_Actividad', titulo: 'Código CINU', grupo: 'Condiciones', defecto: false },
  { campo: 'Periodicidad_Pago_Capital', titulo: 'Periodicidad de pago', grupo: 'Condiciones', defecto: false },
  { campo: 'Codigo_Region', titulo: 'Región', grupo: 'Condiciones', defecto: false },
  { campo: 'Tamano_Empresa', titulo: 'Tamaño del deudor', grupo: 'Condiciones', defecto: false },
  { campo: 'Primera_Garantia', titulo: 'Garantía principal', grupo: 'Condiciones', defecto: false },
  { campo: 'Valor_Primera_Garantia', titulo: 'Valor de la garantía', grupo: 'Condiciones', defecto: false },
];
export const AGRUPACIONES = [
  { clave: 'corte', titulo: 'Corte' }, { clave: 'banco', titulo: 'Banco' }, { clave: 'actividad', titulo: 'Actividad' },
  { clave: 'subactividad', titulo: 'Subactividad' }, { clave: 'clasificacion', titulo: 'Clasificación de riesgo' },
];
const IDENTIDAD = ['Fecha', 'Codigo_Banco', 'Banco', 'Numero_Prestamo', 'Actividad', 'Subactividad'];
const COL_GRUPO = { corte: 'Fecha', banco: 'Banco', actividad: 'Actividad', subactividad: 'Subactividad', clasificacion: 'Clasificacion' };

export function opciones(estado) {
  const c = estado.catalogos;
  return {
    cortes: estado.lista().map((p) => ({ fecha: p.fecha, etiqueta: etiquetaPeriodo(p.fecha) })),
    bancos: c.bancos.map((b) => ({ codigo: b.codigo, nombre: b.nombre })),
    actividades: ORDEN_RANKINGS.map((r) => ({ ranking: r, titulo: TITULO_RANKING[r], subactividades: c.subactividades[r] })),
    clasificaciones: CLASIFICACIONES, campos: CAMPOS, agrupaciones: AGRUPACIONES,
  };
}

const lista = (v) => (Array.isArray(v) ? v.map(String) : []);

/** Devuelve { columnas, filas (arreglos de texto), saldo_total (BigInt) } según lo elegido. */
export function extraer(estado, pedido) {
  const cortes = lista(pedido.cortes).length ? lista(pedido.cortes) : estado.lista().map((p) => p.fecha);
  const bancos = new Set(lista(pedido.bancos));
  const actividades = new Set(lista(pedido.actividades).length ? lista(pedido.actividades) : ORDEN_RANKINGS);
  const subs = new Set(lista(pedido.subactividades));
  const clases = new Set(lista(pedido.clasificaciones));
  const nombreBanco = (cod) => estado.catalogos.bancoPorCodigo.get(cod)?.nombre || cod;
  const pasa = (banco, macro, sub, clase) => (!bancos.size || bancos.has(banco)) && actividades.has(macro)
    && (!subs.size || subs.has(sub)) && (!clases.size || clases.has(clase));
  const periodos = cortes.map((f) => estado.periodo(f));
  let total = 0n;

  if (pedido.nivel === 'resumen') {
    const agrupar = lista(pedido.agrupar).filter((a) => COL_GRUPO[a]);
    if (!agrupar.length) throw new ErrorDatos('Elige al menos un criterio para agrupar.');
    const grupos = new Map();
    for (const p of periodos) {
      for (const u of p.validas) {
        const clase = u.det.Clasificacion_Prestamo;
        if (!pasa(u.banco, u.macro, u.subactividad, clase)) continue;
        const valores = { corte: p.fecha, banco: nombreBanco(u.banco), actividad: TITULO_RANKING[u.macro], subactividad: u.subactividad, clasificacion: CLASIFICACIONES.find((c) => c.codigo === clase)?.nombre || clase };
        const k = agrupar.map((a) => valores[a]).join('|');
        if (!grupos.has(k)) grupos.set(k, { valores, n: 0, saldo: 0n, mora: 0n });
        const g = grupos.get(k);
        g.n++; g.saldo += u.saldo; if (u.diasMora > 0) g.mora += u.saldo;
        total += u.saldo;
      }
    }
    const columnas = [...agrupar.map((a) => COL_GRUPO[a]), 'Operaciones', 'Saldo', 'Saldo_en_mora', 'Pct_mora'];
    const filas = [...grupos.values()]
      .sort((a, b) => agrupar.map((x) => String(a.valores[x]).localeCompare(String(b.valores[x]))).find((r) => r !== 0) || 0)
      .map((g) => [...agrupar.map((a) => g.valores[a]), String(g.n), aTexto(g.saldo), aTexto(g.mora), porcentaje(g.mora, g.saldo) ?? '0.0000']);
    return { columnas, filas, saldo_total: total };
  }

  const elegidos = lista(pedido.campos).filter((c) => CAMPOS.some((x) => x.campo === c));
  const campos = elegidos.length ? elegidos : CAMPOS.filter((c) => c.defecto).map((c) => c.campo);
  const excluidas = Boolean(pedido.incluir_excluidas);
  const columnas = [...IDENTIDAD, ...campos, ...(excluidas ? ['Estado', 'Motivo'] : [])];
  const filas = [];
  for (const p of periodos) {
    for (const u of p.validas) {
      if (!pasa(u.banco, u.macro, u.subactividad, u.det.Clasificacion_Prestamo)) continue;
      total += u.saldo;
      filas.push([p.fecha, u.banco, nombreBanco(u.banco), u.prestamo, TITULO_RANKING[u.macro], u.subactividad,
        ...campos.map((c) => (c === 'Saldo' ? aTexto(u.saldo) : u.det[c] ?? '')), ...(excluidas ? ['Válida', ''] : [])]);
    }
    if (excluidas) {
      for (const e of p.excluidas) {
        if (bancos.size && !bancos.has(e.codigo_banco)) continue;
        filas.push([p.fecha, e.codigo_banco, nombreBanco(e.codigo_banco), e.numero_prestamo, '', '',
          ...campos.map((c) => (c === 'Saldo' ? e.saldo : c === 'Tipo_Actividad' ? e.tipo_actividad : '')), `Excluida (${e.filtro})`, e.motivo]);
      }
    }
  }
  return { columnas, filas, saldo_total: total };
}

export async function comoExcel(columnas, filas) {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Syntropy');
  hoja.addRow(columnas).font = { bold: true };
  // Todo como TEXTO: los códigos conservan sus ceros (07 sigue siendo 07); los montos van como número
  const numericas = new Set(['Saldo', 'Saldo_en_mora', 'Valor_Inicial', 'Intereses_por_Cobrar', 'Provision', 'Valor_Primera_Garantia', 'Operaciones', 'Dias_Mora', 'Tasa_Interes', 'Pct_mora']);
  for (const f of filas) hoja.addRow(f.map((v, i) => (numericas.has(columnas[i]) && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v)));
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await libro.xlsx.writeBuffer());
}

export const comoCsv = (columnas, filas) => escribirCsv(columnas, filas.map((f) => Object.fromEntries(columnas.map((c, i) => [c, f[i]]))));
