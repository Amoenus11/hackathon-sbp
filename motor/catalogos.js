// Catálogos de referencia del reto. Toda clasificación sale de aquí (nunca de datos del cliente).
import { csvAObjetos } from './csv.js';

export class ErrorValidacion extends Error {
  constructor(mensaje, detalles = []) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.detalles = detalles;
  }
}

/**
 * Orden de presentación y tipo de cada ranking (Sección 5 de las indicaciones).
 * Los NOMBRES salen del catálogo CINU; aquí solo se fija el orden y la etiqueta.
 * Una macroactividad nueva en el catálogo se agrega al final como «adicional».
 */
const PRESENTACION = {
  HIPOTECARIO: { titulo: 'Hipotecario', tipo: 'obligatorio' },
  CONSTRUCCION: { titulo: 'Construcción', tipo: 'obligatorio' },
  INDUSTRIA: { titulo: 'Industria', tipo: 'obligatorio' },
  AGROPECUARIO: { titulo: 'Agropecuario', tipo: 'obligatorio' },
  COMERCIO: { titulo: 'Comercio', tipo: 'recomendado' },
  CONSUMO: { titulo: 'Consumo', tipo: 'bonus' },
};

const exigirColumnas = (filas, columnas, archivo) => {
  const presentes = filas.length ? Object.keys(filas[0]) : [];
  const faltan = columnas.filter((c) => !presentes.includes(c));
  if (faltan.length) throw new ErrorValidacion(`El catálogo ${archivo} no trae las columnas: ${faltan.join(', ')}.`);
};

/** Recibe el texto de los 4 archivos de referencia y devuelve los catálogos listos para usar. */
export function construirCatalogos({ cinu, sb21, bancos, diccionario }) {
  const filasCinu = csvAObjetos(cinu);
  exigirColumnas(filasCinu, ['Codigo_CINU', 'Descripcion', 'Macroactividad_Reto', 'Subactividad_Reto'], 'CINU/SB109');
  const filasSb21 = csvAObjetos(sb21);
  exigirColumnas(filasSb21, ['Codigo', 'Descripcion'], 'SB21');
  const filasBancos = csvAObjetos(bancos);
  exigirColumnas(filasBancos, ['Codigo_Banco', 'Nombre_Ficticio'], 'de bancos');
  const filasDic = csvAObjetos(diccionario);
  exigirColumnas(filasDic, ['Campo'], 'diccionario AT03');

  // CINU: la llave es Codigo_CINU (nunca Codigo_SB08_Referencia: el 2103 se repite)
  const cinuPorCodigo = new Map();
  const subsPorMacro = new Map();
  for (const f of filasCinu) {
    if (cinuPorCodigo.has(f.Codigo_CINU)) throw new ErrorValidacion(`Código CINU repetido en el catálogo: ${f.Codigo_CINU}.`);
    cinuPorCodigo.set(f.Codigo_CINU, {
      codigo: f.Codigo_CINU, descripcion: f.Descripcion, macroactividad: f.Macroactividad_Reto,
      subactividad: f.Subactividad_Reto, sb08: f.Codigo_SB08_Referencia ?? '',
    });
    if (!subsPorMacro.has(f.Macroactividad_Reto)) subsPorMacro.set(f.Macroactividad_Reto, []);
    const subs = subsPorMacro.get(f.Macroactividad_Reto);
    if (!subs.includes(f.Subactividad_Reto)) subs.push(f.Subactividad_Reto);
  }
  const conocidos = Object.keys(PRESENTACION).filter((m) => subsPorMacro.has(m));
  const extras = [...subsPorMacro.keys()].filter((m) => !PRESENTACION[m]).sort();
  const rankings = [...conocidos, ...extras].map((nombre) => ({
    nombre,
    titulo: PRESENTACION[nombre]?.titulo ?? nombre.charAt(0) + nombre.slice(1).toLowerCase(),
    tipo: PRESENTACION[nombre]?.tipo ?? 'adicional',
    subactividades: subsPorMacro.get(nombre),
  }));

  const listaBancos = filasBancos
    .map((f) => ({ codigo: f.Codigo_Banco, nombre: f.Nombre_Ficticio, licencia: f.Tipo_Licencia ?? '' }))
    .sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0));

  return {
    cinu: cinuPorCodigo,
    rankings,
    sb21: new Map(filasSb21.map((f) => [f.Codigo, { codigo: f.Codigo, descripcion: f.Descripcion, uso: f.Uso_en_reto ?? '' }])),
    bancos: listaBancos,
    bancoPorCodigo: new Map(listaBancos.map((b) => [b.codigo, b])),
    columnas: filasDic.map((f) => f.Campo),
    diccionario: filasDic,
  };
}

/** Versión serializable de los catálogos (para GET /api/catalogos). */
export function catalogosParaApi(cat) {
  return {
    cinu: [...cat.cinu.values()].map((c) => ({ codigo: c.codigo, descripcion: c.descripcion, macroactividad: c.macroactividad, subactividad: c.subactividad, sb08: c.sb08 })),
    sb21: [...cat.sb21.values()],
    bancos: cat.bancos,
  };
}
