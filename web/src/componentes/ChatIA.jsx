// Mini chat flotante con la IA: sabe en qué pantalla estás (y qué ranking o banco miras) y responde desde ahí.
// La IA explica cifras ya calculadas; nunca calcula rankings.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import { SECCIONES } from '../permisos.js';
import TextoIA from './TextoIA.jsx';

const SUGERENCIAS = {
  '/': ['¿Qué fue lo más importante de este mes?', '¿Quién cambió de líder y por qué?'],
  '/rankings': ['¿Por qué cambió el líder de este ranking?', '¿Qué banco creció más aquí?'],
  '/metodologia': ['Explícame la regla SB21 en simple', '¿Por qué se excluyen filas?'],
  '/comparar': ['Resume los movimientos más importantes', '¿Quién prestó más pero bajó?'],
  '/calidad': ['¿Qué banco tiene más filas observadas?', '¿Qué significa la reconciliación R4?'],
};

export default function ChatIA() {
  const { fecha } = useApp();
  const ubicacion = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const fin = useRef(null);
  const seccion = SECCIONES.find((s) => s.ruta === ubicacion.pathname);
  const params = new URLSearchParams(ubicacion.search);

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [mensajes, pensando]);

  async function preguntar(pregunta) {
    const t = pregunta.trim();
    if (!t || pensando) return;
    setMensajes((m) => [...m, { de: 'yo', texto: t }]);
    setTexto('');
    setPensando(true);
    const pantalla = {
      ruta: ubicacion.pathname, titulo: seccion?.titulo || 'Observatorio',
      ranking: params.get('ranking') || '', filtros: ubicacion.search.slice(1),
    };
    try {
      const r = await api.preguntarIA(t, fecha, pantalla);
      setMensajes((m) => [...m, { de: 'ia', texto: r.respuesta }]);
    } catch (e) {
      setMensajes((m) => [...m, { de: 'ia', texto: e.message, error: true }]);
    } finally {
      setPensando(false);
    }
  }

  if (ubicacion.pathname === '/pitch' || ubicacion.pathname === '/asistente') return null;
  const sugerencias = SUGERENCIAS[ubicacion.pathname] || ['¿Qué estoy viendo en esta pantalla?'];
  return (
    <>
      {abierto && (
        <section className="chat-ia" aria-label="Asistente IA">
          <header className="chat-ia-cabecera">
            <div>
              <strong>✦ Pregúntale a la IA</strong>
              <span>Mirando: {seccion?.titulo || 'esta pantalla'}</span>
            </div>
            <button type="button" className="boton-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar el chat">×</button>
          </header>
          <div className="chat-ia-mensajes">
            {mensajes.length === 0 && (
              <div className="chat-ia-vacio">
                <p>Pregunta en tus palabras. Respondo con las cifras oficiales de esta pantalla.</p>
                {sugerencias.map((s) => (
                  <button key={s} type="button" className="chat-ia-sugerencia" onClick={() => preguntar(s)}>{s}</button>
                ))}
              </div>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={`chat-ia-burbuja ${m.de === 'yo' ? 'yo' : 'ia'}${m.error ? ' error' : ''}`}>{m.de === 'yo' ? m.texto : <TextoIA texto={m.texto} />}</div>
            ))}
            {pensando && <p className="chat-ia-burbuja ia pensando"><span /><span /><span /></p>}
            <div ref={fin} />
          </div>
          <form className="chat-ia-formulario" onSubmit={(e) => { e.preventDefault(); preguntar(texto); }}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu pregunta…" aria-label="Tu pregunta" maxLength={1500} />
            <button type="submit" className="boton boton-primario boton-chico" disabled={pensando || !texto.trim()}>Enviar</button>
          </form>
          <p className="chat-ia-nota">La IA explica; nunca calcula los rankings.</p>
        </section>
      )}
      <button type="button" className="boton-ia-flotante" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span aria-hidden="true">✦</span> {abierto ? 'Cerrar' : 'Pregúntale a la IA'}
      </button>
    </>
  );
}
