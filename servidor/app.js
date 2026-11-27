// API de la plataforma (Express). Contrato completo en docs/api.md.
import express from 'express';
import { randomBytes } from 'node:crypto';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { crearEstado } from './estado.js';
import { crearSesiones, usuariosDesdeEntorno, PERMISOS, NOMBRE_PERFIL } from './sesion.js';
import { preguntarIA } from './ia.js';
import { crearCuentas } from './cuentas.js';
import { crearProducto } from './producto.js';
import { opciones as opcionesExtraccion, extraer, comoCsv, comoExcel } from './extraccion.js';
import {
  ORDEN_RANKINGS, TIPO_RANKING, TITULO_RANKING, VERSION_MOTOR, ErrorDatos,
  etiquetaPeriodo, etiquetaCorta, aJson, aTexto, porcentaje, mesesEntre, puenteEntreMeses,
} from '../motor/motor.js';
import { generar } from '../motor/exportar.js';

const COOKIE = 'syntropy_sesion';
const FUENTE = 'Paquete Hackathon SBP 2026 · Átomo 03 (AT03) sintético';
const AVISO = 'Datos 100 % ficticios con fines de demostración. No representan al sistema bancario panameño ni constituyen opinión formal de la SBP.';

export function crearApp({ entorno = {}, carpetaLocal = 'datos-locales', carpetaReto = 'datos/reto', carpetaWeb = 'dist' } = {}) {
  const estado = crearEstado({ carpetaReto, carpetaLocal, inicial: entorno.CARGA_INICIAL || 'todos' });
  const usuariosEnv = usuariosDesdeEntorno(entorno);
  const cuentas = entorno.CUENTAS ? crearCuentas(carpetaLocal, entorno.CUENTAS, entorno.URL_PUBLICA || '') : null;
  const modo = entorno.MODO === 'producto' ? 'producto' : 'demo';
  const producto = modo === 'producto' ? crearProducto(carpetaLocal) : null;
  const sesiones = crearSesiones((n) => usuariosEnv.get(n) || cuentas?.lista().find((c) => c.usuario === n) || producto?.buscar(n),
    { archivo: join(carpetaLocal, 'sesiones.json') });
  if (entorno.RESULTADOS_DIR) estado.publicarEn(entorno.RESULTADOS_DIR);
  const seguro = entorno.COOKIE_SEGURA === '1';
  const app = express();
  app.disable('x-powered-by');
  if (entorno.DETRAS_DE_PROXY === '1') app.set('trust proxy', 1);

  // --- Cabeceras de seguridad
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    });
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  // --- Sesión: público por defecto
  app.use((req, res, next) => {
    // Todas las cookies con nuestro nombre (puede haber una vieja de antes del cambio de dominio)
    const tokens = (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter(([k, v]) => k === COOKIE && v).map(([, v]) => v);
    req.token = tokens;
    req.sesion = sesiones.leer(tokens);
    req.perfil = req.sesion?.perfil || 'publico';
    req.usuario = req.sesion?.usuario || null;
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && req.path.startsWith('/api/') && req.get('X-Syntropy') !== '1') {
      return res.status(403).json({ error: 'Petición no permitida.' });
    }
    next();
  });
  const permiso = (nombre) => (req, res, next) => (PERMISOS[req.perfil].includes(nombre)
    ? next()
    : res.status(req.perfil === 'publico' ? 401 : 403).json({ error: `Esta opción es para ${nombre === 'cargar' || nombre === 'parametros' || nombre === 'registro' || nombre === 'perfiles' ? 'administradores' : 'analistas y administradores'}. Inicia sesión con un perfil autorizado.` }));
  const registrar = (req, accion, detalle) => estado.registrar(req.usuario, req.perfil, accion, detalle);

  // --- Ayudantes de consulta
  const fechaDe = (req) => {
    const f = String(req.query.fecha || estado.ultimo()?.fecha || '');
    return estado.periodo(f);
  };
  const rankingDe = (req, obligatorio = true) => {
    const r = String(req.query.ranking || '').toUpperCase();
    if (!r && !obligatorio) return null;
    if (!ORDEN_RANKINGS.includes(r)) throw new ErrorDatos(`Ranking desconocido. Usa uno de: ${ORDEN_RANKINGS.join(', ')}.`);
    return r;
  };
  // Período con el que se compara: por defecto el anterior; `?comparar=AAAAMMDD` elige otro (anterior al consultado) y
  // `?comparar=ninguna` pide no comparar. Así un reporte puede salir TODO de una sola comparación.
  const baseDe = (req, p) => {
    const c = String(req.query.comparar || '');
    if (!c) return estado.anteriorDe(p.fecha);
    if (c === 'ninguna') return null;
    const base = estado.periodo(c);
    if (base.fecha >= p.fecha) throw new ErrorDatos('El período con el que se compara debe ser anterior al consultado.');
    return base;
  };
  const filasRanking = (p, macro, anterior = estado.anteriorDe(p.fecha)) => {
    const previo = anterior ? new Map(anterior.rankings[macro].map((f) => [f.codigo_banco, f])) : null;
    return p.rankings[macro].map((f) => {
      const a = previo?.get(f.codigo_banco);
      return {
        posicion: f.posicion, codigo_banco: f.codigo_banco, banco: f.banco, saldo_actividad: aTexto(f.saldo_actividad),
        total_cartera: aTexto(f.total_cartera), ponderacion_pct: f.ponderacion_pct, operaciones: f.operaciones,
        participacion_pct: f.participacion_pct,
        posicion_anterior: a ? a.posicion : null, cambio: a ? a.posicion - f.posicion : null,
        saldo_anterior: a ? aTexto(a.saldo_actividad) : null,
        var_saldo_pct: a ? porcentaje(f.saldo_actividad - a.saldo_actividad, a.saldo_actividad) : null,
      };
    });
  };
  const resumenPeriodo = (p) => ({
    fecha: p.fecha, etiqueta: etiquetaPeriodo(p.fecha), corta: etiquetaCorta(p.fecha), archivo: p.archivo, cargado: p.cargado, filas_leidas: p.filas_leidas,
  });

  // --- Sesión
  app.get('/api/sesion', (req, res) => res.json({ perfil: req.perfil, usuario: req.usuario }));
  app.post('/api/sesion', (req, res) => {
    const r = sesiones.entrar(req.body?.usuario, req.body?.clave);
    if (r.error) {
      estado.registrar(String(req.body?.usuario || '').slice(0, 40), 'publico', 'sesion_fallida', 'Usuario o contraseña incorrectos');
      return res.status(401).json({ error: r.error });
    }
    if (entorno.COOKIE_DOMINIO) res.clearCookie(COOKIE, { path: '/' });
    if (producto && producto.tieneDosPasos(r.usuario)) {
      // Contraseña correcta, pero falta el segundo paso: la cookie se entrega al confirmar el código
      return res.json({ paso: 'dos_pasos', ...producto.retener(r.usuario, r.token) });
    }
    res.cookie(COOKIE, r.token, { httpOnly: true, sameSite: 'strict', secure: seguro, path: '/', maxAge: 8 * 3600 * 1000, ...(entorno.COOKIE_DOMINIO ? { domain: entorno.COOKIE_DOMINIO } : {}) });
    estado.registrar(r.usuario, r.perfil, 'iniciar_sesion', `Perfil ${NOMBRE_PERFIL[r.perfil]}`);
    res.json({ perfil: r.perfil, usuario: r.usuario, ...(producto ? { configurar_dos_pasos: true } : {}) });
  });
  const cookieSesion = (res, token) => res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: seguro, path: '/', maxAge: 8 * 3600 * 1000, ...(entorno.COOKIE_DOMINIO ? { domain: entorno.COOKIE_DOMINIO } : {}) });
  if (producto) {
    app.get('/api/cuentas', (req, res) => res.json(producto.lista()));
    app.post('/api/cuentas', (req, res) => {
      // La primera cuenta se crea sola (administración); las demás solo las crea quien administra,
      // con una contraseña temporal al azar que se entrega una vez.
      let datos = req.body || {};
      let temporal = null;
      if (producto.hayCuentas()) {
        if (req.perfil !== 'administrador') return res.status(403).json({ error: 'Solo quien administra este espacio puede crear cuentas.' });
        temporal = `${randomBytes(9).toString('base64url')}7a`; // al azar (crypto), con letras y números
        datos = { ...datos, clave: temporal };
      }
      const c = producto.crear(datos);
      if (temporal) c.clave_temporal = temporal;
      estado.registrar(c.usuario, c.perfil, 'crear_cuenta', `${c.nombre} · perfil ${NOMBRE_PERFIL[c.perfil]}`);
      res.json(c);
    });
    app.post('/api/sesion/dos-pasos', (req, res) => {
      const d = producto.resolver(req.body?.desafio, req.body?.codigo);
      const s = sesiones.leer(d.token);
      cookieSesion(res, d.token);
      estado.registrar(d.usuario, s?.perfil, 'iniciar_sesion', 'Con verificación en 2 pasos');
      res.json({ perfil: s?.perfil, usuario: d.usuario });
    });
    app.post('/api/dos-pasos/configurar', (req, res) => {
      if (!req.usuario) return res.status(401).json({ error: 'Inicia sesión.' });
      res.json(producto.configurar(req.usuario));
    });
    app.post('/api/dos-pasos/confirmar', (req, res) => {
      if (!req.usuario) return res.status(401).json({ error: 'Inicia sesión.' });
      producto.confirmar(req.usuario, req.body?.codigo);
      registrar(req, 'activar_dos_pasos', 'Verificación en 2 pasos activada');
      res.json({ ok: true });
    });
    app.post('/api/dos-pasos/omitir', (req, res) => res.json({ ok: true }));
  }
  app.delete('/api/sesion', (req, res) => {
    if (req.sesion) registrar(req, 'cerrar_sesion', '');
    sesiones.salir(req.token);
    res.clearCookie(COOKIE, { path: '/', ...(entorno.COOKIE_DOMINIO ? { domain: entorno.COOKIE_DOMINIO } : {}) });
    res.clearCookie(COOKIE, { path: '/' }); // también la cookie antigua, solo de syntropy.com.pa
    res.json({ perfil: 'publico', usuario: null });
  });

  // --- Contraseña de un solo uso (versión en internet)
  app.use('/estatico', express.static(resolve('servidor/estatico'), { maxAge: '1h' }));
  app.get('/revelar', (req, res) => res.set('Cache-Control', 'no-store').sendFile(resolve('servidor/estatico/revelar.html')));
  app.post('/api/revelar', (req, res) => {
    const r = cuentas?.revelar(String(req.body?.token || '').slice(0, 100));
    if (!r) return res.status(400).json({ error: 'El enlace no es válido o ya se usó.' });
    estado.registrar(r.usuario, r.perfil, 'revelar_contrasena', 'Enlace de un solo uso');
    res.json({ usuario: r.usuario, clave: r.clave });
  });

  // --- Terminal de Nathalia: Caddy pregunta aquí (forward_auth) antes de dejar pasar a /terminal/
  // Cada terminal (nathalia.…, gui.…) indica en ?permitidos= quién puede entrar; además el usuario debe
  // estar en TERMINAL_USUARIOS. Así una persona no puede abrir la terminal de otra.
  const usuariosTerminal = String(entorno.TERMINAL_USUARIOS || '').split(',').map((u) => u.trim()).filter(Boolean);
  app.get('/api/terminal/autorizar', (req, res) => {
    const permitidos = String(req.query.permitidos || '').split(',').map((u) => u.trim()).filter(Boolean);
    if (req.usuario && usuariosTerminal.includes(req.usuario) && permitidos.includes(req.usuario)) return res.status(200).end();
    res.status(401).end();
  });

  // --- Metadatos
  app.get('/api/meta', (req, res) => {
    const c = estado.catalogos;
    res.json({
      periodos: estado.lista().map(resumenPeriodo),
      ultimo: estado.ultimo()?.fecha || null,
      avisos: estado.huecos().map((h) => `Entre ${etiquetaPeriodo(h.desde)} y ${etiquetaPeriodo(h.hasta)} ${h.meses > 1 ? `faltan ${h.meses - 1} mes(es)` : 'los períodos no están en orden'}: las comparaciones de esos pares abarcan ${h.meses} meses, no uno.`),
      rankings: ORDEN_RANKINGS.map((r) => ({ nombre: r, titulo: TITULO_RANKING[r], tipo: TIPO_RANKING[r], subactividades: c.subactividades[r] })),
      bancos: c.bancos.map((b) => ({ codigo: b.codigo, nombre: b.nombre })),
      fuente: FUENTE, aviso: AVISO, parametros: estado.parametros, permisos: PERMISOS, version_motor: VERSION_MOTOR,
      perfil: req.perfil, usuario: req.usuario, modo,
      nombre: producto && req.usuario ? producto.buscar(req.usuario)?.nombre || null : null,
    });
  });

  // --- Panel principal
  app.get('/api/panel', (req, res) => {
    const p = fechaDe(req);
    const a = baseDe(req, p);
    const excluidas = p.filas_leidas - p.universo;
    const concentracion = ORDEN_RANKINGS.map((macro) => {
      const total = Number(p.totales_ranking[macro]);
      const cuotas = p.rankings[macro].map((f) => (total ? (Number(f.saldo_actividad) / total) * 100 : 0));
      const hhi = Math.round(cuotas.reduce((s, x) => s + x * x, 0));
      const top3 = p.rankings[macro].slice(0, 3).reduce((s, f) => s + f.saldo_actividad, 0n);
      return { ranking: macro, hhi, nivel: hhi < 1500 ? 'baja' : hhi <= 2500 ? 'moderada' : 'alta', top3_pct: porcentaje(top3, p.totales_ranking[macro]) };
    });
    res.json({
      fecha: p.fecha, etiqueta: etiquetaPeriodo(p.fecha), fecha_anterior: a?.fecha || null,
      meses_desde_anterior: a ? mesesEntre(a.fecha, p.fecha) : null,
      kpis: {
        cartera_total: aTexto(p.saldo_universo), cartera_total_anterior: a ? aTexto(a.saldo_universo) : null,
        var_cartera_pct: a ? porcentaje(p.saldo_universo - a.saldo_universo, a.saldo_universo) : null,
        operaciones: p.universo, operaciones_anterior: a?.universo ?? null, bancos: estado.catalogos.bancos.length,
        filas_leidas: p.filas_leidas, excluidas, pct_excluidas: porcentaje(BigInt(excluidas), BigInt(p.filas_leidas)),
      },
      lideres: ORDEN_RANKINGS.map((macro) => {
        const f = p.rankings[macro][0];
        const la = a?.rankings[macro][0];
        return {
          ranking: macro, codigo_banco: f.codigo_banco, banco: f.banco, saldo: aTexto(f.saldo_actividad),
          ponderacion_pct: f.ponderacion_pct, participacion_pct: f.participacion_pct,
          lider_anterior: la ? { codigo_banco: la.codigo_banco, banco: la.banco } : null,
          cambio_lider: Boolean(la && la.codigo_banco !== f.codigo_banco),
        };
      }),
      composicion: ORDEN_RANKINGS.map((macro) => ({ ranking: macro, saldo: aTexto(p.totales_ranking[macro]), pct: porcentaje(p.totales_ranking[macro], p.saldo_universo) })),
      destacados: a ? estado.comparar(a, p).explicaciones.slice(0, 8).map(({ peso, ...x }) => x) : [],
      indicadores: {
        // Según el Acuerdo 4-2013 de la SBP (art. 2, num. 13 y 14): morosa = más de 30 y hasta 90 días; vencida = más de 90 días
        // (los sobregiros pasan a vencidos al superar 30 días). «Atraso» = cualquier día de atraso, solo informativo.
        morosa_pct: porcentaje(p.indicadores.morosa, p.saldo_universo),
        vencida_pct: porcentaje(p.indicadores.vencida, p.saldo_universo),
        atraso_pct: porcentaje(p.indicadores.atraso, p.saldo_universo),
        reclasificadas_sb21: p.indicadores.reclasificadas_sb21,
        concentracion,
      },
    });
  });

  // --- Rankings y vistas derivadas
  app.get('/api/rankings', (req, res) => {
    const p = fechaDe(req);
    const macro = rankingDe(req);
    const a = baseDe(req, p);
    res.json({ fecha: p.fecha, ranking: macro, fecha_anterior: a?.fecha || null, total_ranking: aTexto(p.totales_ranking[macro]), filas: filasRanking(p, macro, a) });
  });
  app.get('/api/matriz', (req, res) => {
    const p = fechaDe(req);
    res.json({
      fecha: p.fecha, rankings: ORDEN_RANKINGS,
      bancos: estado.catalogos.bancos.map((b) => ({
        codigo_banco: b.codigo, banco: b.nombre,
        total_cartera: aTexto(p.bancos.find((x) => x.codigo_banco === b.codigo).total),
        celdas: ORDEN_RANKINGS.map((macro) => {
          const f = p.rankings[macro].find((x) => x.codigo_banco === b.codigo);
          return { ranking: macro, saldo: aTexto(f.saldo_actividad), ponderacion_pct: f.ponderacion_pct, posicion: f.posicion };
        }),
      })),
    });
  });
  app.get('/api/historia', (req, res) => {
    const macro = rankingDe(req);
    const lista = estado.lista();
    res.json({
      ranking: macro, periodos: lista.map((p) => p.fecha),
      bancos: estado.catalogos.bancos.map((b) => ({
        codigo_banco: b.codigo, banco: b.nombre,
        posiciones: lista.map((p) => p.rankings[macro].find((f) => f.codigo_banco === b.codigo).posicion),
        saldos: lista.map((p) => aTexto(p.rankings[macro].find((f) => f.codigo_banco === b.codigo).saldo_actividad)),
      })),
    });
  });
  app.get('/api/desglose', (req, res) => {
    const p = fechaDe(req);
    const macro = rankingDe(req);
    const banco = req.query.banco ? String(req.query.banco) : null;
    if (banco && !estado.catalogos.bancoPorCodigo.has(banco)) throw new ErrorDatos(`Banco desconocido: ${banco}.`);
    res.json({ fecha: p.fecha, ranking: macro, filas: aJson(p.desglose[macro].filter((f) => !banco || f.codigo_banco === banco)) });
  });

  // --- Comparación entre períodos (analista+)
  const comparacion = (req) => {
    const lista = estado.lista();
    if (lista.length < 2) throw new ErrorDatos('Se necesitan al menos dos períodos cargados para comparar.');
    const hasta = estado.periodo(String(req.query.hasta || lista.at(-1).fecha));
    const desde = estado.periodo(String(req.query.desde || estado.anteriorDe(hasta.fecha)?.fecha || lista[0].fecha));
    if (desde.fecha >= hasta.fecha) throw new ErrorDatos('El período «desde» debe ser anterior a «hasta».');
    return estado.comparar(desde, hasta);
  };
  app.get('/api/movimientos', permiso('comparar'), (req, res) => {
    const c = comparacion(req);
    const macro = rankingDe(req, false);
    res.json({
      desde: c.desde, hasta: c.hasta, regla: c.regla, meses_entre: c.meses_entre, resumen: c.resumen,
      filas: aJson(c.filas.filter((f) => !macro || f.ranking === macro)),
      explicaciones: c.explicaciones.filter((e) => !macro || e.ranking === macro).map((e) => e.texto),
    });
  });

  // --- Anatomía del cambio (para todos): por qué cambió el saldo de un banco entre dos meses
  app.get('/api/anatomia', (req, res) => {
    const c = comparacion(req);
    const macro = rankingDe(req);
    const banco = req.query.banco ? String(req.query.banco) : null;
    const filas = c.filas.filter((f) => f.ranking === macro && (!banco || f.codigo_banco === banco)).map((f) => {
      const a = f.anatomia;
      return {
        codigo_banco: f.codigo_banco, banco: f.banco, posicion_anterior: f.posicion_anterior, posicion_actual: f.posicion_actual, cambio: f.cambio,
        saldo_anterior: aTexto(f.saldo_anterior), saldo_actual: aTexto(f.saldo_actual), var_saldo_pct: f.var_saldo_pct,
        nuevos: aTexto(a.nuevos), n_nuevos: a.n_nuevos, terminados: aTexto(a.terminados), n_terminados: a.n_terminados,
        variacion: aTexto(a.variacion), n_siguen: a.n_siguen,
        cuadra: f.saldo_anterior + a.nuevos - a.terminados + a.variacion === f.saldo_actual,
      };
    });
    res.json({ desde: c.desde, hasta: c.hasta, ranking: macro, filas });
  });

  // --- Calidad de datos
  // Reconciliación 4 (más allá de lo pedido): el puente entre el mes anterior y este, al centavo
  const r4 = (p) => {
    const a = estado.anteriorDe(p.fecha);
    if (!a) return null;
    const b = puenteEntreMeses(a, p);
    return {
      id: 'R4', nombre: `Puente entre meses: ${etiquetaCorta(a.fecha)} + nuevos − terminados ± variación = ${etiquetaCorta(p.fecha)}`,
      ok: b.cuadra, revisados: b.n_nuevos + b.n_terminados + b.n_siguen, diferencias: b.cuadra ? 0 : 1,
      detalle: `${aTexto(b.saldo_anterior)} + ${aTexto(b.nuevos)} − ${aTexto(b.terminados)} ${b.variacion < 0n ? '−' : '+'} ${aTexto(b.variacion < 0n ? -b.variacion : b.variacion)} = ${aTexto(b.saldo_actual)}`,
      puente: aJson(b),
      nota: `Ningún préstamo desaparece sin explicación: ${b.vencian} de ${b.n_terminados} que salieron vencían en ${etiquetaPeriodo(p.fecha)} o antes.`,
    };
  };
  app.get('/api/calidad', (req, res) => { // conteos agregados: públicos (Metodología); las filas excluidas siguen protegidas
    const p = fechaDe(req);
    const cuarta = r4(p);
    res.json({
      fecha: p.fecha, archivo: p.archivo, archivos: p.archivos, filas_leidas: p.filas_leidas, cascada: p.cascada, universo: p.universo,
      saldo_universo: aTexto(p.saldo_universo), cuadra: p.cuadra, independientes: p.independientes,
      reconciliaciones: cuarta ? [...p.reconciliaciones, cuarta] : p.reconciliaciones, alertas: p.alertas, esquema: p.esquema,
      reclasificadas_sb21: p.indicadores.reclasificadas_sb21,
    });
  });
  app.get('/api/excluidas', permiso('calidad'), (req, res) => {
    const p = fechaDe(req);
    const filtro = req.query.filtro ? String(req.query.filtro).toUpperCase() : null;
    const porPagina = 50;
    const pagina = Math.max(1, Number(req.query.pagina) || 1);
    const todas = p.excluidas.filter((e) => !filtro || e.filtro === filtro);
    res.json({ total: todas.length, pagina, por_pagina: porPagina, filas: todas.slice((pagina - 1) * porPagina, pagina * porPagina) });
  });

  // --- Semáforo de publicación (analista+): los controles de la Sección 12, en verde o rojo, y la firma
  const controles = (p) => {
    const c = [];
    const { E1, E2, E3, E4 } = p.cascada;
    c.push({ id: 'cascada', texto: 'Filas leídas = E1 + E2 + E3 + E4 + universo local válido', ok: p.cuadra, detalle: `${p.filas_leidas} = ${E1} + ${E2} + ${E3} + ${E4} + ${p.universo}` });
    c.push({ id: 'esquema', texto: '61 columnas en el orden del diccionario; códigos leídos como texto (07 sigue siendo 07)', ok: p.esquema.ok, detalle: `${p.esquema.columnas} columnas` });
    const unico = p.reconciliaciones.find((r) => r.id === 'U');
    c.push({ id: 'unicos', texto: 'Ningún Numero_Prestamo se repite en el universo local válido', ok: unico.ok, detalle: `${p.universo} préstamos únicos` });
    const completos = ORDEN_RANKINGS.every((m) => p.rankings[m].length === 12 && p.rankings[m].every((f, i) => f.posicion === i + 1));
    c.push({ id: 'rankings', texto: '6 rankings con 12 bancos y posiciones 1 a 12 sin huecos', ok: completos, detalle: '6 × 12' });
    for (const r of p.reconciliaciones.filter((x) => ['R1', 'R2', 'R3'].includes(x.id))) c.push({ id: r.id, texto: `${r.id} · ${r.nombre}`, ok: r.ok, detalle: `${r.revisados} revisados, ${r.diferencias} diferencias` });
    const cuarta = r4(p);
    if (cuarta) c.push({ id: 'R4', texto: `R4 · ${cuarta.nombre}`, ok: cuarta.ok, detalle: cuarta.detalle });
    const consumoOk = estado.catalogos.bancos.every((b) => {
      const suma = p.desglose.CONSUMO.filter((f) => f.codigo_banco === b.codigo).reduce((t, f) => t + f.saldo, 0n);
      return suma === p.rankings.CONSUMO.find((f) => f.codigo_banco === b.codigo).saldo_actividad;
    });
    c.push({ id: 'consumo', texto: 'El total de CONSUMO por banco es igual con o sin la regla SB21', ok: consumoOk, detalle: `${p.indicadores.reclasificadas_sb21} operaciones reclasificadas a Tarjeta` });
    const denominador = estado.catalogos.bancos.every((b) => new Set(ORDEN_RANKINGS.map((m) => p.rankings[m].find((f) => f.codigo_banco === b.codigo).total_cartera)).size === 1);
    c.push({ id: 'denominador', texto: 'El mismo denominador (cartera total del banco) en los 6 rankings', ok: denominador, detalle: '12 bancos' });
    const sinAlertasGraves = !p.alertas.some((a) => a.severidad === 'alta');
    c.push({ id: 'alertas', texto: 'Sin alertas graves de integridad (bancos o saldos desconocidos)', ok: sinAlertasGraves, detalle: `${p.alertas.length} alertas` });
    return c;
  };
  app.get('/api/controles', permiso('reportes'), (req, res) => {
    const p = fechaDe(req);
    const lista = controles(p);
    res.json({ fecha: p.fecha, etiqueta: etiquetaPeriodo(p.fecha), controles: lista, ok: lista.every((x) => x.ok), firmas: estado.firmas(p.fecha) });
  });
  app.post('/api/publicaciones', permiso('reportes'), (req, res) => {
    const p = estado.periodo(String(req.body?.fecha || ''));
    const nombre = String(req.body?.nombre || '').trim().slice(0, 80);
    if (!nombre) throw new ErrorDatos('Escribe tu nombre para firmar.');
    const lista = controles(p);
    if (!lista.every((x) => x.ok)) throw new ErrorDatos('No se puede firmar: hay controles en rojo.');
    const firma = { fecha: p.fecha, nombre, usuario: req.usuario, cuando: new Date().toISOString(), controles: lista.length };
    estado.firmar(firma);
    registrar(req, 'firmar_publicacion', `${etiquetaPeriodo(p.fecha)} · ${lista.length} de ${lista.length} controles ✓ · firma: ${nombre}`);
    res.json(firma);
  });

  // --- Carta de calidad al banco (analista+): sus filas excluidas, para pedir correcciones
  app.get('/api/carta', permiso('calidad'), (req, res) => {
    const p = fechaDe(req);
    const banco = estado.catalogos.bancoPorCodigo.get(String(req.query.banco || ''));
    if (!banco) throw new ErrorDatos('Elige un banco.');
    const filas = p.excluidas.filter((e) => e.codigo_banco === banco.codigo);
    const cuenta = { E1: 0, E2: 0, E3: 0, E4: 0 };
    for (const e of filas) cuenta[e.filtro]++;
    res.json({ fecha: p.fecha, etiqueta: etiquetaPeriodo(p.fecha), codigo_banco: banco.codigo, banco: banco.nombre, conteos: cuenta, filas });
  });

  // --- Descarga a tu medida (todos los perfiles): solo lo que la persona elige
  app.get('/api/extraccion/opciones', (req, res) => res.json(opcionesExtraccion(estado)));
  app.post('/api/extraccion', async (req, res, next) => {
    try {
      const pedido = req.body || {};
      const { columnas, filas, saldo_total } = extraer(estado, pedido);
      const formato = ['csv', 'xlsx'].includes(pedido.formato) ? pedido.formato : 'json';
      if (formato === 'json') {
        return res.json({ total_filas: filas.length, columnas, filas: filas.slice(0, 20), saldo_total: aTexto(saldo_total),
          nota: 'Vista previa de las primeras 20 filas. Datos 100 % ficticios.' });
      }
      if (filas.length > 200000) throw new ErrorDatos('Son demasiadas filas para una descarga: filtra un poco más.');
      const nombre = `syntropy_extraccion_${(pedido.cortes || []).join('-') || 'todos'}.${formato}`;
      registrar(req, 'descarga_medida', `${nombre} · ${filas.length} filas · ${pedido.nivel === 'resumen' ? 'resumen' : 'detalle'}`);
      res.set('Content-Disposition', `attachment; filename="${nombre}"`);
      if (formato === 'csv') return res.type('text/csv; charset=utf-8').send(comoCsv(columnas, filas));
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(await comoExcel(columnas, filas));
    } catch (e) { next(e); }
  });

  // --- Exportaciones oficiales
  app.get('/api/exportar/:archivo', (req, res) => {
    const tipo = String(req.params.archivo).replace(/\.csv$/, '');
    if (!generar[tipo]) throw Object.assign(new Error('Exportación desconocida.'), { estado: 404 });
    const publicas = ['rankings', 'desglose'];
    if (!publicas.includes(tipo) && !PERMISOS[req.perfil].includes('exportar_todo')) {
      return res.status(401).json({ error: 'Esta descarga es para analistas y administradores.' });
    }
    const todos = estado.lista();
    const periodos = req.query.fecha ? [estado.periodo(String(req.query.fecha))] : todos;
    const comparaciones = [];
    for (let k = 1; k < todos.length; k++) {
      if (!req.query.fecha || todos[k].fecha === req.query.fecha) comparaciones.push(estado.comparar(todos[k - 1], todos[k]));
    }
    const nombre = `${tipo}${req.query.fecha ? `_${req.query.fecha}` : ''}.csv`;
    registrar(req, 'exportar', nombre);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nombre}"` });
    res.send(generar[tipo](periodos, comparaciones));
  });

  // --- Catálogos y perfiles (consulta)
  app.get('/api/catalogos', (req, res) => {
    const c = estado.catalogos;
    res.json({ cinu: c.listaCinu, sb21: c.listaSb21, bancos: c.bancos });
  });
  app.get('/api/perfiles', (req, res) => res.json({
    perfiles: Object.entries(PERMISOS).map(([id, permisos]) => ({ id, nombre: NOMBRE_PERFIL[id], permisos })),
  }));

  // --- Administración
  const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 80 * 1024 * 1024, files: 1 } });
  app.post('/api/periodos', permiso('cargar'), subida.single('archivo'), async (req, res) => {
    if (!req.file) throw new ErrorDatos('Adjunta un archivo CSV o Excel en el campo «archivo».');
    const inicio = Date.now();
    let cargado;
    try {
      cargado = await estado.cargar(req.file.originalname, req.file.buffer, req.usuario);
    } catch (e) {
      registrar(req, 'carga_fallida', `${req.file.originalname} · ${e.message}`.slice(0, 300));
      throw e;
    }
    const { fechas, reemplazo, reemplazados, avisos, conversion } = cargado;
    const procesados = fechas.map((f) => estado.periodo(f));
    let movimientos = 0;
    let explicaciones = [];
    const ultimo = procesados.at(-1);
    const anterior = estado.anteriorDe(ultimo.fecha);
    if (anterior) {
      const c = estado.comparar(anterior, ultimo);
      movimientos = c.filas.filter((f) => f.significativo).length;
      explicaciones = c.explicaciones.map((e) => e.texto).slice(0, 10);
      if (c.meses_entre !== 1) avisos.push(`La comparación con ${etiquetaPeriodo(anterior.fecha)} abarca ${c.meses_entre} meses, no uno: faltan períodos intermedios.`);
    }
    const huecos = estado.huecos().filter((h) => fechas.includes(h.hasta) || fechas.includes(h.desde));
    for (const h of huecos) if (!avisos.some((x) => x.includes(`${h.meses} meses`))) avisos.push(`Entre ${etiquetaPeriodo(h.desde)} y ${etiquetaPeriodo(h.hasta)} ${h.meses > 1 ? `faltan ${h.meses - 1} mes(es)` : 'los períodos no están en orden'}.`);
    for (const p of procesados) if (!p.cuadra) avisos.push(`El período ${p.fecha} NO cuadra: revisa las reconciliaciones y alertas en Calidad de datos.`);
    registrar(req, reemplazo ? 'actualizar_periodo' : 'cargar_periodo', `${req.file.originalname} · ${procesados.map((p) => `${p.fecha} (${p.filas_leidas} filas)`).join(', ')}${avisos.length ? ` · ${avisos.length} aviso(s)` : ''}`);
    res.json({
      procesados: procesados.map((p) => ({ fecha: p.fecha, etiqueta: etiquetaPeriodo(p.fecha), filas_leidas: p.filas_leidas, universo: p.universo, cascada: p.cascada, cuadra: p.cuadra })),
      reemplazo, reemplazados, avisos, comparado_con: anterior?.fecha || null, movimientos_significativos: movimientos, explicaciones, milisegundos: Date.now() - inicio, conversion,
    });
  });
  app.delete('/api/periodos/:fecha', permiso('cargar'), (req, res) => {
    estado.quitar(String(req.params.fecha));
    registrar(req, 'quitar_periodo', req.params.fecha);
    res.json({ ok: true });
  });
  app.get('/api/parametros', (req, res) => res.json(estado.parametros));
  app.put('/api/parametros', permiso('parametros'), (req, res) => {
    const nuevos = estado.fijarParametros(req.body || {});
    registrar(req, 'parametros', JSON.stringify(nuevos));
    res.json(nuevos);
  });
  // --- Usuarios y roles (solo administrador): cambiar el perfil de una cuenta, con cuidado
  const todasLasCuentas = () => [...(cuentas?.lista() || []), ...(producto?.lista() || [])];
  app.get('/api/usuarios', permiso('perfiles'), (req, res) => res.json(todasLasCuentas().map(({ usuario, perfil, nombre }) => ({ usuario, perfil, nombre: nombre || usuario, soy_yo: usuario === req.usuario }))));
  if (!producto && cuentas) {
    app.post('/api/cuentas', permiso('perfiles'), (req, res) => {
      let c;
      try { c = cuentas.crear(req.body || {}); } catch (e) { throw new ErrorDatos(e.message); }
      registrar(req, 'crear_cuenta', `${c.nombre} (${c.usuario}) · ${NOMBRE_PERFIL[c.perfil] || c.perfil}`);
      res.json(c);
    });
  }
  app.put('/api/usuarios/:usuario', permiso('perfiles'), (req, res) => {
    const usuario = String(req.params.usuario);
    const perfil = String(req.body?.perfil || '');
    if (!['analista', 'administrador'].includes(perfil)) throw new ErrorDatos('Perfil no válido: elige Analista o Administrador.');
    const lista = todasLasCuentas();
    const actual = lista.find((c) => c.usuario === usuario);
    if (!actual) throw Object.assign(new Error('No existe ese usuario.'), { estado: 404 });
    if (actual.perfil === 'administrador' && perfil !== 'administrador' && lista.filter((c) => c.perfil === 'administrador').length <= 1) {
      throw new ErrorDatos('Debe quedar al menos un administrador.');
    }
    if (!(cuentas?.fijarPerfil(usuario, perfil) || producto?.fijarPerfil(usuario, perfil))) throw new ErrorDatos('No se pudo cambiar el perfil.');
    registrar(req, 'cambiar_perfil', `${usuario}: ${NOMBRE_PERFIL[actual.perfil]} → ${NOMBRE_PERFIL[perfil]}`);
    res.json({ usuario, perfil });
  });
  app.get('/api/registro', permiso('registro'), (req, res) => res.json(estado.registro()));
  app.get('/api/cargas', permiso('calidad'), (req, res) => res.json(estado.cargas()));

  // --- Asistente IA (explica resultados ya calculados)
  // Límite para el perfil Público: 8 preguntas cada 10 minutos por dirección IP (cuida la suscripción).
  const preguntasPorIp = new Map();
  const limiteIa = (req) => {
    if (req.perfil !== 'publico') return false;
    const ip = req.get('Cf-Connecting-Ip') || req.ip || '?';
    const ahora = Date.now();
    const recientes = (preguntasPorIp.get(ip) || []).filter((t) => ahora - t < 10 * 60 * 1000);
    if (recientes.length >= 8) return true;
    recientes.push(ahora);
    preguntasPorIp.set(ip, recientes);
    return false;
  };
  app.post('/api/ia', permiso('asistente'), async (req, res, next) => {
    try {
      if (limiteIa(req)) return res.status(429).json({ error: 'Llegaste al límite de preguntas del perfil Público (8 cada 10 minutos). Inicia sesión o intenta en unos minutos.' });
      const pregunta = String(req.body?.pregunta || '').trim().slice(0, 1500);
      if (!pregunta) throw new ErrorDatos('Escribe una pregunta.');
      const p = fechaDe({ query: { fecha: req.body?.fecha } });
      const a = estado.anteriorDe(p.fecha);
      const contexto = {
        aviso: AVISO, fuente: FUENTE, periodo: etiquetaPeriodo(p.fecha), periodo_anterior: a ? etiquetaPeriodo(a.fecha) : null,
        unidad: 'unidades monetarias homogéneas',
        calidad: { filas_leidas: p.filas_leidas, ...p.cascada, universo_local_valido: p.universo, saldo_universo: aTexto(p.saldo_universo), cuadra: p.cuadra, alertas: p.alertas.map((x) => x.texto) },
        cartera_morosa_pct: porcentaje(p.indicadores.morosa, p.saldo_universo), cartera_vencida_pct: porcentaje(p.indicadores.vencida, p.saldo_universo),
        definicion_mora: 'Acuerdo 4-2013 SBP: morosa = más de 30 y hasta 90 días de atraso; vencida = más de 90 días (sobregiros: más de 30).',
        rankings: Object.fromEntries(ORDEN_RANKINGS.map((m) => [m, filasRanking(p, m).map((f) => ({ pos: f.posicion, banco: f.banco, saldo: f.saldo_actividad, ponderacion_pct: f.ponderacion_pct, cuota_pct: f.participacion_pct, cambio: f.cambio }))])),
        movimientos_destacados: a ? estado.comparar(a, p).explicaciones.slice(0, 15).map((e) => e.texto) : [],
      };
      // La pantalla donde está la persona: la IA le da preferencia (por ejemplo, el ranking o el banco que mira)
      const pantalla = req.body?.pantalla && typeof req.body.pantalla === 'object' ? req.body.pantalla : null;
      if (pantalla) {
        contexto.pantalla_actual = { ruta: String(pantalla.ruta || '').slice(0, 80), titulo: String(pantalla.titulo || '').slice(0, 80), filtros: String(pantalla.filtros || '').slice(0, 200) };
        contexto.instruccion_pantalla = 'Responde primero desde lo que la persona ve en pantalla_actual; usa el resto del contexto solo si hace falta.';
        const macro = String(pantalla.ranking || '').toUpperCase();
        if (a && ORDEN_RANKINGS.includes(macro)) {
          contexto.anatomia_del_ranking_en_pantalla = estado.comparar(a, p).filas.filter((f) => f.ranking === macro).map((f) => ({
            banco: f.banco, pos: f.posicion_actual, cambio: f.cambio, nuevos: aTexto(f.anatomia.nuevos), n_nuevos: f.anatomia.n_nuevos,
            terminados: aTexto(f.anatomia.terminados), n_terminados: f.anatomia.n_terminados, amortizacion: aTexto(f.anatomia.variacion),
          }));
        }
      }
      const r = await preguntarIA(pregunta, contexto, { comando: entorno.CLAUDE_COMANDO || 'claude', asistenteUrl: entorno.ASISTENTE_URL });
      registrar(req, 'consulta_ia', pregunta.slice(0, 120));
      res.json(r);
    } catch (e) { next(e); }
  });

  // --- Web (React compilada) y rutas del lado del cliente
  const web = resolve(carpetaWeb);
  if (existsSync(web)) app.use(express.static(web, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    const indice = join(web, 'index.html');
    if (!existsSync(indice)) return res.status(503).send('Falta compilar la web: ejecuta «npm run build».');
    res.set('Cache-Control', 'no-store').sendFile(indice);
  });

  // --- Errores con mensajes claros
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof ErrorDatos) return res.status(400).json({ error: err.message, ...(err.detalle ? { detalle: err.detalle } : {}) });
    if (err.estado) return res.status(err.estado).json({ error: err.message });
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El archivo supera 80 MB.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
    console.error(err);
    res.status(500).json({ error: 'Error interno. Revisa la consola del servidor.' });
  });
  return { app, estado };
}
