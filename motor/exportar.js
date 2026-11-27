// Exportaciones oficiales del reto (Sección 10): rankings, desglose, calidad, movimientos y excluidas.
import { escribirCsv } from './csv.js';
import { ORDEN_RANKINGS, aTexto } from './motor.js';

export const COLUMNAS = {
  rankings: ['Fecha', 'Ranking', 'Posicion', 'Codigo_Banco', 'Banco', 'Saldo_Actividad', 'Total_Cartera_Local_Valida', 'Ponderacion_Pct', 'Operaciones_Validas'],
  desglose: ['Fecha', 'Ranking', 'Subactividad', 'Codigo_Banco', 'Saldo'],
  calidad: ['Fecha', 'Filas_Leidas', 'E1_Duplicados', 'E2_Destino_Extranjero', 'E3_Saldo_No_Positivo', 'E4_Actividad_No_Catalogada', 'Universo_Local_Valido', 'Saldo_Universo_Local_Valido', 'Cuadra'],
  movimientos: ['Fecha_Anterior', 'Fecha_Actual', 'Ranking', 'Codigo_Banco', 'Banco', 'Posicion_Anterior', 'Posicion_Actual', 'Cambio_Posicion', 'Saldo_Anterior', 'Saldo_Actual', 'Var_Saldo', 'Var_Saldo_Pct', 'Significativo', 'Motivo'],
  excluidas: ['Fecha', 'Fila', 'Numero_Prestamo', 'Codigo_Banco', 'Filtro', 'Motivo'],
  // Complemento del reporte de calidad (no es uno de los 5 entregables oficiales): alertas que no excluyen filas
  alertas: ['Fecha', 'Tipo', 'Severidad', 'Cantidad', 'Descripcion', 'Reconciliaciones_Con_Diferencias'],
  anatomia: ['Fecha_Anterior', 'Fecha_Actual', 'Ranking', 'Codigo_Banco', 'Banco', 'Saldo_Anterior', 'Prestamos_Nuevos', 'Saldo_Nuevos',
    'Prestamos_Terminados', 'Saldo_Terminados', 'Prestamos_Que_Siguen', 'Variacion_Que_Siguen', 'Saldo_Actual'],
};

export function filasRankings(periodos) {
  const filas = [];
  for (const p of periodos) {
    for (const macro of ORDEN_RANKINGS) {
      for (const f of p.rankings[macro]) {
        filas.push({
          Fecha: p.fecha, Ranking: macro, Posicion: f.posicion, Codigo_Banco: f.codigo_banco, Banco: f.banco,
          Saldo_Actividad: aTexto(f.saldo_actividad), Total_Cartera_Local_Valida: aTexto(f.total_cartera),
          Ponderacion_Pct: f.ponderacion_pct, Operaciones_Validas: f.operaciones,
        });
      }
    }
  }
  return filas;
}

export function filasDesglose(periodos) {
  const filas = [];
  for (const p of periodos) {
    for (const macro of ORDEN_RANKINGS) {
      for (const f of p.desglose[macro]) {
        filas.push({ Fecha: p.fecha, Ranking: macro, Subactividad: f.subactividad, Codigo_Banco: f.codigo_banco, Saldo: aTexto(f.saldo) });
      }
    }
  }
  return filas;
}

export function filasCalidad(periodos) {
  return periodos.map((p) => ({
    Fecha: p.fecha, Filas_Leidas: p.filas_leidas, E1_Duplicados: p.cascada.E1, E2_Destino_Extranjero: p.cascada.E2,
    E3_Saldo_No_Positivo: p.cascada.E3, E4_Actividad_No_Catalogada: p.cascada.E4, Universo_Local_Valido: p.universo,
    Saldo_Universo_Local_Valido: aTexto(p.saldo_universo), Cuadra: p.cuadra ? 'SI' : 'NO',
  }));
}

export function filasMovimientos(comparaciones) {
  const filas = [];
  for (const c of comparaciones) {
    for (const f of c.filas) {
      filas.push({
        Fecha_Anterior: f.fecha_anterior, Fecha_Actual: f.fecha_actual, Ranking: f.ranking, Codigo_Banco: f.codigo_banco, Banco: f.banco,
        Posicion_Anterior: f.posicion_anterior, Posicion_Actual: f.posicion_actual, Cambio_Posicion: f.cambio,
        Saldo_Anterior: aTexto(f.saldo_anterior), Saldo_Actual: aTexto(f.saldo_actual), Var_Saldo: aTexto(f.var_saldo),
        Var_Saldo_Pct: f.var_saldo_pct ?? 'NA', Significativo: f.significativo ? 'SI' : 'NO', Motivo: f.motivos.join('; '),
      });
    }
  }
  return filas;
}

export function filasExcluidas(periodos) {
  const filas = [];
  for (const p of periodos) {
    for (const e of p.excluidas) filas.push({ Fecha: p.fecha, Fila: e.fila, Numero_Prestamo: e.numero_prestamo, Codigo_Banco: e.codigo_banco, Filtro: e.filtro, Motivo: e.motivo });
  }
  return filas;
}

export function filasAlertas(periodos) {
  const filas = [];
  for (const p of periodos) {
    const fallan = p.reconciliaciones.filter((r) => !r.ok).map((r) => r.id).join(' ');
    for (const a of p.alertas) filas.push({ Fecha: p.fecha, Tipo: a.tipo, Severidad: a.severidad, Cantidad: a.cantidad, Descripcion: a.texto, Reconciliaciones_Con_Diferencias: fallan });
    for (const r of p.reconciliaciones.filter((x) => !x.ok)) filas.push({ Fecha: p.fecha, Tipo: `reconciliacion_${r.id}`, Severidad: 'alta', Cantidad: r.diferencias, Descripcion: `No cuadra: ${r.nombre}`, Reconciliaciones_Con_Diferencias: fallan });
  }
  return filas;
}

export function filasAnatomia(comparaciones) {
  const filas = [];
  for (const c of comparaciones) {
    for (const f of c.filas) {
      const a = f.anatomia;
      if (!a) continue;
      filas.push({
        Fecha_Anterior: f.fecha_anterior, Fecha_Actual: f.fecha_actual, Ranking: f.ranking, Codigo_Banco: f.codigo_banco, Banco: f.banco,
        Saldo_Anterior: aTexto(f.saldo_anterior), Prestamos_Nuevos: a.n_nuevos, Saldo_Nuevos: aTexto(a.nuevos),
        Prestamos_Terminados: a.n_terminados, Saldo_Terminados: aTexto(a.terminados), Prestamos_Que_Siguen: a.n_siguen,
        Variacion_Que_Siguen: aTexto(a.variacion), Saldo_Actual: aTexto(f.saldo_actual),
      });
    }
  }
  return filas;
}

export const generar = {
  rankings: (periodos) => escribirCsv(COLUMNAS.rankings, filasRankings(periodos)),
  desglose: (periodos) => escribirCsv(COLUMNAS.desglose, filasDesglose(periodos)),
  calidad: (periodos) => escribirCsv(COLUMNAS.calidad, filasCalidad(periodos)),
  movimientos: (_periodos, comparaciones) => escribirCsv(COLUMNAS.movimientos, filasMovimientos(comparaciones)),
  excluidas: (periodos) => escribirCsv(COLUMNAS.excluidas, filasExcluidas(periodos)),
  alertas: (periodos) => escribirCsv(COLUMNAS.alertas, filasAlertas(periodos)),
  anatomia: (_periodos, comparaciones) => escribirCsv(COLUMNAS.anatomia, filasAnatomia(comparaciones)),
};
