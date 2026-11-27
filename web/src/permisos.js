// Qué ve cada perfil (lámina 6 del reto). El servidor aplica los mismos permisos en la API;
// aquí solo decidimos qué opciones mostrar en el menú.

export const PERFILES = {
  publico: { nombre: 'Público', descripcion: 'Consulta' },
  analista: { nombre: 'Analista', descripcion: 'Análisis' },
  administrador: { nombre: 'Administrador', descripcion: 'Control' },
};

const ORDEN = ['publico', 'analista', 'administrador'];

// Secciones de la app: perfil mínimo necesario para entrar
export const SECCIONES = [
  { clave: 'panel', ruta: '/', titulo: 'Panel principal', grupo: 'Consulta', minimo: 'publico', icono: '◧' },
  { clave: 'rankings', ruta: '/rankings', titulo: 'Rankings', grupo: 'Consulta', minimo: 'publico', icono: '☰' },
  { clave: 'metodologia', ruta: '/metodologia', titulo: 'Metodología y datos', grupo: 'Consulta', minimo: 'publico', icono: '⌬' },
  { clave: 'extraccion', ruta: '/extraccion', titulo: 'Descarga a tu medida', grupo: 'Consulta', minimo: 'publico', icono: '⤓' },
  { clave: 'descargas', ruta: '/descargas', titulo: 'Exportaciones oficiales', grupo: 'Consulta', minimo: 'publico', icono: '▤' },
  { clave: 'asistente', ruta: '/asistente', titulo: 'Asistente IA', grupo: 'Consulta', minimo: 'publico', icono: '✦' },
  { clave: 'equipo', ruta: '/equipo', titulo: 'Equipo Syntropy', grupo: 'Consulta', minimo: 'publico', icono: '✺' },
  { clave: 'comparar', ruta: '/comparar', titulo: 'Comparar', grupo: 'Análisis', minimo: 'analista', icono: '⇄' },
  { clave: 'calidad', ruta: '/calidad', titulo: 'Calidad de datos', grupo: 'Análisis', minimo: 'analista', icono: '✓' },
  { clave: 'publicar', ruta: '/publicar', titulo: 'Preparar publicación', grupo: 'Análisis', minimo: 'analista', icono: '◉' },
  { clave: 'carta', ruta: '/carta', titulo: 'Carta al banco', grupo: 'Análisis', minimo: 'analista', icono: '✉' },
  { clave: 'reportes', ruta: '/reportes', titulo: 'Reportes', grupo: 'Análisis', minimo: 'analista', icono: '▤' },
  { clave: 'cargar', ruta: '/admin/cargar', titulo: 'Cargar período', grupo: 'Administración', minimo: 'administrador', icono: '⇪' },
  { clave: 'parametros', ruta: '/admin/parametros', titulo: 'Parámetros', grupo: 'Administración', minimo: 'administrador', icono: '⚙' },
  { clave: 'catalogos', ruta: '/admin/catalogos', titulo: 'Catálogos', grupo: 'Administración', minimo: 'administrador', icono: '▦' },
  { clave: 'perfiles', ruta: '/admin/perfiles', titulo: 'Perfiles y permisos', grupo: 'Administración', minimo: 'administrador', icono: '◎' },
  { clave: 'registro', ruta: '/admin/registro', titulo: 'Registro de operaciones', grupo: 'Administración', minimo: 'administrador', icono: '≣' },
];

export function puede(perfil, minimo) {
  return ORDEN.indexOf(perfil || 'publico') >= ORDEN.indexOf(minimo);
}

export function seccionesDe(perfil) {
  return SECCIONES.filter((s) => puede(perfil, s.minimo));
}

// Exportaciones: Público solo rankings y desglose (docs/api.md)
export const EXPORTACIONES = [
  { tipo: 'rankings', titulo: 'Rankings por período', detalle: 'Fecha, ranking, posición, banco, saldo, total de cartera, ponderación y operaciones válidas.', minimo: 'publico' },
  { tipo: 'desglose', titulo: 'Desglose por subactividad', detalle: 'Saldo de cada banco por subactividad, con la reclasificación SB21 de Tarjeta.', minimo: 'publico' },
  { tipo: 'calidad', titulo: 'Reporte de calidad (E1–E4)', detalle: 'Conteos en cascada y universo local válido de cada período.', minimo: 'analista' },
  { tipo: 'movimientos', titulo: 'Movimientos de posición', detalle: 'Cambios de posición y de saldo entre períodos consecutivos, con la regla de significancia.', minimo: 'analista' },
  { tipo: 'excluidas', titulo: 'Filas excluidas', detalle: 'Lista trazable de cada fila excluida y el filtro que la excluyó.', minimo: 'analista' },
];

// Matriz de capacidades para la página «Perfiles y permisos»
export const CAPACIDADES = [
  { texto: 'Consultar el panel principal y los rankings', minimo: 'publico' },
  { texto: 'Aplicar filtros (período, banco, ranking, subactividad)', minimo: 'publico' },
  { texto: 'Ver gráficos y tablas ordenables', minimo: 'publico' },
  { texto: 'Ver la metodología y el diagrama de datos', minimo: 'publico' },
  { texto: 'Descargar rankings y desglose (CSV)', minimo: 'publico' },
  { texto: 'Comparar entidades y períodos', minimo: 'analista' },
  { texto: 'Ver la calidad de datos y las filas excluidas', minimo: 'analista' },
  { texto: 'Generar reportes personalizados (PDF y CSV)', minimo: 'analista' },
  { texto: 'Descargar calidad, movimientos y excluidas (CSV)', minimo: 'analista' },
  { texto: 'Consultar al asistente IA (explica; nunca calcula)', minimo: 'publico' },
  { texto: 'Cargar o quitar un período (AT03)', minimo: 'administrador' },
  { texto: 'Administrar parámetros (regla de movimiento significativo)', minimo: 'administrador' },
  { texto: 'Consultar los catálogos de referencia', minimo: 'administrador' },
  { texto: 'Ver perfiles y permisos', minimo: 'administrador' },
  { texto: 'Consultar el registro de operaciones', minimo: 'administrador' },
];
