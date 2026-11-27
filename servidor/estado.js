// Estado de la plataforma: períodos cargados, parámetros y registro de operaciones.
// Se guarda en datos-locales/ (fuera del repositorio). Al arrancar, TODO se recalcula desde los
// archivos originales: los resultados nunca se guardan "a mano".
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readdirSync } from 'node:fs';
import { leerCatalogos } from '../motor/cargar.js';
import { procesarArchivo, compararPeriodos, PARAMETROS_INICIALES, ErrorDatos } from '../motor/motor.js';
import { generar } from '../motor/exportar.js';
import { leerArchivoSubido } from './leerArchivo.js';

const MAX_REGISTRO = 1000;

export function crearEstado({ carpetaReto = 'datos/reto', carpetaLocal = 'datos-locales', inicial = 'todos' } = {}) {
  const catalogos = leerCatalogos(carpetaReto);
  const carpetaArchivos = join(carpetaLocal, 'archivos');
  mkdirSync(carpetaArchivos, { recursive: true });
  const rutaEstado = join(carpetaLocal, 'estado.json');

  let guardado;
  if (existsSync(rutaEstado)) {
    guardado = JSON.parse(readFileSync(rutaEstado, 'utf8'));
  } else {
    // Primera vez: se cargan los cortes del paquete del reto (todos, o solo julio y agosto
    // para demostrar en vivo la carga automática de septiembre).
    const archivos = readdirSync(carpetaReto).filter((n) => /^AT03.*\.csv$/i.test(n)).sort()
      .filter((n) => inicial === 'todos' || (inicial !== 'ninguno' && !/202609/.test(n)));
    guardado = {
      archivos: archivos.map((n) => ({ nombre: n, ruta: join(carpetaReto, n), cargado: new Date().toISOString(), usuario: 'sistema' })),
      quitados: [],
      parametros: { ...PARAMETROS_INICIALES },
      registro: [],
    };
  }

  const periodos = new Map();
  let carpetaResultados = null;
  function publicar() {
    if (!carpetaResultados) return;
    mkdirSync(carpetaResultados, { recursive: true });
    const l = [...periodos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const comparaciones = l.slice(1).map((p, k) => compararPeriodos(l[k], p, guardado.parametros));
    for (const [tipo, fn] of Object.entries(generar)) {
      writeFileSync(join(carpetaResultados, `${tipo}.csv.tmp`), fn(l, comparaciones));
      renameSync(join(carpetaResultados, `${tipo}.csv.tmp`), join(carpetaResultados, `${tipo}.csv`));
    }
  }
  function recalcular() {
    periodos.clear();
    for (const a of guardado.archivos) {
      if (!existsSync(a.ruta)) continue;
      const resultado = procesarArchivo(readFileSync(a.ruta, 'utf8'), a.nombre, catalogos, new Date(a.cargado));
      a.fechas = resultado.map((p) => p.fecha);
      for (const p of resultado) {
        if (!guardado.quitados.includes(p.fecha)) periodos.set(p.fecha, p);
      }
    }
    publicar();
  }
  function guardar() {
    const tmp = `${rutaEstado}.tmp`;
    writeFileSync(tmp, JSON.stringify(guardado, null, 1));
    renameSync(tmp, rutaEstado);
  }
  recalcular();
  if (!guardado.registro.length) {
    guardado.registro.push({ cuando: new Date().toISOString(), usuario: 'sistema', perfil: 'sistema', accion: 'inicio', detalle: `Cargados ${periodos.size} períodos del paquete del reto` });
  }
  guardar();

  const lista = () => [...periodos.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return {
    catalogos,
    lista,
    publicarEn(carpeta) { carpetaResultados = carpeta; publicar(); },
    ultimo: () => lista().at(-1) || null,
    periodo(fecha) {
      const p = periodos.get(fecha);
      if (!p) throw Object.assign(new Error(`No hay datos del período ${fecha}.`), { estado: 404 });
      return p;
    },
    anteriorDe(fecha) {
      const l = lista();
      const k = l.findIndex((p) => p.fecha === fecha);
      return k > 0 ? l[k - 1] : null;
    },
    get parametros() { return guardado.parametros; },
    fijarParametros(nuevos) {
      const min = Number(nuevos.mov_min_posiciones);
      const pct = Number(nuevos.mov_var_saldo_pct);
      if (!Number.isInteger(min) || min < 1 || min > 11) throw new ErrorDatos('«Posiciones mínimas» debe ser un entero entre 1 y 11.');
      if (!Number.isFinite(pct) || pct < 0 || pct > 1000) throw new ErrorDatos('«Variación de saldo» debe ser un porcentaje entre 0 y 1000.');
      guardado.parametros = { mov_min_posiciones: min, mov_cambio_lider: Boolean(nuevos.mov_cambio_lider), mov_var_saldo_pct: pct.toFixed(2) };
      guardar();
      publicar();
      return guardado.parametros;
    },
    comparar(anterior, actual) { return compararPeriodos(anterior, actual, guardado.parametros); },
    /** Carga un archivo AT03 nuevo: valida, calcula y deja constancia. No hay que tocar el código. */
    async cargar(nombreOriginal, contenido, usuario) {
      const inicio = Date.now();
      const nombre = basename(String(nombreOriginal || 'archivo.csv')).replace(/[^\w.\-]/g, '_');
      const entrada = { cuando: new Date().toISOString(), usuario, archivo: nombre, formato: /\.xlsx$/i.test(nombre) ? 'xlsx' : 'csv' };
      try {
        const { csv, conversion } = await leerArchivoSubido(nombre, contenido, catalogos); // convierte y anota cada cambio
        const resultado = procesarArchivo(csv, nombre, catalogos); // lanza ErrorDatos si algo no cuadra
        const marca = Date.now();
        writeFileSync(join(carpetaArchivos, `${marca}_original_${nombre}`), contenido); // tal como llegó
        const ruta = join(carpetaArchivos, `${marca}_${nombre.replace(/\.(xlsx|txt)$/i, '')}${/\.csv$/i.test(nombre) ? '' : '.csv'}`);
        writeFileSync(ruta, csv); // ya normalizado: es lo que se recalcula al arrancar
        const fechas = resultado.map((p) => p.fecha);
        const reemplazo = fechas.some((f) => periodos.has(f));
        // Solo se calcula el archivo nuevo; los anteriores que reemplaza por completo dejan de usarse (no se borran)
        guardado.archivos = guardado.archivos.filter((a) => !(a.fechas && a.fechas.length && a.fechas.every((f) => fechas.includes(f))));
        guardado.archivos.push({ nombre, ruta, cargado: new Date().toISOString(), usuario, fechas });
        guardado.quitados = guardado.quitados.filter((f) => !fechas.includes(f));
        for (const p of resultado) periodos.set(p.fecha, p);
        publicar();
        Object.assign(entrada, { ok: true, fechas, filas: resultado.reduce((t, p) => t + p.filas_leidas, 0), milisegundos: Date.now() - inicio, conversion });
        return { fechas, reemplazo, conversion };
      } catch (e) {
        Object.assign(entrada, { ok: false, error: e.message, detalle: e.detalle || null, milisegundos: Date.now() - inicio, conversion: e.detalle?.conversion || null });
        throw e;
      } finally {
        guardado.cargas = [...(guardado.cargas || []), entrada].slice(-200);
        guardar();
      }
    },
    cargas: () => [...(guardado.cargas || [])].reverse(),
    quitar(fecha) {
      if (!periodos.has(fecha)) throw Object.assign(new Error(`No hay datos del período ${fecha}.`), { estado: 404 });
      if (periodos.size === 1) throw new ErrorDatos('Debe quedar al menos un período cargado.');
      guardado.quitados.push(fecha);
      periodos.delete(fecha);
      publicar();
      guardar();
    },
    registrar(usuario, perfil, accion, detalle) {
      guardado.registro.push({ cuando: new Date().toISOString(), usuario: usuario || 'público', perfil, accion, detalle });
      if (guardado.registro.length > MAX_REGISTRO) guardado.registro.splice(0, guardado.registro.length - MAX_REGISTRO);
      guardar();
    },
    registro: () => [...guardado.registro].reverse(),
    firmas: (fecha) => (guardado.firmas || []).filter((f) => f.fecha === fecha).reverse(),
    firmar(firma) { guardado.firmas = [...(guardado.firmas || []), firma]; guardar(); },
  };
}
