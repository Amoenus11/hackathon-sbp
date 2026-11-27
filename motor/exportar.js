// Exportaciones oficiales (entregables 2 a 5 + lista de excluidas). Mismas columnas que docs/api.md.
import { generarCsv } from './csv.js';
import { monto } from './dinero.js';

export const COLUMNAS = {
  rankings: ['Fecha', 'Ranking', 'Posicion', 'Codigo_Banco', 'Banco', 'Saldo_Actividad', 'Total_Cartera_Local_Valida', 'Ponderacion_Pct', 'Operaciones_Validas'],
  desglose: ['Fecha', 'Ranking', 'Subactividad', 'Codigo_Banco', 'Saldo'],
  calidad: ['Fecha', 'Filas_Leidas', 'E1_Duplicados', 'E2_Destino_Extranjero', 'E3_Saldo_No_Positivo', 'E4_Actividad_No_Catalogada', 'Universo_Local_Valido', 'Saldo_Universo_Local_Valido', 'Cuadra'],
  movimientos: ['Fecha_Anterior', 'Fecha_Actual', 'Ranking', 'Codigo_Banco', 'Banco', 'Posicion_Anterior', 'Posicion_Actual', 'Cambio_Posicion', 'Saldo_Anterior', 'Saldo_Actual', 'Var_Saldo', 'Var_Saldo_Pct', 'Significativo', 'Motivo'],
  excluidas: ['Fecha', 'Fila', 'Numero_Prestamo', 'Codigo_Banco', 'Filtro', 'Motivo'],
};

export const TIPOS_EXPORTACION = Object.keys(COLUMNAS);

export function filasRankings(periodos, cat, { ranking, banco } = {}) {
  const out = [];
  for (const p of periodos) {
    for (const r of cat.rankings) {
      if (ranking && r.nombre !== ranking) continue;
      for (const f of p.rankings[r.nombre]) {
        if (banco && f.codigo_banco !== banco) continue;
        out.push({
          Fecha: p.fecha, Ranking: r.nombre, Posicion: f.posicion, Codigo_Banco: f.codigo_banco, Banco: f.banco,
          Saldo_Actividad: monto(f.saldo_actividad), Total_Cartera_Local_Valida: monto(f.total_cartera),
          Ponderacion_Pct: f.ponderacion_pct, Operaciones_Validas: f.operaciones,
        });
      }
    }
  }
  return out;
}

export function filasDesglose(periodos, cat, { ranking, banco } = {}) {
  const out = [];
  for (const p of periodos) {
    for (const r of cat.rankings) {
      if (ranking && r.nombre !== ranking) continue;
      for (const f of p.desglose[r.nombre]) {
        if (banco && f.codigo_banco !== banco) continue;
        out.push({ Fecha: p.fecha, Ranking: r.nombre, Subactividad: f.subactividad, Codigo_Banco: f.codigo_banco, Saldo: monto(f.saldo) });
      }
    }
  }
  return out;
}

export function filasCalidad(periodos) {
  return periodos.map((p) => ({
    Fecha: p.fecha, Filas_Leidas: p.filas_leidas,
    E1_Duplicados: p.cascada.E1, E2_Destino_Extranjero: p.cascada.E2, E3_Saldo_No_Positivo: p.cascada.E3, E4_Actividad_No_Catalogada: p.cascada.E4,
    Universo_Local_Valido: p.universo, Saldo_Universo_Local_Valido: monto(p.saldo_universo), Cuadra: p.cuadra ? 'SI' : 'NO',
  }));
}

export function filasMovimientos(comparaciones, { ranking, banco, soloSignificativos } = {}) {
  const out = [];
  for (const c of comparaciones) {
    for (const f of c.filas) {
      if (ranking && f.ranking !== ranking) continue;
      if (banco && f.codigo_banco !== banco) continue;
      if (soloSignificativos && !f.significativo) continue;
      out.push({
        Fecha_Anterior: f.fecha_anterior, Fecha_Actual: f.fecha_actual, Ranking: f.ranking, Codigo_Banco: f.codigo_banco, Banco: f.banco,
        Posicion_Anterior: f.posicion_anterior, Posicion_Actual: f.posicion_actual, Cambio_Posicion: f.cambio,
        Saldo_Anterior: monto(f.saldo_anterior), Saldo_Actual: monto(f.saldo_actual), Var_Saldo: monto(f.var_saldo),
        Var_Saldo_Pct: f.var_saldo_pct ?? 'NA', Significativo: f.significativo ? 'SI' : 'NO', Motivo: f.motivos.join('; '),
      });
    }
  }
  return out;
}

export function filasExcluidas(periodos, { filtro } = {}) {
  const out = [];
  for (const p of periodos) {
    for (const e of p.excluidas) {
      if (filtro && e.filtro !== filtro) continue;
      out.push({ Fecha: p.fecha, Fila: e.fila, Numero_Prestamo: e.numero_prestamo, Codigo_Banco: e.codigo_banco, Filtro: e.filtro, Motivo: e.motivo });
    }
  }
  return out;
}

/** Genera el CSV de una exportación. */
export function exportarCsv(tipo, { periodos, comparaciones, cat, filtros = {} }) {
  const filas = {
    rankings: () => filasRankings(periodos, cat, filtros),
    desglose: () => filasDesglose(periodos, cat, filtros),
    calidad: () => filasCalidad(periodos),
    movimientos: () => filasMovimientos(comparaciones, filtros),
    excluidas: () => filasExcluidas(periodos, filtros),
  }[tipo];
  if (!filas) throw new Error(`Exportación desconocida: ${tipo}`);
  return generarCsv(COLUMNAS[tipo], filas());
}
