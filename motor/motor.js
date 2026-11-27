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
// Morosidad y vencimiento según el Acuerdo 4-2013 de la Superintendencia de Bancos de Panamá (art. 2, num. 13 y 14):
//  · moroso  = facilidad con importes impagos de MÁS de 30 y HASTA 90 días;
//  · vencido = más de 90 días; y los sobregiros (SB21: 04 contractual, 05 ocasional) pasan a vencidos
//    cuando la falta de pago supera 30 días.
// Se aplica a TODO el saldo de la facilidad (la regla clasifica la facilidad completa, no solo la cuota impaga).
export const FACILIDADES_SOBREGIRO = new Set(['04', '05']);
export const DIAS_MOROSO = 30;
export const DIAS_VENCIDO = 90;
export function estadoMora(diasMora, facilidad) {
  const sobregiro = FACILIDADES_SOBREGIRO.has(facilidad);
  if (diasMora > DIAS_VENCIDO || (sobregiro && diasMora > DIAS_MOROSO)) return 'vencida';
  if (diasMora > DIAS_MOROSO) return 'morosa';
  return 'al_dia_o_menor'; // 0 a 30 días: no es moroso ni vencido para la norma
}

export class ErrorDatos extends Error {}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const etiquetaPeriodo = (f) => `${MESES[Number(f.slice(4, 6)) - 1]} ${f.slice(0, 4)}`;
export const etiquetaCorta = (f) => `${MESES[Number(f.slice(4, 6)) - 1].slice(0, 3)} ${f.slice(0, 4)}`;

// ---------------------------------------------------------------------------- catálogos
/** Recibe el TEXTO de los 4 archivos de referencia y arma los catálogos. */
export function cargarCatalogos({ cinu, sb21, bancos, diccionario }) {
  const exigir = (nombre, filas, columnas) => {
    const faltan = columnas.filter((c) => !filas.length || !(c in filas[0]));
    if (faltan.length) throw new ErrorDatos(`El catálogo ${nombre} no tiene las columnas: ${faltan.join(', ')}.`);
  };
  const filasCinu = leerCsvObjetos(cinu);
  exigir('CINU/SB109', filasCinu, ['Codigo_CINU', 'Descripcion', 'Macroactividad_Reto', 'Subactividad_Reto']);
  const repetidos = filasCinu.map((f) => f.Codigo_CINU).filter((c, k, todos) => todos.indexOf(c) !== k);
  if (repetidos.length) throw new ErrorDatos(`El catálogo CINU tiene códigos repetidos (el catálogo congelado debe ser único): ${[...new Set(repetidos)].slice(0, 5).join(', ')}.`);
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
  const filasSb21 = leerCsvObjetos(sb21);
  exigir('SB21', filasSb21, ['Codigo', 'Descripcion']);
  const listaSb21 = filasSb21.map((f) => ({ codigo: f.Codigo, descripcion: f.Descripcion, uso: f.Uso_en_reto }));
  const filasBancos = leerCsvObjetos(bancos);
  exigir('de bancos', filasBancos, ['Codigo_Banco', 'Nombre_Ficticio']);
  const listaBancos = filasBancos
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
/** ¿Existe esa fecha en el calendario? (AAAAMMDD; rechaza mes 13, mes 00, 30 de febrero, etc.) */
export function fechaValida(f) {
  if (!/^\d{8}$/.test(f)) return false;
  const a = Number(f.slice(0, 4)), m = Number(f.slice(4, 6)), d = Number(f.slice(6, 8));
  const t = new Date(Date.UTC(a, m - 1, d));
  return a >= 1900 && t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Meses transcurridos entre dos fechas AAAAMMDD (julio → agosto = 1). */
export const mesesEntre = (desde, hasta) => (Number(hasta.slice(0, 4)) * 12 + Number(hasta.slice(4, 6))) - (Number(desde.slice(0, 4)) * 12 + Number(desde.slice(4, 6)));

/** Lee y valida un archivo AT03: devuelve sus filas agrupadas por Fecha (todavía sin calcular nada). */
function leerAt03(texto, nombreArchivo, catalogos) {
  const { encabezado, filas } = leerCsv(texto);
  if (!encabezado.length) throw new ErrorDatos(`El archivo «${nombreArchivo}» está vacío.`);
  const esquema = validarEsquema(encabezado, catalogos);
  if (!esquema.ok) throw new ErrorDatos(`El archivo «${nombreArchivo}» no tiene la estructura AT03 del reto. ${esquema.problemas.join(' ')}`);
  if (!filas.length) throw new ErrorDatos(`El archivo «${nombreArchivo}» no tiene filas de datos.`);
  const i = Object.fromEntries(encabezado.map((c, k) => [c, k]));
  const porFecha = new Map();
  filas.forEach((valores, k) => {
    if (valores.length !== encabezado.length) {
      throw new ErrorDatos(`La fila ${k + 1} de «${nombreArchivo}» tiene ${valores.length} campos; se esperaban ${encabezado.length}.`);
    }
    const fecha = valores[i.Fecha];
    if (!fechaValida(fecha)) {
      throw new ErrorDatos(`La fila ${k + 1} de «${nombreArchivo}» tiene una Fecha inválida («${fecha}»): debe ser AAAAMMDD y existir en el calendario.`);
    }
    if (!porFecha.has(fecha)) porFecha.set(fecha, []);
    porFecha.get(fecha).push({ fila: k + 1, v: valores, archivo: nombreArchivo });
  });
  return { i, esquema, porFecha };
}

/**
 * Procesa el texto de UN archivo AT03. Devuelve un resultado por cada Fecha que contenga
 * (el período se toma del campo Fecha, no del nombre del archivo).
 */
export function procesarArchivo(texto, nombreArchivo, catalogos, ahora = new Date()) {
  return procesarArchivos([{ texto, nombre: nombreArchivo, cargado: ahora }], catalogos);
}

/**
 * Procesa varios archivos AT03 JUNTOS. Si un mismo período (Fecha) viene repartido en más de un
 * archivo, sus filas se reúnen en el orden dado, como pide el instructivo (los cálculos son por Fecha,
 * no por archivo). Ningún archivo reemplaza en silencio a otro.
 */
export function procesarArchivos(entradas, catalogos) {
  const porFecha = new Map();
  let i = null;
  let esquema = null;
  for (const e of entradas) {
    const leido = leerAt03(e.texto, e.nombre, catalogos);
    i = leido.i; esquema = leido.esquema;
    for (const [fecha, filas] of leido.porFecha) {
      if (!porFecha.has(fecha)) porFecha.set(fecha, { filas: [], archivos: [], cargado: e.cargado ?? new Date() });
      const g = porFecha.get(fecha);
      g.filas.push(...filas);
      if (!g.archivos.includes(e.nombre)) g.archivos.push(e.nombre);
    }
  }
  return [...porFecha.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, g]) => procesarPeriodo(fecha, g.filas, i, catalogos, g.archivos, esquema, g.cargado));
}

// ---------------------------------------------------------------------------- B y C
function procesarPeriodo(fecha, filas, i, cat, archivos, esquema, ahora) {
  const archivo = archivos.join(', ');
  const vistos = new Map(); // Numero_Prestamo → dónde está su primera aparición
  const cascada = { E1: 0, E2: 0, E3: 0, E4: 0 };
  const independientes = { E1: 0, E2: 0, E3: 0, E4: 0 };
  const excluidas = [];
  const conteoAlertas = { banco: new Map(), facilidad: new Map(), tarjeta: 0, auto: 0, saldoInvalido: 0, saldoNormalizado: 0 };
  const universo = [];

  for (const { fila, v, archivo: archivoFila } of filas) {
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
    // Saldo legible pero con formato distinto del oficial (espacios, sin 2 decimales): se normaliza y se deja constancia
    if (saldo !== null && !/^-?\d+\.\d{2}$/.test(textoSaldo)) conteoAlertas.saldoNormalizado++;
    // Integridad referencial: alerta de calidad, no causa de exclusión
    if (!cat.bancoPorCodigo.has(banco)) conteoAlertas.banco.set(banco, (conteoAlertas.banco.get(banco) || 0) + 1);
    if (!cat.sb21.has(facilidad)) conteoAlertas.facilidad.set(facilidad, (conteoAlertas.facilidad.get(facilidad) || 0) + 1);

    const excluir = (filtro, motivo) => {
      cascada[filtro]++;
      excluidas.push({ fila, archivo: archivoFila, numero_prestamo: prestamo, codigo_banco: banco, filtro, motivo, destino, saldo: textoSaldo, tipo_actividad: actividad });
    };
    // E1 — Duplicados: se conserva la primera aparición según el orden del archivo
    if (duplicado) {
      const primera = vistos.get(prestamo);
      excluir('E1', `Numero_Prestamo duplicado en el período (se conserva la fila ${primera.fila} de ${primera.archivo})`);
      continue;
    }
    vistos.set(prestamo, { fila, archivo: archivoFila });
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
      banco, prestamo, saldo, macro: clase.macroactividad, subactividad, subCatalogo: clase.subactividad, reclasificada,
      facilidad, diasMora: Number(v[i.Dias_Mora]) || 0,
    });
  }
  return agregar({ fecha, archivo, archivos, cargado: ahora.toISOString(), filas, cascada, independientes, excluidas, conteoAlertas, universo, cat, esquema });
}

function agregar({ fecha, archivo, archivos, cargado, filas, cascada, independientes, excluidas, conteoAlertas, universo, cat, esquema }) {
  // Acumuladores por banco → macroactividad → subactividad (centavos enteros)
  const porBanco = new Map();
  const nuevoBanco = () => ({
    total: 0n, operaciones: 0, atraso: 0n, morosa: 0n, vencida: 0n, consumoCatalogo: 0n, consumoPersonalCatalogo: 0n, consumoTarjetaCatalogo: 0n,
    macros: new Map(ORDEN_RANKINGS.map((m) => [m, { saldo: 0n, operaciones: 0, subs: new Map(cat.subactividades[m].map((s) => [s, { saldo: 0n, operaciones: 0, reclasificadas: 0 }])) }])),
  });
  let saldoUniverso = 0n;
  let atrasoSistema = 0n;
  let morosaSistema = 0n;
  let vencidaSistema = 0n;
  for (const u of universo) {
    if (!porBanco.has(u.banco)) porBanco.set(u.banco, nuevoBanco());
    const b = porBanco.get(u.banco);
    const m = b.macros.get(u.macro);
    const s = m.subs.get(u.subactividad);
    s.saldo += u.saldo; s.operaciones++; if (u.reclasificada) s.reclasificadas++;
    m.saldo += u.saldo; m.operaciones++;
    b.total += u.saldo; b.operaciones++;
    if (u.diasMora > 0) { b.atraso += u.saldo; atrasoSistema += u.saldo; } // cualquier atraso (informativo, no es mora regulatoria)
    const mora = estadoMora(u.diasMora, u.facilidad);
    if (mora === 'morosa') { b.morosa += u.saldo; morosaSistema += u.saldo; }
    if (mora === 'vencida') { b.vencida += u.saldo; vencidaSistema += u.saldo; }
    // Control C: CONSUMO según el catálogo CINU, SIN aplicar la regla SB21 (ruta independiente del desglose)
    if (u.macro === 'CONSUMO') {
      b.consumoCatalogo += u.saldo;
      if (u.subCatalogo === 'Credito personal') b.consumoPersonalCatalogo += u.saldo;
      if (u.subCatalogo === cat.nombreTarjeta) b.consumoTarjetaCatalogo += u.saldo;
    }
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
  // Control C: por banco, (a) el total de CONSUMO CON la regla SB21 (suma de sus 3 subactividades) es igual al total
  // SIN la regla (según el catálogo) y (b) el saldo que sale de «Credito personal» es exactamente el que entra a «Tarjeta».
  let cDif = 0;
  for (const b of cat.bancos) {
    const d = datosBanco(b.codigo);
    const subs = d.macros.get('CONSUMO').subs;
    let conRegla = 0n;
    for (const x of subs.values()) conRegla += x.saldo;
    const personalCon = subs.get('Credito personal')?.saldo ?? 0n;
    const tarjetaCon = subs.get(cat.nombreTarjeta)?.saldo ?? 0n;
    const sale = d.consumoPersonalCatalogo - personalCon;
    const entra = tarjetaCon - d.consumoTarjetaCatalogo;
    if (conRegla !== d.consumoCatalogo || sale !== entra) cDif++;
  }
  const reconciliaciones = [
    { id: 'R1', nombre: 'Suma de subactividades = saldo de la actividad (por banco y ranking)', ok: r1Dif === 0, revisados: r1Revisados, diferencias: r1Dif },
    { id: 'R2', nombre: 'Suma de las 6 actividades = total de cartera local válida (por banco)', ok: r2Dif === 0, revisados: cat.bancos.length, diferencias: r2Dif },
    { id: 'R3', nombre: 'Suma de los 12 totales = saldo del universo local válido', ok: sumaTotales12 === saldoUniverso, revisados: 1, diferencias: sumaTotales12 === saldoUniverso ? 0 : 1 },
    { id: 'U', nombre: 'Cada Numero_Prestamo es único en el universo local válido', ok: unicos, revisados: universo.length, diferencias: unicos ? 0 : 1 },
    { id: 'C', nombre: 'Total de CONSUMO por banco igual con o sin la regla SB21 (y lo que sale de Crédito personal = lo que entra a Tarjeta)', ok: cDif === 0, revisados: cat.bancos.length, diferencias: cDif },
  ];

  const alertas = [];
  for (const [codigo, n] of conteoAlertas.banco) alertas.push({ tipo: 'banco_desconocido', severidad: 'alta', cantidad: n, texto: `Código de banco «${codigo}» no existe en Bancos_ficticios (${n} filas). No se excluye; no entra en los rankings de 12 bancos.` });
  for (const [codigo, n] of conteoAlertas.facilidad) alertas.push({ tipo: 'facilidad_desconocida', severidad: 'media', cantidad: n, texto: `Facilidad «${codigo}» no existe en la tabla SB21 (${n} filas).` });
  if (conteoAlertas.tarjeta) alertas.push({ tipo: 'consumo_incoherente', severidad: 'media', cantidad: conteoAlertas.tarjeta, texto: `${conteoAlertas.tarjeta} operaciones con CINU de Tarjeta no tienen facilidad 07; se mantienen como Tarjeta.` });
  if (conteoAlertas.auto) alertas.push({ tipo: 'consumo_incoherente', severidad: 'media', cantidad: conteoAlertas.auto, texto: `${conteoAlertas.auto} operaciones con CINU de Automóvil no tienen facilidad 03; se mantienen como Automóvil.` });
  if (conteoAlertas.saldoNormalizado) alertas.push({ tipo: 'saldo_normalizado', severidad: 'baja', cantidad: conteoAlertas.saldoNormalizado, texto: `${conteoAlertas.saldoNormalizado} saldos traían espacios o no tenían 2 decimales («500», « 500.00»); se normalizaron sin cambiar su valor.` });
  if (conteoAlertas.saldoInvalido) alertas.push({ tipo: 'saldo_ilegible', severidad: 'alta', cantidad: conteoAlertas.saldoInvalido, texto: `${conteoAlertas.saldoInvalido} saldos no son montos válidos; se excluyeron en E3.` });

  const filasLeidas = filas.length;
  const suma = cascada.E1 + cascada.E2 + cascada.E3 + cascada.E4 + universo.length;
  return {
    fecha, archivo, archivos, cargado, filas_leidas: filasLeidas, cascada, independientes,
    universo: universo.length, saldo_universo: saldoUniverso, identidad_filas: suma === filasLeidas,
    cuadra: suma === filasLeidas && reconciliaciones.every((r) => r.ok),
    esquema, alertas, reconciliaciones, excluidas, rankings, totales_ranking: totalesRanking, desglose,
    bancos: cat.bancos.map((b) => {
      const d = datosBanco(b.codigo);
      return { codigo_banco: b.codigo, banco: b.nombre, total: d.total, operaciones: d.operaciones, atraso: d.atraso, morosa: d.morosa, vencida: d.vencida };
    }),
    indicadores: { atraso: atrasoSistema, morosa: morosaSistema, vencida: vencidaSistema, reclasificadas_sb21: universo.filter((u) => u.reclasificada).length },
  };
}

// ---------------------------------------------------------------------------- comparación
const numero = new Intl.NumberFormat('es-PA', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const ordinal = (n) => `${n}.º`;
const millones = (c) => `${numero.format(Number(c) / 1e8)} M`;
const pctTexto = (p) => `${numero.format(Math.abs(Number(p)))} %`;
const diezMilesimas = (p) => Math.round(Number(p) * 10000);

export const PARAMETROS_INICIALES = { mov_min_posiciones: 2, mov_cambio_lider: true, mov_var_saldo_pct: '15.00' };

// Diezmilésimas enteras (1.2345 → 12345): se compara y se resta sin decimales binarios.
const dmATexto = (n) => `${n < 0 ? '-' : ''}${Math.floor(Math.abs(n) / 10000)}.${String(Math.abs(n) % 10000).padStart(4, '0')}`;
/** Monto corto legible: millones con 1 decimal desde 1 M; por debajo, el monto completo (no «0.0 M»). */
const montoCorto = (c) => (c >= 100000000n || c <= -100000000n ? millones(c) : `${new Intl.NumberFormat('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(c) / 100)}`);

/** Compara dos períodos (anterior → actual): Cambio_Posicion = anterior − actual. */
export function compararPeriodos(anterior, actual, parametros = PARAMETROS_INICIALES) {
  const filas = [];
  const explicaciones = [];
  for (const macro of ORDEN_RANKINGS) {
    const previo = new Map(anterior.rankings[macro].map((f) => [f.codigo_banco, f]));
    const liderAnterior = anterior.rankings[macro][0];
    // Variación del sector completo (suma de los 12 bancos): sirve para separar «crece más que el sector» de «crece con el sector»
    const varSector = porcentaje(actual.totales_ranking[macro] - anterior.totales_ranking[macro], anterior.totales_ranking[macro]);
    for (const f of actual.rankings[macro]) {
      const p = previo.get(f.codigo_banco);
      const cambio = p.posicion - f.posicion;
      const varSaldo = f.saldo_actividad - p.saldo_actividad;
      const varPct = porcentaje(varSaldo, p.saldo_actividad);
      const sinSaldoAntes = p.saldo_actividad === 0n;
      const sinSaldoAhora = f.saldo_actividad === 0n;
      const motivos = [];
      if (sinSaldoAntes && sinSaldoAhora) {
        // Un banco sin cartera en este sector en ambos meses no se mueve: sus puestos solo reflejan el desempate por código.
      } else {
        if (Math.abs(cambio) >= Number(parametros.mov_min_posiciones)) motivos.push(cambio > 0 ? `Sube ${cambio} posiciones` : `Baja ${-cambio} posiciones`);
        // El liderazgo exige tener saldo: un 0.00 que lidera por desempate no cuenta como líder.
        if (parametros.mov_cambio_lider && f.posicion === 1 && p.posicion !== 1 && !sinSaldoAhora) motivos.push('Nuevo líder');
        if (parametros.mov_cambio_lider && p.posicion === 1 && f.posicion !== 1 && !sinSaldoAntes) motivos.push('Pierde el liderazgo');
        if (sinSaldoAntes) motivos.push('Entra al sector');
        else if (sinSaldoAhora) motivos.push('Sale del sector');
        else if (varPct !== null && Math.abs(diezMilesimas(varPct)) >= diezMilesimas(parametros.mov_var_saldo_pct)) {
          motivos.push(`Saldo ${varSaldo >= 0n ? '+' : '−'}${pctTexto(varPct)}`);
        }
      }
      const fila = {
        fecha_anterior: anterior.fecha, fecha_actual: actual.fecha, ranking: macro,
        codigo_banco: f.codigo_banco, banco: f.banco, posicion_anterior: p.posicion, posicion_actual: f.posicion, cambio,
        saldo_anterior: p.saldo_actividad, saldo_actual: f.saldo_actividad, var_saldo: varSaldo, var_saldo_pct: varPct,
        // Frente al sector (puntos porcentuales): positivo = crece más que el conjunto de bancos en ese ranking
        var_sector_pct: varSector,
        var_vs_sector_pp: varPct !== null && varSector !== null ? dmATexto(diezMilesimas(varPct) - diezMilesimas(varSector)) : null,
        significativo: motivos.length > 0, motivos,
      };
      filas.push(fila);
      if (fila.significativo) explicaciones.push(explicar(fila, macro, liderAnterior, anterior, actual));
    }
  }
  explicaciones.sort((a, b) => b.peso - a.peso);
  const marcados = filas.filter((f) => f.significativo).length;
  // Cómo se reparten las variaciones de saldo (calculado con los datos, para justificar el umbral configurable)
  const abs = filas.filter((f) => f.var_saldo_pct !== null && f.saldo_anterior > 0n && f.saldo_actual > 0n).map((f) => Math.abs(diezMilesimas(f.var_saldo_pct))).sort((a, b) => a - b);
  const percentil = (q) => (abs.length ? dmATexto(abs[Math.max(0, Math.ceil(q * abs.length) - 1)]) : null);
  return {
    desde: anterior.fecha, hasta: actual.fecha, regla: parametros, filas, explicaciones,
    meses_entre: mesesEntre(anterior.fecha, actual.fecha),
    resumen: {
      total: filas.length, significativos: marcados, pct_marcados: porcentaje(BigInt(marcados), BigInt(filas.length)) ?? '0.0000',
      var_mediana_pct: percentil(0.5), var_p90_pct: percentil(0.9),
    },
  };
}

/** Explicación automática y determinista de un movimiento (sin IA). */
function explicar(f, macro, liderAnterior, anterior, actual) {
  const titulo = TITULO_RANKING[macro];
  const crecio = f.var_saldo >= 0n;
  const entra = f.saldo_anterior === 0n;
  const sale = f.saldo_actual === 0n;
  const saldoTxt = entra ? `entra al sector con ${montoCorto(f.saldo_actual)}`
    : sale ? `sale del sector: su saldo pasa de ${montoCorto(f.saldo_anterior)} a 0.00`
    : f.var_saldo === 0n ? `su saldo no varió (${montoCorto(f.saldo_actual)})`
    : `su saldo ${crecio ? 'creció' : 'bajó'} ${pctTexto(f.var_saldo_pct)} (${montoCorto(f.saldo_anterior)} → ${montoCorto(f.saldo_actual)})`;
  // ¿A quién superó o quién lo superó? (bancos que cruzaron su posición)
  const antes = new Map(anterior.rankings[macro].map((x) => [x.codigo_banco, x.posicion]));
  const ahora = actual.rankings[macro];
  const cruzados = ahora
    .filter((x) => x.codigo_banco !== f.codigo_banco)
    .filter((x) => (f.cambio > 0
      ? antes.get(x.codigo_banco) < f.posicion_anterior && x.posicion > f.posicion_actual
      : antes.get(x.codigo_banco) > f.posicion_anterior && x.posicion < f.posicion_actual))
    .map((x) => x.banco);
  const cruce = cruzados.length ? ` ${f.cambio > 0 ? 'Supera a' : 'Lo superan'} ${cruzados.slice(0, 3).join(', ')}${cruzados.length > 3 ? ' y otros' : ''}.` : '';
  let texto;
  let tipo;
  let peso;
  if (f.posicion_actual === 1 && f.posicion_anterior !== 1 && !sale) {
    tipo = 'lider';
    peso = 1000;
    texto = `Nuevo líder en ${titulo}: ${f.banco} pasa del ${ordinal(f.posicion_anterior)} al 1.er lugar y desplaza a ${liderAnterior.banco}; ${saldoTxt}.`;
  } else if (f.posicion_anterior === 1 && f.posicion_actual !== 1 && !entra) {
    tipo = 'pierde_liderazgo';
    peso = 900;
    texto = `${f.banco} pierde el liderazgo de ${titulo} frente a ${ahora[0].banco} y queda en el ${ordinal(f.posicion_actual)} lugar; ${saldoTxt}.`;
  } else if (entra || sale) {
    tipo = entra ? 'entra' : 'sale';
    peso = 800;
    texto = entra
      ? `${f.banco} entra al sector ${titulo}: ${saldoTxt} y queda en el ${ordinal(f.posicion_actual)} lugar.`
      : `${f.banco} ${saldoTxt.replace('sale del sector', `sale del sector ${titulo}`)}.`;
  } else if (f.cambio !== 0) {
    tipo = f.cambio > 0 ? 'sube' : 'baja';
    peso = 100 + Math.abs(f.cambio) * 10;
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
