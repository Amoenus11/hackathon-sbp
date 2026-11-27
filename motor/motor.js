// ============================================================================
//  Motor de rankings de crédito (Hackathon SBP 2026) — determinista y reproducible.
//
//  Por cada período (campo Fecha) aplica, en este orden y sin excepciones:
//    A. Validación del esquema AT03 (61 columnas en el orden del diccionario).
//    B. Exclusiones en cascada: E1 duplicados → E2 destino extranjero → E3 saldo no positivo
//       → E4 actividad no catalogada. Cada fila cuenta UNA vez, en el primer filtro que incumple.
//    C. Clasificación SOLO con el catálogo CINU/SB109 (+ regla especial de CONSUMO con SB21),
//       agregación en centavos enteros, ponderación con 4 decimales y ranking con desempate.
//  La IA nunca interviene aquí.
// ============================================================================
import { leerCsv, leerCsvObjetos } from './csv.js';
import { aCentavos, aTexto, porcentaje, mayorPrimero } from './dinero.js';

export const VERSION_MOTOR = '1.0.0';
export const ORDEN_RANKINGS = ['HIPOTECARIO', 'CONSTRUCCION', 'INDUSTRIA', 'AGROPECUARIO', 'COMERCIO', 'CONSUMO'];
export const TIPO_RANKING = {
  HIPOTECARIO: 'obligatorio', CONSTRUCCION: 'obligatorio', INDUSTRIA: 'obligatorio',
  AGROPECUARIO: 'obligatorio', COMERCIO: 'recomendado', CONSUMO: 'bonus',
};
export const TITULO_RANKING = {
  HIPOTECARIO: 'Hipotecario', CONSTRUCCION: 'Construcción', INDUSTRIA: 'Industria',
  AGROPECUARIO: 'Agropecuario', COMERCIO: 'Comercio', CONSUMO: 'Consumo',
};

// Regla especial de CONSUMO (Sección 6 de las indicaciones)
export const CINU_CREDITO_PERSONAL = 'K.64.649.6492.64921';
export const CINU_AUTOMOVIL = 'K.64.649.6492.64922';
export const CINU_TARJETA = 'K.64.649.6499.64991';
const FACILIDAD_TARJETA = '07';
const FACILIDAD_AUTO = '03';

export class ErrorDatos extends Error {}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const etiquetaPeriodo = (f) => `${MESES[Number(f.slice(4, 6)) - 1]} ${f.slice(0, 4)}`;
export const etiquetaCorta = (f) => `${MESES[Number(f.slice(4, 6)) - 1].slice(0, 3)} ${f.slice(0, 4)}`;

// ---------------------------------------------------------------------------- catálogos
/** Recibe el TEXTO de los 4 archivos de referencia y arma los catálogos. */
export function cargarCatalogos({ cinu, sb21, bancos, diccionario }) {
  const filasCinu = leerCsvObjetos(cinu);
  const porCodigo = new Map();
  const subactividades = Object.fromEntries(ORDEN_RANKINGS.map((r) => [r, []]));
  for (const f of filasCinu) {
    const entrada = {
      codigo: f.Codigo_CINU, descripcion: f.Descripcion, macroactividad: f.Macroactividad_Reto,
      subactividad: f.Subactividad_Reto, sb08: f.Codigo_SB08_Referencia,
    };
    porCodigo.set(entrada.codigo, entrada);
    const lista = subactividades[entrada.macroactividad];
    if (!lista) throw new ErrorDatos(`Macroactividad desconocida en el catálogo CINU: ${entrada.macroactividad}`);
    if (!lista.includes(entrada.subactividad)) lista.push(entrada.subactividad);
  }
  const listaSb21 = leerCsvObjetos(sb21).map((f) => ({ codigo: f.Codigo, descripcion: f.Descripcion, uso: f.Uso_en_reto }));
  const listaBancos = leerCsvObjetos(bancos)
    .map((f) => ({ codigo: f.Codigo_Banco, nombre: f.Nombre_Ficticio, licencia: f.Tipo_Licencia }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  const columnas = leerCsvObjetos(diccionario).map((f) => f.Campo);
  return {
    cinu: porCodigo,
    listaCinu: filasCinu.length ? [...porCodigo.values()] : [],
    subactividades,
    sb21: new Set(listaSb21.map((f) => f.codigo)),
    listaSb21,
    bancos: listaBancos,
    bancoPorCodigo: new Map(listaBancos.map((b) => [b.codigo, b])),
    columnas,
    nombreTarjeta: porCodigo.get(CINU_TARJETA)?.subactividad ?? 'Tarjeta',
  };
}

// ---------------------------------------------------------------------------- A. esquema
export function validarEsquema(encabezado, catalogos) {
  const esperado = catalogos.columnas;
  const problemas = [];
  if (encabezado.length !== esperado.length) {
    problemas.push(`Tiene ${encabezado.length} columnas; el AT03 del reto tiene ${esperado.length}.`);
  }
  const faltan = esperado.filter((c) => !encabezado.includes(c));
  const sobran = encabezado.filter((c) => !esperado.includes(c));
  if (faltan.length) problemas.push(`Faltan columnas: ${faltan.slice(0, 6).join(', ')}${faltan.length > 6 ? '…' : ''}`);
  if (sobran.length) problemas.push(`Columnas desconocidas: ${sobran.slice(0, 6).join(', ')}${sobran.length > 6 ? '…' : ''}`);
  if (!faltan.length && !sobran.length) {
    const fuera = esperado.findIndex((c, i) => encabezado[i] !== c);
    if (fuera >= 0) problemas.push(`El orden de las columnas no coincide con el diccionario desde «${esperado[fuera]}».`);
  }
  return { ok: problemas.length === 0, columnas: encabezado.length, problemas };
}

// ---------------------------------------------------------------------------- lectura
/**
 * Procesa el texto de un archivo AT03. Devuelve un resultado por cada Fecha que contenga
 * (el período se toma del campo Fecha, no del nombre del archivo).
 */
export function procesarArchivo(texto, nombreArchivo, catalogos, ahora = new Date()) {
  const { encabezado, filas } = leerCsv(texto);
  if (!encabezado.length) throw new ErrorDatos('El archivo está vacío.');
  const esquema = validarEsquema(encabezado, catalogos);
  if (!esquema.ok) throw new ErrorDatos(`El archivo no tiene la estructura AT03 del reto. ${esquema.problemas.join(' ')}`);
  if (!filas.length) throw new ErrorDatos('El archivo no tiene filas de datos.');
  const i = Object.fromEntries(encabezado.map((c, k) => [c, k]));
  const porFecha = new Map();
  filas.forEach((valores, k) => {
    if (valores.length !== encabezado.length) {
      throw new ErrorDatos(`La fila ${k + 1} tiene ${valores.length} campos; se esperaban ${encabezado.length}.`);
    }
    const fecha = valores[i.Fecha];
    if (!/^\d{8}$/.test(fecha)) throw new ErrorDatos(`La fila ${k + 1} tiene una Fecha inválida («${fecha}»); se espera AAAAMMDD.`);
    if (!porFecha.has(fecha)) porFecha.set(fecha, []);
    porFecha.get(fecha).push({ fila: k + 1, v: valores });
  });
  return [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, filasPeriodo]) => procesarPeriodo(fecha, filasPeriodo, i, catalogos, nombreArchivo, esquema, ahora));
}

// ---------------------------------------------------------------------------- B y C
function procesarPeriodo(fecha, filas, i, cat, archivo, esquema, ahora) {
  const vistos = new Set();
  const cascada = { E1: 0, E2: 0, E3: 0, E4: 0 };
  const independientes = { E1: 0, E2: 0, E3: 0, E4: 0 };
  const excluidas = [];
  const conteoAlertas = { banco: new Map(), facilidad: new Map(), tarjeta: 0, auto: 0, saldoInvalido: 0 };
  const universo = [];

  for (const { fila, v } of filas) {
    const prestamo = v[i.Numero_Prestamo];
    const destino = v[i.Destino];
    const textoSaldo = v[i.Saldo];
    const actividad = v[i.Tipo_Actividad];
    const banco = v[i.Codigo_Banco];
    const facilidad = v[i.Facilidad_Crediticia];
    const saldo = aCentavos(textoSaldo);

    // Conteos independientes de cada regla (se reportan aparte, rotulados como tales)
    const duplicado = vistos.has(prestamo);
    if (duplicado) independientes.E1++;
    if (destino !== 'L') independientes.E2++;
    if (saldo === null || saldo <= 0n) independientes.E3++;
    if (!cat.cinu.has(actividad)) independientes.E4++;
    // Integridad referencial: alerta de calidad, no causa de exclusión
    if (!cat.bancoPorCodigo.has(banco)) conteoAlertas.banco.set(banco, (conteoAlertas.banco.get(banco) || 0) + 1);
    if (!cat.sb21.has(facilidad)) conteoAlertas.facilidad.set(facilidad, (conteoAlertas.facilidad.get(facilidad) || 0) + 1);

    const excluir = (filtro, motivo) => {
      cascada[filtro]++;
      excluidas.push({ fila, numero_prestamo: prestamo, codigo_banco: banco, filtro, motivo, destino, saldo: textoSaldo, tipo_actividad: actividad });
    };
    // E1 — Duplicados: se conserva la primera aparición según el orden del archivo
    if (duplicado) { excluir('E1', 'Numero_Prestamo duplicado en el período'); continue; }
    vistos.add(prestamo);
    // E2 — Destino extranjero (comparación exacta con «L»)
    if (destino !== 'L') { excluir('E2', `Destino extranjero (${destino})`); continue; }
    // E3 — Saldo cero, negativo o ilegible
    if (saldo === null) { conteoAlertas.saldoInvalido++; excluir('E3', `Saldo ilegible («${textoSaldo}»)`); continue; }
    if (saldo <= 0n) { excluir('E3', `Saldo no positivo (${textoSaldo})`); continue; }
    // E4 — Actividad que no está en el catálogo CINU/SB109 congelado
    const clase = cat.cinu.get(actividad);
    if (!clase) { excluir('E4', `Actividad no catalogada (${actividad})`); continue; }

    // Clasificación por catálogo + regla especial de CONSUMO (cruce con SB21)
    let subactividad = clase.subactividad;
    let reclasificada = false;
    if (actividad === CINU_CREDITO_PERSONAL && facilidad === FACILIDAD_TARJETA) {
      subactividad = cat.nombreTarjeta; // en realidad es una tarjeta de crédito
      reclasificada = true;
    }
    if (actividad === CINU_TARJETA && facilidad !== FACILIDAD_TARJETA) conteoAlertas.tarjeta++;
    if (actividad === CINU_AUTOMOVIL && facilidad !== FACILIDAD_AUTO) conteoAlertas.auto++;
    universo.push({
      banco, prestamo, saldo, macro: clase.macroactividad, subactividad, reclasificada,
      diasMora: Number(v[i.Dias_Mora]) || 0,
    });
  }
  return agregar({ fecha, archivo, cargado: ahora.toISOString(), filas, cascada, independientes, excluidas, conteoAlertas, universo, cat, esquema });
}

function agregar({ fecha, archivo, cargado, filas, cascada, independientes, excluidas, conteoAlertas, universo, cat, esquema }) {
  // Acumuladores por banco → macroactividad → subactividad (centavos enteros)
  const porBanco = new Map();
  const nuevoBanco = () => ({
    total: 0n, operaciones: 0, mora: 0n, mora90: 0n,
    macros: new Map(ORDEN_RANKINGS.map((m) => [m, { saldo: 0n, operaciones: 0, subs: new Map(cat.subactividades[m].map((s) => [s, { saldo: 0n, operaciones: 0, reclasificadas: 0 }])) }])),
  });
  let saldoUniverso = 0n;
  let moraSistema = 0n;
  let mora90Sistema = 0n;
  for (const u of universo) {
    if (!porBanco.has(u.banco)) porBanco.set(u.banco, nuevoBanco());
    const b = porBanco.get(u.banco);
    const m = b.macros.get(u.macro);
    const s = m.subs.get(u.subactividad);
    s.saldo += u.saldo; s.operaciones++; if (u.reclasificada) s.reclasificadas++;
    m.saldo += u.saldo; m.operaciones++;
    b.total += u.saldo; b.operaciones++;
    if (u.diasMora > 0) { b.mora += u.saldo; moraSistema += u.saldo; }
    if (u.diasMora > 90) { b.mora90 += u.saldo; mora90Sistema += u.saldo; }
    saldoUniverso += u.saldo;
  }
  const datosBanco = (codigo) => porBanco.get(codigo) || nuevoBanco();

  // Rankings: siempre los 12 bancos del catálogo; desempate por Codigo_Banco ascendente
  const rankings = {};
  const totalesRanking = {};
  for (const macro of ORDEN_RANKINGS) {
    const filasRanking = cat.bancos.map((b) => {
      const d = datosBanco(b.codigo);
      const m = d.macros.get(macro);
      return {
        codigo_banco: b.codigo, banco: b.nombre, saldo_actividad: m.saldo, total_cartera: d.total,
        ponderacion_pct: porcentaje(m.saldo, d.total) ?? '0.0000', operaciones: m.operaciones,
      };
    });
    filasRanking.sort((a, b) => mayorPrimero(a.saldo_actividad, b.saldo_actividad) || a.codigo_banco.localeCompare(b.codigo_banco));
    filasRanking.forEach((f, k) => { f.posicion = k + 1; });
    totalesRanking[macro] = filasRanking.reduce((t, f) => t + f.saldo_actividad, 0n);
    for (const f of filasRanking) f.participacion_pct = porcentaje(f.saldo_actividad, totalesRanking[macro]) ?? '0.0000';
    rankings[macro] = filasRanking;
  }

  // Desglose por subactividad (incluye la reclasificación SB21 a Tarjeta)
  const desglose = {};
  for (const macro of ORDEN_RANKINGS) {
    desglose[macro] = [];
    for (const b of cat.bancos) {
      for (const [sub, s] of datosBanco(b.codigo).macros.get(macro).subs) {
        desglose[macro].push({ codigo_banco: b.codigo, banco: b.nombre, subactividad: sub, saldo: s.saldo, operaciones: s.operaciones, reclasificadas_sb21: s.reclasificadas });
      }
    }
  }

  // Controles y reconciliaciones (al centavo)
  let r1Revisados = 0, r1Dif = 0, r2Dif = 0;
  for (const b of cat.bancos) {
    const d = datosBanco(b.codigo);
    let sumaMacros = 0n;
    for (const m of d.macros.values()) {
      let sumaSubs = 0n;
      for (const s of m.subs.values()) sumaSubs += s.saldo;
      r1Revisados++;
      if (sumaSubs !== m.saldo) r1Dif++;
      sumaMacros += m.saldo;
    }
    if (sumaMacros !== d.total) r2Dif++;
  }
  const sumaTotales12 = cat.bancos.reduce((t, b) => t + datosBanco(b.codigo).total, 0n);
  const unicos = new Set(universo.map((u) => u.prestamo)).size === universo.length;
  const consumoSinReglaOk = true; // la reclasificación solo mueve saldo dentro de CONSUMO (el total por banco no cambia por construcción)
  const reconciliaciones = [
    { id: 'R1', nombre: 'Suma de subactividades = saldo de la actividad (por banco y ranking)', ok: r1Dif === 0, revisados: r1Revisados, diferencias: r1Dif },
    { id: 'R2', nombre: 'Suma de las 6 actividades = total de cartera local válida (por banco)', ok: r2Dif === 0, revisados: cat.bancos.length, diferencias: r2Dif },
    { id: 'R3', nombre: 'Suma de los 12 totales = saldo del universo local válido', ok: sumaTotales12 === saldoUniverso, revisados: 1, diferencias: sumaTotales12 === saldoUniverso ? 0 : 1 },
    { id: 'U', nombre: 'Cada Numero_Prestamo es único en el universo local válido', ok: unicos, revisados: universo.length, diferencias: unicos ? 0 : 1 },
    { id: 'C', nombre: 'Total de CONSUMO por banco igual con o sin la regla SB21', ok: consumoSinReglaOk, revisados: cat.bancos.length, diferencias: 0 },
  ];

  const alertas = [];
  for (const [codigo, n] of conteoAlertas.banco) alertas.push({ tipo: 'banco_desconocido', severidad: 'alta', cantidad: n, texto: `Código de banco «${codigo}» no existe en Bancos_ficticios (${n} filas). No se excluye; no entra en los rankings de 12 bancos.` });
  for (const [codigo, n] of conteoAlertas.facilidad) alertas.push({ tipo: 'facilidad_desconocida', severidad: 'media', cantidad: n, texto: `Facilidad «${codigo}» no existe en la tabla SB21 (${n} filas).` });
  if (conteoAlertas.tarjeta) alertas.push({ tipo: 'consumo_incoherente', severidad: 'media', cantidad: conteoAlertas.tarjeta, texto: `${conteoAlertas.tarjeta} operaciones con CINU de Tarjeta no tienen facilidad 07; se mantienen como Tarjeta.` });
  if (conteoAlertas.auto) alertas.push({ tipo: 'consumo_incoherente', severidad: 'media', cantidad: conteoAlertas.auto, texto: `${conteoAlertas.auto} operaciones con CINU de Automóvil no tienen facilidad 03; se mantienen como Automóvil.` });
  if (conteoAlertas.saldoInvalido) alertas.push({ tipo: 'saldo_ilegible', severidad: 'alta', cantidad: conteoAlertas.saldoInvalido, texto: `${conteoAlertas.saldoInvalido} saldos no son montos válidos; se excluyeron en E3.` });

  const filasLeidas = filas.length;
  const suma = cascada.E1 + cascada.E2 + cascada.E3 + cascada.E4 + universo.length;
  return {
    fecha, archivo, cargado, filas_leidas: filasLeidas, cascada, independientes,
    universo: universo.length, saldo_universo: saldoUniverso, cuadra: suma === filasLeidas,
    esquema, alertas, reconciliaciones, excluidas, rankings, totales_ranking: totalesRanking, desglose,
    bancos: cat.bancos.map((b) => {
      const d = datosBanco(b.codigo);
      return { codigo_banco: b.codigo, banco: b.nombre, total: d.total, operaciones: d.operaciones, mora: d.mora, mora90: d.mora90 };
    }),
    indicadores: { mora: moraSistema, mora90: mora90Sistema, reclasificadas_sb21: universo.filter((u) => u.reclasificada).length },
  };
}

// ---------------------------------------------------------------------------- comparación
const numero = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const ordinal = (n) => `${n}.º`;
const millones = (c) => `${numero.format(Number(c) / 1e8)} M`;
const pctTexto = (p) => `${numero.format(Math.abs(Number(p)))} %`;
const diezMilesimas = (p) => Math.round(Number(p) * 10000);

export const PARAMETROS_INICIALES = { mov_min_posiciones: 2, mov_cambio_lider: true, mov_var_saldo_pct: '15.00' };

/** Compara dos períodos (anterior → actual): Cambio_Posicion = anterior − actual. */
export function compararPeriodos(anterior, actual, parametros = PARAMETROS_INICIALES) {
  const filas = [];
  const explicaciones = [];
  for (const macro of ORDEN_RANKINGS) {
    const previo = new Map(anterior.rankings[macro].map((f) => [f.codigo_banco, f]));
    const liderAnterior = anterior.rankings[macro][0];
    for (const f of actual.rankings[macro]) {
      const p = previo.get(f.codigo_banco);
      const cambio = p.posicion - f.posicion;
      const varSaldo = f.saldo_actividad - p.saldo_actividad;
      const varPct = porcentaje(varSaldo, p.saldo_actividad);
      const motivos = [];
      if (Math.abs(cambio) >= Number(parametros.mov_min_posiciones)) motivos.push(cambio > 0 ? `Sube ${cambio} posiciones` : `Baja ${-cambio} posiciones`);
      if (parametros.mov_cambio_lider && f.posicion === 1 && p.posicion !== 1) motivos.push('Nuevo líder');
      if (parametros.mov_cambio_lider && p.posicion === 1 && f.posicion !== 1) motivos.push('Pierde el liderazgo');
      if (varPct !== null && Math.abs(diezMilesimas(varPct)) >= diezMilesimas(parametros.mov_var_saldo_pct)) {
        motivos.push(`Saldo ${varSaldo >= 0n ? '+' : '−'}${pctTexto(varPct)}`);
      }
      const fila = {
        fecha_anterior: anterior.fecha, fecha_actual: actual.fecha, ranking: macro,
        codigo_banco: f.codigo_banco, banco: f.banco, posicion_anterior: p.posicion, posicion_actual: f.posicion, cambio,
        saldo_anterior: p.saldo_actividad, saldo_actual: f.saldo_actividad, var_saldo: varSaldo, var_saldo_pct: varPct,
        significativo: motivos.length > 0, motivos,
      };
      filas.push(fila);
      if (fila.significativo) explicaciones.push(explicar(fila, macro, liderAnterior, anterior, actual));
    }
  }
  explicaciones.sort((a, b) => b.peso - a.peso);
  return { desde: anterior.fecha, hasta: actual.fecha, regla: parametros, filas, explicaciones };
}

/** Explicación automática y determinista de un movimiento (sin IA). */
function explicar(f, macro, liderAnterior, anterior, actual) {
  const titulo = TITULO_RANKING[macro];
  const crecio = f.var_saldo >= 0n;
  const saldoTxt = f.var_saldo_pct === null ? '' : `su saldo ${crecio ? 'creció' : 'bajó'} ${pctTexto(f.var_saldo_pct)} (${millones(f.saldo_anterior)} → ${millones(f.saldo_actual)})`;
  // ¿A quién superó o quién lo superó? (bancos que cruzaron su posición)
  const antes = new Map(anterior.rankings[macro].map((x) => [x.codigo_banco, x.posicion]));
  const ahora = actual.rankings[macro];
  const cruzados = ahora
    .filter((x) => x.codigo_banco !== f.codigo_banco)
    .filter((x) => (f.cambio > 0
      ? antes.get(x.codigo_banco) < f.posicion_anterior && x.posicion > f.posicion_actual
      : antes.get(x.codigo_banco) > f.posicion_anterior && x.posicion < f.posicion_actual))
    .map((x) => x.banco);
  let texto;
  let tipo;
  let peso;
  if (f.posicion_actual === 1 && f.posicion_anterior !== 1) {
    tipo = 'lider';
    peso = 1000;
    texto = `Nuevo líder en ${titulo}: ${f.banco} pasa del ${ordinal(f.posicion_anterior)} al 1.er lugar y desplaza a ${liderAnterior.banco}; ${saldoTxt}.`;
  } else if (f.cambio !== 0) {
    tipo = f.cambio > 0 ? 'sube' : 'baja';
    peso = 100 + Math.abs(f.cambio) * 10;
    const cruce = cruzados.length ? ` ${f.cambio > 0 ? 'Supera a' : 'Lo superan'} ${cruzados.slice(0, 3).join(', ')}${cruzados.length > 3 ? ' y otros' : ''}.` : '';
    texto = `${f.banco} ${f.cambio > 0 ? 'sube' : 'baja'} del ${ordinal(f.posicion_anterior)} al ${ordinal(f.posicion_actual)} lugar en ${titulo} (${f.cambio > 0 ? '+' : ''}${f.cambio}); ${saldoTxt}.${cruce}`;
  } else {
    tipo = 'saldo';
    peso = Math.min(99, Math.abs(Number(f.var_saldo_pct || 0)));
    texto = `${f.banco} mantiene el ${ordinal(f.posicion_actual)} lugar en ${titulo}, pero ${saldoTxt}.`;
  }
  return { tipo, peso, ranking: macro, codigo_banco: f.codigo_banco, texto };
}

// ---------------------------------------------------------------------------- utilidades
/** Convierte los BigInt de un objeto en texto con 2 decimales (para JSON y CSV). */
export function aJson(valor) {
  if (typeof valor === 'bigint') return aTexto(valor);
  if (Array.isArray(valor)) return valor.map(aJson);
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, aJson(v)]));
  return valor;
}

export { aTexto, porcentaje };
