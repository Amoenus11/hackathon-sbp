// ============================================================================
//  Procesamiento de un corte AT03 (Secciones 4, 6 y 7 de las indicaciones).
//
//  Para cada período (campo Fecha) y en este orden:
//    A. Validación de esquema: 61 columnas con los nombres y el orden del diccionario.
//    B. Exclusiones en cascada E1 → E2 → E3 → E4 (cada fila cuenta una sola vez).
//    C. Clasificación por catálogo CINU + regla de CONSUMO (SB21), agregación exacta,
//       ponderación a 4 decimales, ranking con desempate y reconciliaciones al centavo.
//  Todo es determinista: mismas entradas → mismas salidas. La IA no interviene.
// ============================================================================
import { analizarCsv } from './csv.js';
import { centavos, sumar, porcentaje4 } from './dinero.js';
import { ErrorValidacion } from './catalogos.js';

/** Regla especial de CONSUMO (Sección 6). Códigos tal como los fija el documento del reto. */
export const REGLA_CONSUMO = {
  credito_personal: 'K.64.649.6492.64921',
  automovil: 'K.64.649.6492.64922',
  tarjeta: 'K.64.649.6499.64991',
  facilidad_tarjeta: '07',
  facilidad_auto: '03',
};

const TRAMOS_POR_VENCER = ['30_dias', '60_dias', '90_dias', '120_dias', '180_dias', '1_ano', '1_a_5_anos', '5_a_10_anos', 'mas_10_anos'];
const TRAMOS_VENCIDO = ['30_dias', '60_dias', '90_dias', '120_dias', '180_dias', '1_ano', 'mas_1_ano'];

// ---------------------------------------------------------------------------- A. esquema
export function validarEncabezado(encabezado, columnas) {
  const problemas = [];
  if (encabezado.length !== columnas.length) problemas.push(`El archivo tiene ${encabezado.length} columnas y el AT03 del reto tiene ${columnas.length}.`);
  const faltan = columnas.filter((c) => !encabezado.includes(c));
  const sobran = encabezado.filter((c) => !columnas.includes(c));
  const lista = (xs) => xs.slice(0, 5).join(', ') + (xs.length > 5 ? ` y ${xs.length - 5} más` : '');
  if (faltan.length) problemas.push(`Faltan columnas: ${lista(faltan)}.`);
  if (sobran.length) problemas.push(`Columnas que no están en el diccionario: ${lista(sobran)}.`);
  if (!faltan.length && !sobran.length) {
    const k = columnas.findIndex((c, i) => encabezado[i] !== c);
    if (k >= 0) problemas.push(`Las columnas no están en el orden del diccionario a partir de «${columnas[k]}» (posición ${k + 1}).`);
  }
  return { ok: problemas.length === 0, columnas: encabezado.length, problemas };
}

/**
 * Procesa el texto de un archivo AT03 y devuelve un resultado por cada Fecha que contenga.
 * Lanza ErrorValidacion con un mensaje claro si el archivo no es un AT03 válido.
 */
export function procesarAt03(texto, nombreArchivo, cat, cargado = new Date().toISOString()) {
  let tabla;
  try {
    tabla = analizarCsv(texto);
  } catch (e) {
    throw new ErrorValidacion(`No se pudo leer «${nombreArchivo}» como CSV: ${e.message}`);
  }
  const { encabezado, filas } = tabla;
  if (!encabezado.length) throw new ErrorValidacion(`«${nombreArchivo}» está vacío.`);
  const esquema = validarEncabezado(encabezado, cat.columnas);
  if (!esquema.ok) throw new ErrorValidacion(`«${nombreArchivo}» no tiene la estructura AT03 del reto.`, esquema.problemas);
  if (!filas.length) throw new ErrorValidacion(`«${nombreArchivo}» no tiene filas de datos.`);

  const col = Object.fromEntries(encabezado.map((c, k) => [c, k]));
  const grupos = new Map();
  for (let k = 0; k < filas.length; k++) {
    const v = filas[k];
    if (v.length !== encabezado.length) {
      throw new ErrorValidacion(`La fila ${k + 1} de «${nombreArchivo}» tiene ${v.length} campos; se esperaban ${encabezado.length}.`);
    }
    const fecha = v[col.Fecha];
    if (!fechaValida(fecha)) throw new ErrorValidacion(`La fila ${k + 1} de «${nombreArchivo}» tiene una Fecha inválida («${fecha}»). Se espera AAAAMMDD.`);
    if (!grupos.has(fecha)) grupos.set(fecha, []);
    grupos.get(fecha).push(k);
  }
  return [...grupos.keys()].sort().map((fecha) =>
    procesarPeriodo({ fecha, indices: grupos.get(fecha), filas, col, cat, archivo: nombreArchivo, cargado, esquema }));
}

function fechaValida(f) {
  if (!/^\d{8}$/.test(f)) return false;
  const a = Number(f.slice(0, 4)), m = Number(f.slice(4, 6)), d = Number(f.slice(6, 8));
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// ---------------------------------------------------------------------------- B + C
function procesarPeriodo({ fecha, indices, filas, col, cat, archivo, cargado, esquema }) {
  const cascada = { E1: 0, E2: 0, E3: 0, E4: 0 };
  const independientes = { E1: 0, E2: 0, E3: 0, E4: 0 };
  const excluidas = [];
  const alertas = { bancos: new Map(), facilidades: new Map(), tarjetaSin07: 0, autoSin03: 0, saldoIlegible: 0 };
  const vistos = new Set();
  const nombreTarjeta = cat.cinu.get(REGLA_CONSUMO.tarjeta)?.subactividad ?? 'Tarjeta';

  // Acumuladores por banco (centavos enteros)
  const acumulado = new Map();
  const banco = (codigo) => {
    let b = acumulado.get(codigo);
    if (!b) {
      b = {
        total: 0, operaciones: 0, mora: 0, mora90: 0, vencido: 0, tasaPorSaldo: 0, consumoCatalogo: 0,
        porVencer: Array(TRAMOS_POR_VENCER.length).fill(0), vencidoTramos: Array(TRAMOS_VENCIDO.length).fill(0),
        macros: new Map(cat.rankings.map((r) => [r.nombre, {
          saldo: 0, operaciones: 0,
          subs: new Map(r.subactividades.map((s) => [s, { saldo: 0, operaciones: 0, reclasificadas: 0 }])),
        }])),
      };
      acumulado.set(codigo, b);
    }
    return b;
  };
  let saldoUniverso = 0;
  let universo = 0;
  let reclasificadasSb21 = 0;
  const prestamosUniverso = new Set();
  const iPorVencer = TRAMOS_POR_VENCER.map((t) => col[`Monto_por_Vencer_${t}`]);
  const iVencido = TRAMOS_VENCIDO.map((t) => col[`Monto_Vencido_${t}`]);

  for (const k of indices) {
    const v = filas[k];
    const fila = k + 1; // número de fila de datos en el archivo (1 = primera fila después del encabezado)
    const prestamo = v[col.Numero_Prestamo];
    const destino = v[col.Destino];
    const textoSaldo = v[col.Saldo];
    const actividad = v[col.Tipo_Actividad];
    const codBanco = v[col.Codigo_Banco];
    const facilidad = v[col.Facilidad_Crediticia];
    const saldo = centavos(textoSaldo);
    const clase = cat.cinu.get(actividad);
    const repetido = vistos.has(prestamo);

    // Conteo independiente de cada regla (informativo, se reporta aparte)
    if (repetido) independientes.E1++;
    if (destino !== 'L') independientes.E2++;
    if (saldo === null || saldo <= 0) independientes.E3++;
    if (!clase) independientes.E4++;
    // Integridad referencial: alerta, no exclusión
    if (!cat.bancoPorCodigo.has(codBanco)) alertas.bancos.set(codBanco, (alertas.bancos.get(codBanco) ?? 0) + 1);
    if (!cat.sb21.has(facilidad)) alertas.facilidades.set(facilidad, (alertas.facilidades.get(facilidad) ?? 0) + 1);

    const excluir = (filtro, motivo) => {
      cascada[filtro]++;
      excluidas.push({ fila, numero_prestamo: prestamo, codigo_banco: codBanco, filtro, motivo, destino, saldo: textoSaldo, tipo_actividad: actividad });
    };
    if (repetido) { excluir('E1', 'Numero_Prestamo duplicado en el período (se conserva la primera aparición)'); continue; }
    vistos.add(prestamo);
    if (destino !== 'L') { excluir('E2', `Destino extranjero («${destino}»)`); continue; }
    if (saldo === null) { alertas.saldoIlegible++; excluir('E3', `Saldo ilegible («${textoSaldo}»)`); continue; }
    if (saldo <= 0) { excluir('E3', saldo === 0 ? 'Saldo cero' : `Saldo negativo (${textoSaldo})`); continue; }
    if (!clase) { excluir('E4', `Actividad no catalogada («${actividad}»)`); continue; }

    // --- Universo local válido: clasificar
    let sub = clase.subactividad;
    let reclasificada = false;
    if (actividad === REGLA_CONSUMO.credito_personal && facilidad === REGLA_CONSUMO.facilidad_tarjeta) {
      sub = nombreTarjeta; // es una tarjeta de crédito: se mueve de Credito personal a Tarjeta
      reclasificada = true;
      reclasificadasSb21++;
    }
    if (actividad === REGLA_CONSUMO.tarjeta && facilidad !== REGLA_CONSUMO.facilidad_tarjeta) alertas.tarjetaSin07++;
    if (actividad === REGLA_CONSUMO.automovil && facilidad !== REGLA_CONSUMO.facilidad_auto) alertas.autoSin03++;

    const b = banco(codBanco);
    const m = b.macros.get(clase.macroactividad);
    const s = m.subs.get(sub);
    s.saldo = sumar(s.saldo, saldo); s.operaciones++; if (reclasificada) s.reclasificadas++;
    m.saldo = sumar(m.saldo, saldo); m.operaciones++;
    b.total = sumar(b.total, saldo); b.operaciones++;
    if (clase.macroactividad === 'CONSUMO') b.consumoCatalogo = sumar(b.consumoCatalogo, saldo);
    // Indicadores adicionales (no intervienen en el ranking)
    const diasMora = Number(v[col.Dias_Mora]) || 0;
    if (diasMora > 0) b.mora = sumar(b.mora, saldo);
    if (diasMora > 90) b.mora90 = sumar(b.mora90, saldo);
    iPorVencer.forEach((i, t) => { b.porVencer[t] += centavos(v[i]) ?? 0; });
    iVencido.forEach((i, t) => { const c = centavos(v[i]) ?? 0; b.vencidoTramos[t] += c; b.vencido += c; });
    b.tasaPorSaldo += (Number(v[col.Tasa_Interes]) || 0) * saldo;

    saldoUniverso = sumar(saldoUniverso, saldo);
    universo++;
    prestamosUniverso.add(prestamo);
  }

  // ------------------------------------------------------------------ rankings
  const vacio = banco; // crea acumuladores en cero para bancos sin cartera
  const rankings = {};
  const totalRanking = {};
  for (const r of cat.rankings) {
    const filasR = cat.bancos.map((bk) => {
      const b = acumulado.get(bk.codigo) ?? vacio(bk.codigo);
      const m = b.macros.get(r.nombre);
      return {
        codigo_banco: bk.codigo, banco: bk.nombre, saldo_actividad: m.saldo, total_cartera: b.total,
        ponderacion_pct: porcentaje4(m.saldo, b.total) ?? '0.0000', operaciones: m.operaciones,
      };
    });
    // Mayor saldo primero; empate exacto → Codigo_Banco ascendente
    filasR.sort((a, b) => b.saldo_actividad - a.saldo_actividad || (a.codigo_banco < b.codigo_banco ? -1 : 1));
    filasR.forEach((f, k) => { f.posicion = k + 1; });
    totalRanking[r.nombre] = filasR.reduce((t, f) => sumar(t, f.saldo_actividad), 0);
    for (const f of filasR) f.participacion_pct = porcentaje4(f.saldo_actividad, totalRanking[r.nombre]) ?? '0.0000';
    rankings[r.nombre] = filasR;
  }

  // ------------------------------------------------------------------ desglose por subactividad
  const desglose = {};
  for (const r of cat.rankings) {
    desglose[r.nombre] = [];
    for (const bk of cat.bancos) {
      const m = acumulado.get(bk.codigo).macros.get(r.nombre);
      for (const [nombreSub, s] of m.subs) {
        desglose[r.nombre].push({ codigo_banco: bk.codigo, banco: bk.nombre, subactividad: nombreSub, saldo: s.saldo, operaciones: s.operaciones, reclasificadas_sb21: s.reclasificadas });
      }
    }
  }

  // ------------------------------------------------------------------ reconciliaciones (al centavo)
  let r1 = 0, r1Dif = 0, r2Dif = 0, cDif = 0;
  for (const bk of cat.bancos) {
    const b = acumulado.get(bk.codigo);
    let sumaMacros = 0;
    for (const m of b.macros.values()) {
      let sumaSubs = 0;
      for (const s of m.subs.values()) sumaSubs = sumar(sumaSubs, s.saldo);
      r1++;
      if (sumaSubs !== m.saldo) r1Dif++;
      sumaMacros = sumar(sumaMacros, m.saldo);
    }
    if (sumaMacros !== b.total) r2Dif++;
    const consumo = b.macros.get('CONSUMO');
    if (consumo) {
      let sumaSubsConsumo = 0;
      for (const s of consumo.subs.values()) sumaSubsConsumo = sumar(sumaSubsConsumo, s.saldo);
      if (sumaSubsConsumo !== b.consumoCatalogo) cDif++;
    }
  }
  const suma12 = cat.bancos.reduce((t, bk) => sumar(t, acumulado.get(bk.codigo).total), 0);
  const identidad = cascada.E1 + cascada.E2 + cascada.E3 + cascada.E4 + universo;
  const reconciliaciones = [
    { id: 'I', nombre: 'Filas leídas = E1 + E2 + E3 + E4 + universo local válido', ok: identidad === indices.length, revisados: 1, diferencias: identidad === indices.length ? 0 : 1 },
    { id: 'R1', nombre: 'Suma de subactividades = saldo de la actividad (por banco y ranking)', ok: r1Dif === 0, revisados: r1, diferencias: r1Dif },
    { id: 'R2', nombre: 'Suma de las actividades = total de cartera local válida (por banco)', ok: r2Dif === 0, revisados: cat.bancos.length, diferencias: r2Dif },
    { id: 'R3', nombre: 'Suma de los totales de los 12 bancos = saldo del universo local válido', ok: suma12 === saldoUniverso, revisados: 1, diferencias: suma12 === saldoUniverso ? 0 : 1 },
    { id: 'U', nombre: 'Cada Numero_Prestamo es único en el universo local válido', ok: prestamosUniverso.size === universo, revisados: universo, diferencias: universo - prestamosUniverso.size },
    { id: 'C', nombre: 'Total de CONSUMO por banco igual con o sin la regla SB21', ok: cDif === 0, revisados: cat.bancos.length, diferencias: cDif },
  ];

  // ------------------------------------------------------------------ alertas de calidad
  const lista = [];
  for (const [c, n] of alertas.bancos) lista.push({ tipo: 'banco_desconocido', severidad: 'alta', cantidad: n, texto: `El código de banco «${c}» no existe en Bancos_ficticios (${n} filas). No se excluye, pero no aparece en los rankings de 12 bancos.` });
  for (const [c, n] of alertas.facilidades) lista.push({ tipo: 'facilidad_desconocida', severidad: 'media', cantidad: n, texto: `La facilidad «${c}» no existe en la tabla SB21 (${n} filas). No se excluye.` });
  if (alertas.tarjetaSin07) lista.push({ tipo: 'consumo_incoherente', severidad: 'media', cantidad: alertas.tarjetaSin07, texto: `${alertas.tarjetaSin07} operaciones con CINU de Tarjeta no tienen facilidad 07; se mantienen en Tarjeta.` });
  if (alertas.autoSin03) lista.push({ tipo: 'consumo_incoherente', severidad: 'media', cantidad: alertas.autoSin03, texto: `${alertas.autoSin03} operaciones con CINU de Automóvil no tienen facilidad 03; se mantienen en Automóvil.` });
  if (alertas.saldoIlegible) lista.push({ tipo: 'saldo_ilegible', severidad: 'alta', cantidad: alertas.saldoIlegible, texto: `${alertas.saldoIlegible} saldos no son montos válidos; se excluyeron en E3.` });

  return {
    fecha, archivo, cargado,
    filas_leidas: indices.length,
    cascada, independientes,
    universo, saldo_universo: saldoUniverso,
    cuadra: identidad === indices.length,
    esquema, alertas: lista, reconciliaciones, excluidas,
    rankings, total_ranking: totalRanking, desglose,
    reclasificadas_sb21: reclasificadasSb21,
    bancos: cat.bancos.map((bk) => {
      const b = acumulado.get(bk.codigo);
      return {
        codigo_banco: bk.codigo, banco: bk.nombre, total: b.total, operaciones: b.operaciones,
        mora: b.mora, mora90: b.mora90, vencido: b.vencido,
        tasa_promedio: b.total ? Math.round((b.tasaPorSaldo / b.total) * 100) / 100 : null,
        por_vencer: Object.fromEntries(TRAMOS_POR_VENCER.map((t, i) => [t, b.porVencer[i]])),
        vencido_tramos: Object.fromEntries(TRAMOS_VENCIDO.map((t, i) => [t, b.vencidoTramos[i]])),
      };
    }),
  };
}
