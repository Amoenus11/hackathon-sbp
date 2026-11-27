// «Preparar publicación»: los controles de la Sección 12 en verde o rojo, y la firma de quien publica.
// El botón que le quita el miedo a publicar una cifra equivocada.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, urlExportar } from '../api.js';
import { useApp, useDatos } from '../contexto.jsx';
import { Carga } from '../componentes/Estados.jsx';
import { etiquetaPeriodo, fechaHora } from '../formato.js';
import './publicar.css';

export default function Publicar() {
  const { meta, fecha } = useApp();
  const estado = useDatos(() => (fecha ? api.controles(fecha) : null), [fecha]);
  const periodo = etiquetaPeriodo(fecha, meta);
  return (
    <div className="pub">
      <header className="pub-cabecera">
        <h1>¿Listo para publicar {periodo}?</h1>
        <p className="pub-subtitulo">El botón que le quita el miedo a publicar una cifra equivocada.</p>
      </header>
      <Carga estado={estado} filas={8}>
        {(d) => <Contenido d={d} recargar={estado.recargar} />}
      </Carga>
    </div>
  );
}

function Contenido({ d, recargar }) {
  const total = d.controles.length;
  const bien = d.controles.filter((c) => c.ok).length;
  const [firma, setFirma] = useState(null);
  return (
    <>
      <section className={`pub-indicador ${d.ok ? 'pub-ok' : 'pub-mal'}`} aria-live="polite">
        <span className="pub-indicador-cifra">{bien} de {total}</span>
        <span className="pub-indicador-texto">
          {d.ok ? 'controles ✓ · Listo para publicar' : `controles · ${total - bien} en rojo: no publicar todavía`}
        </span>
      </section>

      <ol className="pub-lista">
        {d.controles.map((c, i) => (
          <li key={c.id} className="pub-control" style={{ animationDelay: `${i * 90}ms` }}>
            <span className={`pub-circulo ${c.ok ? 'pub-circulo-ok' : 'pub-circulo-mal'}`} aria-label={c.ok ? 'Cumple' : 'No cumple'}>
              {c.ok ? '✓' : '✗'}
            </span>
            <div className="pub-control-texto">
              <span>{c.texto}</span>
              {c.detalle && <small>{c.detalle}</small>}
            </div>
          </li>
        ))}
      </ol>

      {d.ok && (firma ? <Sello firma={firma} fecha={d.fecha} /> : <FormularioFirma fecha={d.fecha} alFirmar={(f) => { setFirma(f); recargar(); }} />)}

      <section className="pub-historial">
        <h2>Firmas de este período</h2>
        {d.firmas.length === 0 ? (
          <p className="pub-vacio">Aún nadie ha firmado la publicación de este período.</p>
        ) : (
          <ul>
            {d.firmas.map((f) => (
              <li key={f.cuando}>
                <strong>{f.nombre}</strong> <span>({f.usuario})</span> · {fechaHora(f.cuando)} · {f.controles} controles ✓
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function FormularioFirma({ fecha, alFirmar }) {
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      alFirmar(await api.firmar(fecha, nombre));
    } catch (x) {
      setError(x.message);
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form className="pub-firma" onSubmit={enviar}>
      <label htmlFor="pub-nombre">Tu nombre</label>
      <div className="pub-firma-fila">
        <input id="pub-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de quien publica" maxLength={80} required />
        <button type="submit" className="boton boton-primario" disabled={enviando || !nombre.trim()}>
          {enviando ? 'Firmando…' : 'Firmar y registrar'}
        </button>
      </div>
      {error && <p className="mensaje-error">{error}</p>}
      <p className="pub-nota">La firma queda en el registro de operaciones con la fecha y la hora.</p>
    </form>
  );
}

function Sello({ firma, fecha }) {
  return (
    <section className="pub-sello">
      <div className="pub-sello-marca" aria-hidden="true">✓</div>
      <div>
        <strong>Verificado y firmado por {firma.nombre}</strong>
        <span>{fechaHora(firma.cuando)} (hora de Panamá) · {firma.controles} de {firma.controles} controles ✓</span>
        <div className="pub-enlaces">
          <Link className="boton boton-primario boton-chico" to="/reportes">Descargar reporte (PDF)</Link>
          <a className="boton boton-secundario boton-chico" href={urlExportar('rankings', fecha)} download>Rankings (CSV)</a>
          <a className="boton boton-secundario boton-chico" href={urlExportar('desglose', fecha)} download>Desglose (CSV)</a>
          <a className="boton boton-secundario boton-chico" href={urlExportar('calidad', fecha)} download>Calidad (CSV)</a>
        </div>
      </div>
    </section>
  );
}
