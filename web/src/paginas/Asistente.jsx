// Asistente IA (perfil analista): explica resultados ya calculados. Nunca calcula rankings.
import { useState } from 'react';
import { useApp } from '../contexto.jsx';
import { api } from '../api.js';
import { Aviso, Tarjeta } from '../componentes/Comunes.jsx';
import { mes } from '../formato.js';

const SUGERENCIAS = [
  '¿Qué bancos subieron más posiciones este mes y por qué?',
  '¿Qué banco está más especializado en hipotecas?',
  'Resume en tres puntos la situación del ranking de Construcción.',
  '¿Qué tan concentrado está el mercado de Consumo?',
];

export default function Asistente() {
  const { fecha } = useApp();
  const [pregunta, setPregunta] = useState('');
  const [historial, setHistorial] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const enviar = async (texto) => {
    const q = (texto ?? pregunta).trim();
    if (!q) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await api('/ia', { metodo: 'POST', cuerpo: { pregunta: q, fecha } });
      setHistorial((h) => [{ pregunta: q, ...r, fecha }, ...h]);
      setPregunta('');
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="titulo-pagina">
        <h1>Asistente IA</h1>
        <p>Haga preguntas en lenguaje natural sobre los resultados de {mes(fecha)}. La IA solo recibe cifras ya calculadas por el motor y las explica; no calcula ni modifica rankings.</p>
      </div>
      <Tarjeta>
        <form className="formulario" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
          <label className="campo" htmlFor="pregunta"><span>Su pregunta</span>
            <textarea id="pregunta" rows={3} maxLength={1000} value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="Ej.: ¿Por qué cambió el líder de Construcción?" />
          </label>
          <div className="chips">
            {SUGERENCIAS.map((s) => <button key={s} type="button" className="chip" onClick={() => enviar(s)} disabled={enviando}>{s}</button>)}
          </div>
          <div className="fila-botones">
            <button type="submit" className="boton" disabled={enviando || !pregunta.trim()}>{enviando ? 'Pensando…' : 'Preguntar'}</button>
          </div>
        </form>
        <Aviso error={error} />
      </Tarjeta>
      {historial.map((h, i) => (
        <Tarjeta key={historial.length - i} titulo={h.pregunta} subtitulo={`${mes(h.fecha)}${h.segundos ? ` · ${h.segundos} s` : ''}`}>
          {!h.disponible && <Aviso tipo="info">El asistente no está disponible en esta instalación.</Aviso>}
          <p className="respuesta-ia">{h.respuesta}</p>
          <p className="nota">Respuesta generada por IA a partir de resultados calculados. Verifique las cifras en Rankings. Datos ficticios.</p>
        </Tarjeta>
      ))}
    </>
  );
}
