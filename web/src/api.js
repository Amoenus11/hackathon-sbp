// Cliente de la API (contrato docs/api.md). Toda escritura lleva la cabecera X-Syntropy: 1.
import { useCallback, useEffect, useState } from 'react';

export class ErrorApi extends Error {
  constructor(mensaje, estado, detalles = []) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles ?? [];
  }
}

export async function api(ruta, { metodo = 'GET', cuerpo, form, senal } = {}) {
  const headers = {};
  if (metodo !== 'GET') headers['X-Syntropy'] = '1';
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  let r;
  try {
    r = await fetch(`/api${ruta}`, {
      method: metodo, headers, credentials: 'same-origin', signal: senal,
      body: form ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ErrorApi('No hay conexión con el servidor. ¿Está corriendo `npm start`?', 0);
  }
  const tipo = r.headers.get('content-type') ?? '';
  const datos = tipo.includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new ErrorApi(datos?.error ?? `Error ${r.status}`, r.status, datos?.detalles);
  return datos;
}

/** Arma una query string omitiendo valores vacíos. */
export function qs(params = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const urlExportar = (tipo, params) => `/api/exportar/${tipo}${tipo.endsWith('.html') ? '' : '.csv'}${qs(params)}`;

/** Hook de lectura: { datos, error, cargando, recargar }. Vuelve a pedir cuando cambia la ruta. */
export function useApi(ruta) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: Boolean(ruta) });
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!ruta) { setEstado({ datos: null, error: null, cargando: false }); return undefined; }
    const ctl = new AbortController();
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    api(ruta, { senal: ctl.signal })
      .then((datos) => setEstado({ datos, error: null, cargando: false }))
      .catch((error) => { if (error.name !== 'AbortError') setEstado({ datos: null, error, cargando: false }); });
    return () => ctl.abort();
  }, [ruta, vuelta]);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { ...estado, recargar };
}
