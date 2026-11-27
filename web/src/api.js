// Cliente del servidor (contrato en docs/api.md).
// - Lecturas: GET con la cookie de sesión.
// - Escrituras: llevan la cabecera X-Syntropy: 1 (protección contra peticiones desde otros sitios).
// - Errores: el servidor responde { error: "mensaje en español" }; aquí se convierte en ErrorApi.

const BASE = '/api';

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.estado = estado;
  }
}

const MENSAJES = {
  401: 'Necesitas iniciar sesión para ver esto.',
  403: 'Tu perfil no tiene permiso para esta acción.',
  404: 'No se encontró lo que buscas.',
  413: 'El archivo es demasiado grande.',
  500: 'El servidor tuvo un problema. Intenta de nuevo.',
};

function consulta(parametros) {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(parametros || {})) {
    if (valor !== undefined && valor !== null && valor !== '') q.set(clave, valor);
  }
  const texto = q.toString();
  return texto ? `?${texto}` : '';
}

async function solicitar(ruta, { metodo = 'GET', cuerpo } = {}) {
  const opciones = { method: metodo, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (metodo !== 'GET') opciones.headers['X-Syntropy'] = '1';
  if (cuerpo !== undefined) {
    opciones.headers['Content-Type'] = 'application/json';
    opciones.body = JSON.stringify(cuerpo);
  }
  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, opciones);
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor. Revisa que esté en marcha.', 0);
  }
  const esJson = (respuesta.headers.get('content-type') || '').includes('application/json');
  const datos = esJson ? await respuesta.json().catch(() => null) : null;
  if (!respuesta.ok) {
    throw new ErrorApi(datos?.error || MENSAJES[respuesta.status] || `Error ${respuesta.status}`, respuesta.status);
  }
  return datos;
}

// Subida con barra de progreso (fetch no informa el avance de la subida; XMLHttpRequest sí).
function subirArchivo(ruta, archivo, alProgreso) {
  return new Promise((resolver, rechazar) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', BASE + ruta);
    xhr.setRequestHeader('X-Syntropy', '1');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && alProgreso) alProgreso(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let datos = null;
      try { datos = JSON.parse(xhr.responseText); } catch { /* sin JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolver(datos);
      else rechazar(new ErrorApi(datos?.error || MENSAJES[xhr.status] || `Error ${xhr.status}`, xhr.status));
    };
    xhr.onerror = () => rechazar(new ErrorApi('No se pudo conectar con el servidor.', 0));
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    xhr.send(formulario);
  });
}

export const api = {
  // Sesión y perfiles
  sesion: () => solicitar('/sesion'),
  iniciarSesion: (usuario, clave) => solicitar('/sesion', { metodo: 'POST', cuerpo: { usuario, clave } }),
  cerrarSesion: () => solicitar('/sesion', { metodo: 'DELETE' }),

  // Consulta
  meta: () => solicitar('/meta'),
  panel: (fecha, comparar) => solicitar(`/panel${consulta({ fecha, comparar })}`),
  rankings: (fecha, ranking, comparar) => solicitar(`/rankings${consulta({ fecha, ranking, comparar })}`),
  matriz: (fecha) => solicitar(`/matriz${consulta({ fecha })}`),
  historia: (ranking) => solicitar(`/historia${consulta({ ranking })}`),
  desglose: (fecha, ranking, banco) => solicitar(`/desglose${consulta({ fecha, ranking, banco })}`),
  movimientos: ({ desde, hasta, ranking }) => solicitar(`/movimientos${consulta({ desde, hasta, ranking })}`),
  calidad: (fecha) => solicitar(`/calidad${consulta({ fecha })}`),
  excluidas: ({ fecha, filtro, pagina }) => solicitar(`/excluidas${consulta({ fecha, filtro, pagina })}`),

  // Administración
  cargarPeriodo: (archivo, alProgreso) => subirArchivo('/periodos', archivo, alProgreso),
  quitarPeriodo: (fecha) => solicitar(`/periodos/${encodeURIComponent(fecha)}`, { metodo: 'DELETE' }),
  parametros: () => solicitar('/parametros'),
  guardarParametros: (parametros) => solicitar('/parametros', { metodo: 'PUT', cuerpo: parametros }),
  catalogos: () => solicitar('/catalogos'),
  registro: () => solicitar('/registro'),

  // Asistente IA (solo explica resultados ya calculados)
  preguntarIA: (pregunta, fecha) => solicitar('/ia', { metodo: 'POST', cuerpo: { pregunta, fecha } }),
};

// Enlace de descarga directa de un CSV (sin fecha = todos los períodos).
export function urlExportar(tipo, fecha) {
  return `${BASE}/exportar/${tipo}.csv${consulta({ fecha })}`;
}
