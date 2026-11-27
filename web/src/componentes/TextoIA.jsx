// Muestra la respuesta de la IA con formato simple y seguro (sin HTML): párrafos, viñetas y **negritas**.
function enLinea(texto) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) => (
    parte.startsWith('**') && parte.endsWith('**') ? <strong key={i}>{parte.slice(2, -2)}</strong> : parte.replace(/\*([^*]+)\*/g, '$1')
  ));
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
