// Estado de la plataforma: catálogos, períodos procesados, parámetros y registro de operaciones.
//
// Fuentes de períodos (se procesan al arrancar, siempre desde los archivos):
//   1. Los AT03 del paquete, en la carpeta de datos (por defecto ./datos).
//   2. Los AT03 que el administrador carga desde la web (datos-locales/periodos/).
// Si dos archivos traen la misma Fecha, gana el más reciente. Quitar un período lo oculta
// (estado.json) para poder repetir la demostración de carga sin tocar los archivos del paquete.
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { leerCatalogos, archivosAt03 } from '../motor/cargar.js';
import { procesarAt03 } from '../motor/periodo.js';
import { compararPeriodos, normalizarParametros, PARAMETROS_POR_DEFECTO } from '../motor/comparacion.js';
import { ErrorValidacion } from '../motor/catalogos.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const etiqueta = (f) => `${MESES[Number(f.slice(4, 6)) - 1]} ${f.slice(0, 4)}`;
export const etiquetaCorta = (f) => `${MESES[Number(f.slice(4, 6)) - 1].slice(0, 3)} ${f.slice(0, 4)}`;

export class Estado {
  constructor({ carpetaDatos, carpetaLocal }) {
    this.carpetaDatos = carpetaDatos;
    this.carpetaLocal = carpetaLocal;
    this.carpetaCargas = join(carpetaLocal, 'periodos');
    this.rutaEstado = join(carpetaLocal, 'estado.json');
    this.rutaRegistro = join(carpetaLocal, 'registro.jsonl');
    mkdirSync(this.carpetaCargas, { recursive: true });
  }

  iniciar() {
    this.cat = leerCatalogos(this.carpetaDatos);
    const guardado = existsSync(this.rutaEstado) ? JSON.parse(readFileSync(this.rutaEstado, 'utf8')) : {};
    this.ocultos = new Set(guardado.ocultos ?? []);
    this.parametros = guardado.parametros ? normalizarParametros(guardado.parametros) : { ...PARAMETROS_POR_DEFECTO };
    this.todos = new Map(); // fecha → resultado (incluye ocultos)
    const fuentes = [
      ...archivosAt03(this.carpetaDatos).map((n) => join(this.carpetaDatos, n)),
      ...readdirSync(this.carpetaCargas).filter((n) => n.toLowerCase().endsWith('.csv')).sort().map((n) => join(this.carpetaCargas, n)),
    ];
    for (const ruta of fuentes) {
      const nombre = ruta.split(/[\\/]/).pop().replace(/^\d{8}T\d{6}_/, '');
      try {
        for (const p of procesarAt03(readFileSync(ruta, 'utf8'), nombre, this.cat)) this.todos.set(p.fecha, p);
      } catch (e) {
        console.error(`No se pudo procesar ${ruta}: ${e.message}`);
      }
    }
    this.recalcular();
    return this;
  }

  /** Recalcula la lista visible y las comparaciones consecutivas (con los parámetros vigentes). */
  recalcular() {
    this.periodos = [...this.todos.values()].filter((p) => !this.ocultos.has(p.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    this.porFecha = new Map(this.periodos.map((p) => [p.fecha, p]));
    this.comparaciones = this.periodos.slice(1).map((p, k) => compararPeriodos(this.periodos[k], p, this.cat, this.parametros));
  }

  guardarEstado() {
    writeFileSync(this.rutaEstado, JSON.stringify({ ocultos: [...this.ocultos].sort(), parametros: this.parametros }, null, 2));
  }

  // -------------------------------------------------------------------------- consultas
  get ultimo() { return this.periodos.at(-1)?.fecha ?? null; }

  periodo(fecha) {
    const f = fecha || this.ultimo;
    const p = this.porFecha.get(f);
    if (!p) throw new ErrorConsulta(404, fecha ? `No hay datos del período ${fecha}.` : 'Todavía no hay períodos cargados.');
    return p;
  }

  anterior(fecha) {
    const i = this.periodos.findIndex((p) => p.fecha === fecha);
    return i > 0 ? this.periodos[i - 1] : null;
  }

  /** Comparación entre dos períodos cualesquiera (desde < hasta). */
  comparar(desde, hasta) {
    const a = this.periodo(desde), b = this.periodo(hasta);
    if (a.fecha >= b.fecha) throw new ErrorConsulta(400, 'El período «desde» debe ser anterior a «hasta».');
    return compararPeriodos(a, b, this.cat, this.parametros);
  }

  // -------------------------------------------------------------------------- administración
  /**
   * Procesa un archivo AT03 cargado desde la web. Si es válido, lo guarda y recalcula todo.
   * Lanza ErrorValidacion (con detalles) si no lo es; en ese caso no cambia nada.
   */
  cargarArchivo(nombreOriginal, contenido) {
    const nombre = String(nombreOriginal || 'archivo.csv').split(/[\\/]/).pop().replace(/[^\w.\-]/g, '_').slice(0, 120);
    if (!/\.csv$/i.test(nombre)) throw new ErrorValidacion('El archivo debe ser un CSV (.csv).');
    let texto;
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(contenido);
    } catch {
      throw new ErrorValidacion('El archivo no está en UTF-8. Guárdelo como «CSV UTF-8» y vuelva a intentarlo.');
    }
    const resultados = procesarAt03(texto, nombre, this.cat);
    const previos = new Set(this.periodos.map((p) => p.fecha));
    const sello = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    writeFileSync(join(this.carpetaCargas, `${sello}_${nombre}`), texto);
    for (const p of resultados) {
      this.todos.set(p.fecha, p);
      this.ocultos.delete(p.fecha);
    }
    this.guardarEstado();
    this.recalcular();
    // Movimientos que trae cada período nuevo respecto del anterior
    const comps = resultados.map((p) => this.comparaciones.find((c) => c.hasta === p.fecha)).filter(Boolean);
    return {
      procesados: resultados.map((p) => ({ fecha: p.fecha, filas_leidas: p.filas_leidas, universo: p.universo, cuadra: p.cuadra })),
      reemplazo: resultados.some((p) => previos.has(p.fecha)),
      movimientos_significativos: comps.reduce((t, c) => t + c.filas.filter((f) => f.significativo).length, 0),
      explicaciones: comps.flatMap((c) => c.explicaciones.slice(0, 8).map((e) => e.texto)),
    };
  }

  quitarPeriodo(fecha) {
    if (!this.porFecha.has(fecha)) throw new ErrorConsulta(404, `No hay un período ${fecha} para quitar.`);
    this.ocultos.add(fecha);
    this.guardarEstado();
    this.recalcular();
  }

  cambiarParametros(p) {
    this.parametros = normalizarParametros(p);
    this.guardarEstado();
    this.recalcular();
    return this.parametros;
  }

  // -------------------------------------------------------------------------- registro
  registrar(sesion, accion, detalle = '') {
    const e = { cuando: new Date().toISOString(), usuario: sesion?.usuario ?? null, perfil: sesion?.perfil ?? 'publico', accion, detalle };
    appendFileSync(this.rutaRegistro, JSON.stringify(e) + '\n');
  }

  leerRegistro(limite = 300) {
    if (!existsSync(this.rutaRegistro)) return [];
    const lineas = readFileSync(this.rutaRegistro, 'utf8').trim().split('\n').filter(Boolean);
    return lineas.slice(-limite).reverse().map((l) => JSON.parse(l));
  }
}

export class ErrorConsulta extends Error {
  constructor(estado, mensaje) {
    super(mensaje);
    this.estado = estado;
  }
}
