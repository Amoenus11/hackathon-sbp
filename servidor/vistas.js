// Arma las respuestas JSON del contrato (docs/api.md) a partir de los resultados del motor.
// Montos: texto con 2 decimales exactos. Porcentajes: texto con 4 decimales.
import { monto, porcentaje4, diezmilesimas } from '../motor/dinero.js';
import { etiqueta, etiquetaCorta } from './estado.js';
import { PERMISOS } from './acceso.js';

export const FUENTE = 'Paquete Hackathon SBP 2026 · Átomo 03 (AT03) sintético';
export const AVISO = 'Datos 100 % ficticios con fines de demostración. No representan al sistema bancario panameño ni constituyen opinión formal de la SBP.';

const m = (c) => (c === null || c === undefined ? null : monto(c));

export function meta(estado) {
  const { cat } = estado;
  return {
    periodos: estado.periodos.map((p) => ({ fecha: p.fecha, etiqueta: etiqueta(p.fecha), corta: etiquetaCorta(p.fecha), archivo: p.archivo, cargado: p.cargado, filas_leidas: p.filas_leidas })),
    ultimo: estado.ultimo,
    rankings: cat.rankings.map((r) => ({ nombre: r.nombre, titulo: r.titulo, tipo: r.tipo, subactividades: r.subactividades })),
    bancos: cat.bancos.map((b) => ({ codigo: b.codigo, nombre: b.nombre })),
    fuente: FUENTE,
    aviso: AVISO,
    parametros: estado.parametros,
    permisos: PERMISOS,
  };
}

/** Índice Herfindahl-Hirschman (0–10 000) y participación de los 3 mayores. */
function concentracion(filas, total) {
  if (!total) return { hhi: 0, nivel: 'baja', top3_pct: '0.0000' };
  let hhi = 0;
  for (const f of filas) { const s = (f.saldo_actividad / total) * 100; hhi += s * s; }
  hhi = Math.round(hhi);
  const top3 = filas.slice(0, 3).reduce((t, f) => t + f.saldo_actividad, 0);
  return { hhi, nivel: hhi < 1500 ? 'baja' : hhi <= 2500 ? 'moderada' : 'alta', top3_pct: porcentaje4(top3, total) };
}

export function panel(estado, fecha) {
  const p = estado.periodo(fecha);
  const prev = estado.anterior(p.fecha);
  const comp = prev ? estado.comparaciones.find((c) => c.hasta === p.fecha) : null;
  const excluidas = p.cascada.E1 + p.cascada.E2 + p.cascada.E3 + p.cascada.E4;
  const mora = p.bancos.reduce((t, b) => t + b.mora, 0);
  return {
    fecha: p.fecha, etiqueta: etiqueta(p.fecha), fecha_anterior: prev?.fecha ?? null,
    kpis: {
      cartera_total: m(p.saldo_universo), cartera_total_anterior: m(prev?.saldo_universo),
      var_cartera_pct: prev ? porcentaje4(p.saldo_universo - prev.saldo_universo, prev.saldo_universo) : null,
      operaciones: p.universo, operaciones_anterior: prev?.universo ?? null, bancos: estado.cat.bancos.length,
      filas_leidas: p.filas_leidas, excluidas, pct_excluidas: porcentaje4(excluidas, p.filas_leidas),
    },
    lideres: estado.cat.rankings.map((r) => {
      const f = p.rankings[r.nombre][0];
      const antes = prev?.rankings[r.nombre][0];
      return {
        ranking: r.nombre, codigo_banco: f.codigo_banco, banco: f.banco, saldo: m(f.saldo_actividad),
        ponderacion_pct: f.ponderacion_pct, participacion_pct: f.participacion_pct,
        lider_anterior: antes ? { codigo_banco: antes.codigo_banco, banco: antes.banco } : null,
      };
    }),
    composicion: estado.cat.rankings.map((r) => ({ ranking: r.nombre, saldo: m(p.total_ranking[r.nombre]), pct: porcentaje4(p.total_ranking[r.nombre], p.saldo_universo) ?? '0.0000' })),
    destacados: (comp?.explicaciones ?? []).slice(0, 6).map(({ tipo, ranking, codigo_banco, texto }) => ({ tipo, ranking, codigo_banco, texto })),
    indicadores: {
      morosidad_pct: porcentaje4(mora, p.saldo_universo),
      mora90_pct: porcentaje4(p.bancos.reduce((t, b) => t + b.mora90, 0), p.saldo_universo),
      reclasificadas_sb21: p.reclasificadas_sb21,
      concentracion: estado.cat.rankings.map((r) => ({ ranking: r.nombre, ...concentracion(p.rankings[r.nombre], p.total_ranking[r.nombre]) })),
    },
  };
}

export function rankings(estado, fecha, ranking) {
  const p = estado.periodo(fecha);
  const r = rankingValido(estado, ranking);
  const prev = estado.anterior(p.fecha);
  const antes = prev ? new Map(prev.rankings[r].map((f) => [f.codigo_banco, f])) : null;
  return {
    fecha: p.fecha, ranking: r, fecha_anterior: prev?.fecha ?? null, total_ranking: m(p.total_ranking[r]),
    filas: p.rankings[r].map((f) => {
      const a = antes?.get(f.codigo_banco);
      return {
        posicion: f.posicion, codigo_banco: f.codigo_banco, banco: f.banco,
        saldo_actividad: m(f.saldo_actividad), total_cartera: m(f.total_cartera), ponderacion_pct: f.ponderacion_pct,
        operaciones: f.operaciones, participacion_pct: f.participacion_pct,
        posicion_anterior: a?.posicion ?? null, cambio: a ? a.posicion - f.posicion : null,
        saldo_anterior: a ? m(a.saldo_actividad) : null, var_saldo_pct: a ? porcentaje4(f.saldo_actividad - a.saldo_actividad, a.saldo_actividad) : null,
      };
    }),
  };
}

export function matriz(estado, fecha) {
  const p = estado.periodo(fecha);
  return {
    fecha: p.fecha,
    rankings: estado.cat.rankings.map((r) => r.nombre),
    bancos: estado.cat.bancos.map((b) => {
      const total = p.bancos.find((x) => x.codigo_banco === b.codigo).total;
      return {
        codigo_banco: b.codigo, banco: b.nombre, total_cartera: m(total),
        celdas: estado.cat.rankings.map((r) => {
          const f = p.rankings[r.nombre].find((x) => x.codigo_banco === b.codigo);
          return { ranking: r.nombre, saldo: m(f.saldo_actividad), ponderacion_pct: f.ponderacion_pct, posicion: f.posicion };
        }),
      };
    }),
  };
}

export function historia(estado, ranking) {
  const r = rankingValido(estado, ranking);
  return {
    ranking: r,
    periodos: estado.periodos.map((p) => p.fecha),
    bancos: estado.cat.bancos.map((b) => {
      const filas = estado.periodos.map((p) => p.rankings[r].find((f) => f.codigo_banco === b.codigo));
      return { codigo_banco: b.codigo, banco: b.nombre, posiciones: filas.map((f) => f.posicion), saldos: filas.map((f) => m(f.saldo_actividad)) };
    }),
  };
}

export function desglose(estado, fecha, ranking, banco) {
  const p = estado.periodo(fecha);
  const lista = ranking ? [rankingValido(estado, ranking)] : estado.cat.rankings.map((r) => r.nombre);
  const filas = [];
  for (const r of lista) {
    for (const d of p.desglose[r]) {
      if (banco && d.codigo_banco !== banco) continue;
      filas.push({ ranking: r, codigo_banco: d.codigo_banco, banco: d.banco, subactividad: d.subactividad, saldo: m(d.saldo), operaciones: d.operaciones, reclasificadas_sb21: d.reclasificadas_sb21 });
    }
  }
  return { fecha: p.fecha, ranking: ranking ? lista[0] : null, filas };
}

export function movimientos(estado, desde, hasta, ranking) {
  if (estado.periodos.length < 2) return { desde: null, hasta: null, regla: estado.parametros, filas: [], explicaciones: [], detalle: [] };
  const h = hasta || estado.ultimo;
  const d = desde || estado.anterior(h)?.fecha;
  if (!d) throw Object.assign(new Error('No hay un período anterior para comparar.'), { estado: 400 });
  const c = estado.comparar(d, h);
  const r = ranking ? rankingValido(estado, ranking) : null;
  const filas = c.filas.filter((f) => !r || f.ranking === r);
  const expl = c.explicaciones.filter((e) => !r || e.ranking === r);
  return {
    desde: c.desde, hasta: c.hasta, regla: c.regla,
    filas: filas.map((f) => ({
      ranking: f.ranking, codigo_banco: f.codigo_banco, banco: f.banco,
      posicion_anterior: f.posicion_anterior, posicion_actual: f.posicion_actual, cambio: f.cambio,
      saldo_anterior: m(f.saldo_anterior), saldo_actual: m(f.saldo_actual), var_saldo: m(f.var_saldo), var_saldo_pct: f.var_saldo_pct,
      significativo: f.significativo, motivos: f.motivos,
    })),
    explicaciones: expl.map((e) => e.texto),
    detalle: expl.map(({ tipo, ranking: rk, codigo_banco, texto }) => ({ tipo, ranking: rk, codigo_banco, texto })),
  };
}

export function calidad(estado, fecha) {
  const p = estado.periodo(fecha);
  return {
    fecha: p.fecha, archivo: p.archivo, cargado: p.cargado, filas_leidas: p.filas_leidas,
    cascada: p.cascada, universo: p.universo, saldo_universo: m(p.saldo_universo), cuadra: p.cuadra,
    independientes: p.independientes, reconciliaciones: p.reconciliaciones, alertas: p.alertas, esquema: p.esquema,
    reclasificadas_sb21: p.reclasificadas_sb21,
  };
}

export function excluidas(estado, fecha, filtro, pagina = 1, porPagina = 50) {
  const p = estado.periodo(fecha);
  const lista = filtro ? p.excluidas.filter((e) => e.filtro === filtro) : p.excluidas;
  const n = Math.max(1, Number(pagina) || 1);
  return { total: lista.length, pagina: n, por_pagina: porPagina, filas: lista.slice((n - 1) * porPagina, n * porPagina) };
}

/** Indicadores adicionales por banco (morosidad, vencimientos, tasa promedio). No intervienen en los rankings. */
export function bancos(estado, fecha) {
  const p = estado.periodo(fecha);
  return {
    fecha: p.fecha,
    bancos: p.bancos.map((b) => ({
      codigo_banco: b.codigo_banco, banco: b.banco, total_cartera: m(b.total), operaciones: b.operaciones,
      morosidad_pct: porcentaje4(b.mora, b.total), mora90_pct: porcentaje4(b.mora90, b.total), saldo_vencido: m(b.vencido),
      tasa_promedio: b.tasa_promedio,
      por_vencer: Object.fromEntries(Object.entries(b.por_vencer).map(([k, v]) => [k, m(v)])),
    })),
  };
}

function rankingValido(estado, ranking) {
  const r = ranking || estado.cat.rankings[0].nombre;
  if (!estado.cat.rankings.some((x) => x.nombre === r)) {
    throw Object.assign(new Error(`El ranking «${r}» no existe. Opciones: ${estado.cat.rankings.map((x) => x.nombre).join(', ')}.`), { estado: 400 });
  }
  return r;
}

export { diezmilesimas };
