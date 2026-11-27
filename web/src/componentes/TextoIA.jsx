// Muestra la respuesta de la IA con formato simple y seguro (sin HTML): párrafos, viñetas, **negritas** y enlaces
// [texto](/ruta) SOLO a pantallas de esta misma plataforma (nunca a sitios externos ni a archivos).
import { Link } from 'react-router-dom';

const RUTA_INTERNA = /^\/(?!\/)[a-z0-9/_?=&-]*$/i;

function negritas(texto, clave) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) => (
    parte.startsWith('**') && parte.endsWith('**') ? <strong key={`${clave}-${i}`}>{parte.slice(2, -2)}</strong> : parte.replace(/\*([^*]+)\*/g, '$1')
  ));
}

function enLinea(texto) {
  return texto.split(/(\[[^\]]+\]\([^)\s]+\))/g).flatMap((parte, i) => {
    const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(parte);
    if (!m) return negritas(parte, i);
    return RUTA_INTERNA.test(m[2]) ? [<Link key={i} to={m[2]} className="enlace-ia">{m[1]}</Link>] : [m[1]];
  });
}

export default function TextoIA({ texto }) {
  const bloques = [];
  let lista = null;
  for (const linea of String(texto || '').split('\n')) {
    const t = linea.trim();
    const vineta = /^[-•*]\s+(.*)/.exec(t);
    if (vineta) {
      if (!lista) { lista = []; bloques.push({ tipo: 'lista', items: lista }); }
      lista.push(vineta[1]);
      continue;
    }
    lista = null;
    if (t) bloques.push({ tipo: 'p', texto: t.replace(/^#+\s*/, '') });
  }
  return (
    <div className="texto-ia">
      {bloques.map((b, i) => (b.tipo === 'lista'
        ? <ul key={i}>{b.items.map((it, k) => <li key={k}>{enLinea(it)}</li>)}</ul>
        : <p key={i}>{enLinea(b.texto)}</p>))}
    </div>
  );
}
