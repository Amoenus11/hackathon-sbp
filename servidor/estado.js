// Estado de la plataforma: períodos cargados, parámetros y registro de operaciones.
// Se guarda en datos-locales/ (fuera del repositorio). Al arrancar, TODO se recalcula desde los
// archivos originales: los resultados nunca se guardan "a mano".
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readdirSync } from 'node:fs';
import { leerCatalogos } from '../motor/cargar.js';
import { procesarArchivo, compararPeriodos, mesesEntre, PARAMETROS_INICIALES, ErrorDatos } from '../motor/motor.js';
import { generar } from '../motor/exportar.js';

const MAX_REGISTRO = 1000;

/** Lee un booleano sin trampas: Boolean('false') sería true, por eso se interpreta el texto. */
function aBooleano(v) {
  if (typeof v === 'boolean') return v;
  const t = String(v).trim().toLowerCase();
  if (['true', '1', 'si', 'sí'].includes(t)) return true;
  if (['false', '0', 'no'].includes(t)) return false;
  throw new ErrorDatos('«Cambio de líder» debe ser verdadero o falso.');
}

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
      .filter((n) => inicial === 'todos' || !/202609/.test(n));
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
      for (const p of procesarArchivo(readFileSync(a.ruta, 'utf8'), a.nombre, catalogos, new Date(a.cargado))) {
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
  /** Pares de períodos vecinos que NO son meses seguidos (falta un mes entre ellos). */
  const huecos = () => {
    const l = lista();
    return l.slice(1).map((p, k) => ({ desde: l[k].fecha, hasta: p.fecha, meses: mesesEntre(l[k].fecha, p.fecha) })).filter((h) => h.meses !== 1);
  };

  return {
    catalogos,
    lista,
    huecos,
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
      guardado.parametros = { mov_min_posiciones: min, mov_cambio_lider: aBooleano(nuevos.mov_cambio_lider), mov_var_saldo_pct: pct.toFixed(2) };
      guardar();
      publicar();
      return guardado.parametros;
    },
    comparar(anterior, actual) { return compararPeriodos(anterior, actual, guardado.parametros); },
    /** Carga un archivo AT03 nuevo: valida, calcula y deja constancia. No hay que tocar el código. */
    cargar(nombreOriginal, contenido, usuario) {
      const nombre = basename(String(nombreOriginal || 'archivo.csv')).replace(/[^\w.\-]/g, '_');
      if (!/\.csv$/i.test(nombre)) throw new ErrorDatos(`El archivo «${nombre}» debe ser un CSV (.csv) con la estructura AT03.`);
      let texto;
      try { texto = new TextDecoder('utf-8', { fatal: true }).decode(contenido); } catch {
        throw new ErrorDatos(`El archivo «${nombre}» no está en UTF-8. Guárdelo como «CSV UTF-8» y vuelva a intentarlo.`);
      }
      const resultado = procesarArchivo(texto, nombre, catalogos); // lanza ErrorDatos si algo no cuadra
      // Si el archivo trae un período que ya existe, lo REEMPLAZA (así se actualiza un corte): se deja
      // constancia explícita de cuánto había y cuánto hay ahora, para que nada se pierda en silencio.
      const reemplazados = resultado
        .filter((p) => periodos.has(p.fecha))
        .map((p) => ({ fecha: p.fecha, filas_antes: periodos.get(p.fecha).filas_leidas, filas_despues: p.filas_leidas, archivo_anterior: periodos.get(p.fecha).archivo }));
      const avisos = reemplazados.map((r) => (r.filas_despues < r.filas_antes
        ? `El período ${r.fecha} ya existía con ${r.filas_antes} filas («${r.archivo_anterior}») y fue reemplazado por un archivo con solo ${r.filas_despues}. Si el archivo es parcial, cargue el período completo.`
        : `El período ${r.fecha} ya existía (${r.filas_antes} filas) y fue reemplazado por este archivo (${r.filas_despues} filas).`));
      const ruta = join(carpetaArchivos, `${Date.now()}_${nombre}`);
      writeFileSync(ruta, contenido);
      const fechas = resultado.map((p) => p.fecha);
      guardado.archivos.push({ nombre, ruta, cargado: new Date().toISOString(), usuario });
      guardado.quitados = guardado.quitados.filter((f) => !fechas.includes(f));
      recalcular();
      guardar();
      return { fechas, reemplazo: reemplazados.length > 0, reemplazados, avisos };
    },
    quitar(fecha) {
      if (!periodos.has(fecha)) throw Object.assign(new Error(`No hay datos del período ${fecha}.`), { estado: 404 });
      if (periodos.size === 1) throw new ErrorDatos('Debe quedar al menos un período cargado.');
      guardado.quitados.push(fecha);
      recalcular();
      guardar();
    },
    registrar(usuario, perfil, accion, detalle) {
      guardado.registro.push({ cuando: new Date().toISOString(), usuario: usuario || 'público', perfil, accion, detalle });
      if (guardado.registro.length > MAX_REGISTRO) guardado.registro.splice(0, guardado.registro.length - MAX_REGISTRO);
      guardar();
    },
    registro: () => [...guardado.registro].reverse(),
  };
}
