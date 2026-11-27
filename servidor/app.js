// Servidor HTTP: implementa el contrato docs/api.md sobre Express 5.
import express from 'express';
import multer from 'multer';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Estado, ErrorConsulta } from './estado.js';
import { COOKIE, Sesiones, leerCookie, leerUsuarios, verificarClave, nivel, PERMISOS } from './acceso.js';
import * as vistas from './vistas.js';
import { reporteHtml } from './reporte.js';
import { preguntar } from './ia.js';
import { ErrorValidacion, catalogosParaApi } from '../motor/catalogos.js';
import { exportarCsv, TIPOS_EXPORTACION } from '../motor/exportar.js';

/**
 * @param {{ carpetaDatos: string, carpetaLocal: string, carpetaWeb?: string }} opciones
 */
export function crearApp({ carpetaDatos, carpetaLocal, carpetaWeb }) {
  const estado = new Estado({ carpetaDatos, carpetaLocal }).iniciar();
  const sesiones = new Sesiones();
  const rutaUsuarios = join(carpetaLocal, 'usuarios.json');
  const app = express();
  app.disable('x-powered-by');
  app.locals.estado = estado;

  // ------------------------------------------------------------------ seguridad básica
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    const token = leerCookie(req, COOKIE);
    req.sesion = sesiones.leer(token) ?? { usuario: null, perfil: 'publico' };
    req.token = token;
    next();
  });
  app.use('/api', express.json({ limit: '100kb' }));
  // Toda escritura exige la cabecera X-Syntropy: 1 (un formulario de otro sitio no puede enviarla)
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('X-Syntropy') !== '1') {
      return res.status(403).json({ error: 'Falta la cabecera X-Syntropy: 1.' });
    }
    next();
  });

  const exige = (perfil) => (req, res, next) => {
    if (nivel(req.sesion.perfil) >= nivel(perfil)) return next();
    const quien = perfil === 'administrador' ? 'administrador' : 'analista o administrador';
    res.status(req.sesion.usuario ? 403 : 401).json({ error: `Esta opción es solo para el perfil ${quien}.` });
  };
  const q = (req, k) => (typeof req.query[k] === 'string' && req.query[k] !== '' ? req.query[k] : undefined);

  // ------------------------------------------------------------------ sesión
  app.get('/api/sesion', (req, res) => res.json({ perfil: req.sesion.perfil, usuario: req.sesion.usuario }));

  app.post('/api/sesion', (req, res) => {
    const usuario = String(req.body?.usuario ?? '').trim().toLowerCase();
    const clave = String(req.body?.clave ?? '');
    if (!usuario || !clave) return res.status(400).json({ error: 'Escriba usuario y contraseña.' });
    const espera = sesiones.bloqueado(usuario);
    if (espera) return res.status(429).json({ error: `Demasiados intentos fallidos. Espere ${espera} segundos.` });
    const cuenta = leerUsuarios(rutaUsuarios).find((u) => u.usuario === usuario);
    if (!cuenta || !verificarClave(clave, cuenta)) {
      sesiones.fallo(usuario);
      estado.registrar({ usuario, perfil: 'publico' }, 'inicio_sesion_fallido', '');
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    sesiones.exito(usuario);
    if (req.token) sesiones.cerrar(req.token);
    const token = sesiones.crear(cuenta.usuario, cuenta.perfil);
    const segura = req.secure ? '; Secure' : '';
    res.set('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${segura}`);
    estado.registrar({ usuario: cuenta.usuario, perfil: cuenta.perfil }, 'inicio_sesion', '');
    res.json({ perfil: cuenta.perfil, usuario: cuenta.usuario });
  });

  app.delete('/api/sesion', (req, res) => {
    if (req.token) sesiones.cerrar(req.token);
    if (req.sesion.usuario) estado.registrar(req.sesion, 'cierre_sesion', '');
    res.set('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    res.json({ perfil: 'publico', usuario: null });
  });

  // ------------------------------------------------------------------ consulta (todos los perfiles)
  app.get('/api/meta', (req, res) => res.json(vistas.meta(estado)));
  app.get('/api/panel', (req, res) => res.json(vistas.panel(estado, q(req, 'fecha'))));
  app.get('/api/rankings', (req, res) => res.json(vistas.rankings(estado, q(req, 'fecha'), q(req, 'ranking'))));
  app.get('/api/matriz', (req, res) => res.json(vistas.matriz(estado, q(req, 'fecha'))));
  app.get('/api/historia', (req, res) => res.json(vistas.historia(estado, q(req, 'ranking'))));
  app.get('/api/desglose', (req, res) => res.json(vistas.desglose(estado, q(req, 'fecha'), q(req, 'ranking'), q(req, 'banco'))));
  app.get('/api/bancos', (req, res) => res.json(vistas.bancos(estado, q(req, 'fecha'))));

  // ------------------------------------------------------------------ análisis (analista+)
  app.get('/api/movimientos', exige('analista'), (req, res) => res.json(vistas.movimientos(estado, q(req, 'desde'), q(req, 'hasta'), q(req, 'ranking'))));
  app.get('/api/calidad', exige('analista'), (req, res) => res.json(vistas.calidad(estado, q(req, 'fecha'))));
  app.get('/api/excluidas', exige('analista'), (req, res) => res.json(vistas.excluidas(estado, q(req, 'fecha'), q(req, 'filtro'), q(req, 'pagina'))));
  app.post('/api/ia', exige('analista'), async (req, res) => {
    const r = await preguntar(estado, { pregunta: req.body?.pregunta, fecha: req.body?.fecha });
    estado.registrar(req.sesion, 'consulta_ia', String(req.body?.pregunta ?? '').slice(0, 140));
    res.json(r);
  });

  // ------------------------------------------------------------------ exportaciones
  const PUBLICAS = new Set(['rankings', 'desglose']);
  app.get('/api/exportar/reporte.html', exige('analista'), (req, res) => {
    const elegidos = q(req, 'rankings')?.split(',').filter(Boolean) ?? null;
    const html = reporteHtml(estado, { fecha: q(req, 'fecha'), rankings: elegidos, banco: q(req, 'banco'), usuario: req.sesion.usuario });
    const fecha = q(req, 'fecha') ?? estado.ultimo;
    estado.registrar(req.sesion, 'descarga', `reporte_${fecha}.html`);
    res.set('Content-Disposition', `${q(req, 'ver') ? 'inline' : 'attachment'}; filename="reporte_rankings_${fecha}.html"`);
    res.type('html').send(html);
  });

  app.get('/api/exportar/:archivo', (req, res) => {
    const m = /^([a-z]+)\.csv$/.exec(req.params.archivo);
    const tipo = m?.[1];
    if (!tipo || !TIPOS_EXPORTACION.includes(tipo)) return res.status(404).json({ error: `Exportación desconocida. Opciones: ${TIPOS_EXPORTACION.map((t) => `${t}.csv`).join(', ')}.` });
    if (!PUBLICAS.has(tipo) && nivel(req.sesion.perfil) < nivel('analista')) {
      return res.status(req.sesion.usuario ? 403 : 401).json({ error: 'Esta descarga es solo para los perfiles analista y administrador.' });
    }
    const fecha = q(req, 'fecha');
    const periodos = fecha ? [estado.periodo(fecha)] : estado.periodos;
    let comparaciones = estado.comparaciones;
    if (tipo === 'movimientos') {
      const desde = q(req, 'desde'), hasta = q(req, 'hasta');
      if (desde || hasta) comparaciones = [estado.comparar(desde ?? estado.anterior(hasta ?? estado.ultimo)?.fecha, hasta ?? estado.ultimo)];
      else if (fecha) comparaciones = comparaciones.filter((c) => c.hasta === fecha);
    }
    const filtros = { ranking: q(req, 'ranking'), banco: q(req, 'banco'), filtro: q(req, 'filtro'), soloSignificativos: q(req, 'significativos') === '1' };
    const csv = exportarCsv(tipo, { periodos, comparaciones, cat: estado.cat, filtros });
    const nombre = `${tipo}${fecha ? `_${fecha}` : '_todos'}${filtros.ranking ? `_${filtros.ranking}` : ''}${filtros.banco ? `_${filtros.banco}` : ''}.csv`;
    estado.registrar(req.sesion, 'descarga', nombre);
    res.set('Content-Disposition', `attachment; filename="${nombre}"`);
    res.type('text/csv; charset=utf-8').send(csv);
  });

  // ------------------------------------------------------------------ administración
  const subida = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024, files: 1 } });
  app.post('/api/periodos', exige('administrador'), (req, res, next) => {
    subida.single('archivo')(req, res, (err) => {
      if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera 60 MB.' : `No se pudo recibir el archivo: ${err.message}` });
      if (!req.file) return res.status(400).json({ error: 'Adjunte un archivo AT03 en el campo «archivo».' });
      try {
        const r = estado.cargarArchivo(req.file.originalname, req.file.buffer);
        estado.registrar(req.sesion, 'cargar_periodo', `${req.file.originalname} · ${r.procesados.map((p) => `${p.fecha}: ${p.filas_leidas} filas, universo ${p.universo}`).join(' · ')}`);
        res.json(r);
      } catch (e) {
        if (e instanceof ErrorValidacion) {
          estado.registrar(req.sesion, 'carga_rechazada', `${req.file.originalname} · ${e.message}`);
          return res.status(400).json({ error: e.message, detalles: e.detalles });
        }
        next(e);
      }
    });
  });

  app.delete('/api/periodos/:fecha', exige('administrador'), (req, res) => {
    estado.quitarPeriodo(req.params.fecha);
    estado.registrar(req.sesion, 'quitar_periodo', req.params.fecha);
    res.json({ ok: true });
  });

  app.get('/api/parametros', exige('administrador'), (req, res) => res.json(estado.parametros));
  app.put('/api/parametros', exige('administrador'), (req, res) => {
    let p;
    try { p = estado.cambiarParametros(req.body); } catch (e) { return res.status(400).json({ error: e.message }); }
    estado.registrar(req.sesion, 'cambiar_parametros', JSON.stringify(p));
    res.json(p);
  });

  app.get('/api/catalogos', exige('administrador'), (req, res) => res.json(catalogosParaApi(estado.cat)));
  app.get('/api/registro', exige('administrador'), (req, res) => res.json(estado.leerRegistro()));
  app.get('/api/usuarios', exige('administrador'), (req, res) => res.json({
    usuarios: leerUsuarios(rutaUsuarios).map(({ usuario, perfil }) => ({ usuario, perfil })),
    permisos: PERMISOS,
  }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta de la API inexistente.' }));

  // ------------------------------------------------------------------ web compilada (React)
  if (carpetaWeb && existsSync(join(carpetaWeb, 'index.html'))) {
    app.use(express.static(carpetaWeb, { index: false, maxAge: '1h' }));
    app.get(/.*/, (req, res) => res.sendFile(join(carpetaWeb, 'index.html')));
  }

  // ------------------------------------------------------------------ errores
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const codigo = err instanceof ErrorConsulta ? err.estado : err.estado ?? (err.type === 'entity.parse.failed' ? 400 : 500);
    if (codigo >= 500) console.error(err);
    res.status(codigo).json({ error: codigo >= 500 ? 'Error interno del servidor. Revise la consola del servidor.' : err.message });
  });

  return app;
}
