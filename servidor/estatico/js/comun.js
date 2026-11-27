// Utilidades compartidas: llamadas a la API (con la cabecera anti-CSRF) y lectura en vivo.
export async function api(ruta, opciones = {}) {
  const o = { ...opciones, headers: { 'X-Syntropy': '1', ...(opciones.headers || {}) } };
  if (o.json !== undefined) {
    o.body = JSON.stringify(o.json);
    o.headers['Content-Type'] = 'application/json';
    delete o.json;
  }
  const r = await fetch(ruta, o);
  if (r.status === 401 && !ruta.startsWith('/api/entrar')) {
    location.href = '/';
    throw new Error('Sesión terminada');
  }
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) {
    const e = new Error((datos && (datos.error || datos.detail)) || `Error ${r.status}`);
    e.datos = datos;
    throw e;
  }
  return datos;
}

// Lee una respuesta que llega por partes (una línea JSON por evento).
export async function flujo(ruta, cuerpo, alEvento) {
  const r = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Syntropy': '1' },
    body: JSON.stringify(cuerpo),
  });
  if (!r.ok) {
    let m = `Error ${r.status}`;
    try { const d = await r.json(); m = d.error || d.detail || m; } catch { /* nada */ }
    throw new Error(m);
  }
  const lector = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const linea = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (linea) { try { alEvento(JSON.parse(linea)); } catch { /* línea rota */ } }
    }
  }
}

// Crea un elemento con clase y texto (nunca HTML: así nada de lo que escriba la IA se ejecuta).
export function el(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined && texto !== null) e.textContent = String(texto);
  return e;
}

export async function salir() {
  try { await api('/api/salir', { method: 'POST' }); } finally { location.href = '/'; }
}

// Token de los enlaces de un solo uso: viaja tras el «#», así nunca llega a los registros del servidor.
export function tokenDelEnlace() {
  const t = location.hash.slice(1);
  if (t) history.replaceState(null, '', location.pathname);
  return t;
}
