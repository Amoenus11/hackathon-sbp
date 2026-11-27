// Asistente IA: responde preguntas en lenguaje natural usando SOLO resultados ya calculados por el motor.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import { EncabezadoPagina, Tarjeta } from '../componentes/Comunes.jsx';
import { etiquetaPeriodo } from '../formato.js';

const SUGERENCIAS = [
  '¿Qué banco lidera el crédito hipotecario y con qué ventaja?',
  'Explica los movimientos de posición más importantes respecto al mes anterior.',
  '¿Qué tan concentrado está el crédito de consumo?',
  '¿Cuántos registros se excluyeron y por qué motivo?',
  '¿En qué actividad se especializa cada banco?',
];

export default function Asistente() {
  const { meta, fecha } = useApp();
  const [mensajes, setMensajes] = useState([]);
  const [pregunta, setPregunta] = useState('');
  const [pensando, setPensando] = useState(false);
  const final = useRef(null);

  useEffect(() => { final.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensajes, pensando]);

  async function preguntar(texto) {
    const t = texto.trim();
    if (!t || pensando) return;
    setPregunta('');
    setMensajes((m) => [...m, { de: 'yo', texto: t }]);
    setPensando(true);
    try {
      const r = await api.preguntarIA(t, fecha);
      setMensajes((m) => [...m, { de: 'ia', texto: r.respuesta, disponible: r.disponible, segundos: r.segundos }]);
    } catch (e) {
      setMensajes((m) => [...m, { de: 'ia', texto: e.message, error: true }]);
    } finally {
      setPensando(false);
    }
  }

  return (
    <>
      <EncabezadoPagina titulo="Asistente IA" subtitulo={`Pregunta en lenguaje natural sobre los resultados de ${etiquetaPeriodo(fecha, meta)}`} />
      <div className="aviso-ia" role="note">
        <strong>La IA explica resultados ya calculados; nunca calcula los rankings.</strong> Los números oficiales salen del motor determinista
        (mismos archivos → mismos resultados). Verifica cualquier cifra en Rankings o en Calidad de datos.
      </div>
      <Tarjeta className="tarjeta-chat" id="chat">
        <div className="chat" aria-live="polite">
          {mensajes.length === 0 && (
            <div className="chat-vacio">
              <p>Prueba con una de estas preguntas:</p>
              <div className="chips">
                {SUGERENCIAS.map((s) => <button key={s} type="button" className="chip" onClick={() => preguntar(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {mensajes.map((m, i) => (
            <div key={i} className={`burbuja burbuja-${m.de} ${m.error ? 'burbuja-error' : ''} ${m.disponible === false ? 'burbuja-aviso' : ''}`}>
              <p className="burbuja-autor">{m.de === 'yo' ? 'Tú' : 'Asistente Syntropy'}</p>
              <TextoEnriquecido texto={m.texto} />
              {m.segundos != null && <p className="burbuja-meta">Respondió en {Number(m.segundos).toFixed(1)} s</p>}
            </div>
          ))}
          {pensando && (
            <div className="burbuja burbuja-ia">
              <p className="burbuja-autor">Asistente Syntropy</p>
              <p className="burbuja-texto"><span className="puntos" aria-label="Pensando"><i /><i /><i /></span> Leyendo los resultados calculados…</p>
            </div>
          )}
          <div ref={final} />
        </div>
        <form className="chat-formulario" onSubmit={(e) => { e.preventDefault(); preguntar(pregunta); }}>
          <textarea
            value={pregunta} onChange={(e) => setPregunta(e.target.value)} rows={2} maxLength={2000}
            placeholder="Escribe tu pregunta…" aria-label="Tu pregunta"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); preguntar(pregunta); } }}
          />
          <button type="submit" className="boton boton-primario" disabled={pensando || !pregunta.trim()}>Preguntar</button>
        </form>
      </Tarjeta>
    </>
  );
}

/**
 * Muestra la respuesta del asistente con **negrita** y listas de guiones, sin interpretar HTML:
 * todo se construye con elementos de React, así que ningún texto recibido puede inyectar código.
 */
function TextoEnriquecido({ texto }) {
  const enLinea = (t, k) => String(t).split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
    .map((parte, i) => (/^\*\*[^*]+\*\*$/.test(parte) ? <strong key={`${k}-${i}`}>{parte.slice(2, -2)}</strong> : parte));
  const bloques = [];
  let lista = [];
  const cerrarLista = (k) => { if (lista.length) { bloques.push(<ul key={`ul-${k}`}>{lista}</ul>); lista = []; } };
  String(texto).split('\n').forEach((linea, k) => {
    const item = /^\s*[-•]\s+(.*)$/.exec(linea) || /^\s*\*\s+(.*)$/.exec(linea);
    if (item) { lista.push(<li key={k}>{enLinea(item[1], k)}</li>); return; }
    cerrarLista(k);
    if (linea.trim()) bloques.push(<p key={k}>{enLinea(linea, k)}</p>);
  });
  cerrarLista('fin');
  return <div className="burbuja-texto">{bloques}</div>;
}
