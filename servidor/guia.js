// Guía de la plataforma para el asistente IA: qué pantallas puede usar la persona SEGÚN SU PERFIL y cómo
// hacer lo más común (sobre todo descargar). El asistente solo recibe las pantallas de su perfil: al Público
// nunca le llegan las de análisis ni las de administración, así que no puede contarle que existen.
const ORDEN = ['publico', 'analista', 'administrador'];

const PANTALLAS = [
  { minimo: 'publico', ruta: '/', titulo: 'Panel principal', para_que: 'Lo esencial del mes: quién va ganando en cada actividad, qué tiene de distinto cada banco y qué cambió frente al mes anterior.' },
  { minimo: 'publico', ruta: '/rankings', titulo: 'Rankings', para_que: 'Los 12 bancos de cada una de las 6 actividades, con saldo, ponderación y cambio de posición. Al tocar un banco se ve su desglose por subactividad.' },
  { minimo: 'publico', ruta: '/metodologia', titulo: 'Metodología y datos', para_que: 'Cómo se calcula: reglas de exclusión E1–E4, catálogos y verificación.' },
  {
    minimo: 'publico', ruta: '/extraccion', titulo: 'Descarga a tu medida',
    para_que: 'Descargar solo los datos que necesitas, en CSV o Excel.',
    como: '1) En «Cortes» marca el mes o los meses (por ejemplo, septiembre 2026). 2) Si quieres, filtra en «Actividades económicas», «Bancos» y «Clasificación de riesgo». 3) En «Qué quieres descargar» elige «Resumen agrupado» o «Detalle por préstamo» (y sus campos). 4) Revisa la vista previa y pulsa «Descargar CSV» o «Descargar Excel». Nunca incluye datos personales de clientes.',
  },
  { minimo: 'publico', ruta: '/descargas', titulo: 'Exportaciones oficiales', para_que: 'Los archivos oficiales del reto en CSV, con todos los meses publicados.', como: 'Pulsa el botón de descarga del archivo que necesites (Rankings o Desglose).' },
  { minimo: 'publico', ruta: '/asistente', titulo: 'Asistente IA', para_que: 'Preguntas en tus palabras sobre las cifras.' },
  { minimo: 'analista', ruta: '/descargas', titulo: 'Exportaciones oficiales (completas)', para_que: 'Además de Rankings y Desglose: Calidad, Movimientos y Filas excluidas.' },
  { minimo: 'analista', ruta: '/comparar', titulo: 'Comparar', para_que: 'Dos meses lado a lado: quién sube y quién baja, el puente de cada cambio (nuevos, vencidos y pagos), «Tu lectura» (nota interna) y banco contra banco.' },
  { minimo: 'analista', ruta: '/calidad', titulo: 'Calidad de datos', para_que: 'Cuántas filas excluyó cada regla, las reconciliaciones R1–R4 y las filas excluidas.' },
  { minimo: 'analista', ruta: '/publicar', titulo: 'Preparar publicación', para_que: 'Revisar los controles del mes y firmarlo. Un mes recién cargado es borrador hasta que se firma.' },
  { minimo: 'analista', ruta: '/carta', titulo: 'Carta al banco', para_que: 'Carta con las filas excluidas de un banco para pedirle correcciones.' },
  { minimo: 'analista', ruta: '/reportes', titulo: 'Reportes', para_que: 'Armar un reporte por secciones, imprimirlo o guardarlo en PDF.' },
  { minimo: 'administrador', ruta: '/admin/cargar', titulo: 'Cargar período', para_que: 'Subir el archivo de un mes nuevo (CSV o Excel). Al terminar muestra cuántos controles pasaron.' },
  { minimo: 'administrador', ruta: '/admin/parametros', titulo: 'Parámetros', para_que: 'Reglas de qué cuenta como movimiento significativo.' },
  { minimo: 'administrador', ruta: '/admin/catalogos', titulo: 'Catálogos', para_que: 'Los catálogos oficiales en uso.' },
  { minimo: 'administrador', ruta: '/admin/perfiles', titulo: 'Perfiles y permisos', para_que: 'Las cuentas del equipo y su perfil.' },
  { minimo: 'administrador', ruta: '/admin/registro', titulo: 'Registro de operaciones', para_que: 'Quién hizo qué y cuándo.' },
];

/** Las pantallas que este perfil puede usar (solo esas se le cuentan al asistente). */
export function guiaPara(perfil) {
  const nivel = ORDEN.indexOf(perfil);
  return PANTALLAS.filter((p) => ORDEN.indexOf(p.minimo) <= nivel);
}

export const REGLAS_GUIA = [
  'Responde según «perfil»: habla SOLO de las pantallas de «guia_app». No menciones, insinúes ni enumeres otras pantallas, perfiles, roles, permisos, cuentas ni opciones de administración que no estén ahí.',
  'Si preguntan cómo hacer algo (por ejemplo, descargar datos), explica los pasos en la pantalla de «guia_app» que lo hace y da su enlace en formato Markdown con la ruta, por ejemplo [Descarga a tu medida](/extraccion).',
  'Nunca construyas, pegues ni generes archivos, tablas de datos para copiar ni enlaces de descarga propios: la descarga siempre se hace con los botones y controles de la plataforma.',
  'Nunca menciones archivos, carpetas ni rutas internas del sistema (por ejemplo, nombres .csv del motor o carpetas del servidor). Para la persona, todo está en las pantallas de la plataforma.',
];
