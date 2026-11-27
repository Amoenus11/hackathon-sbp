// Cargar un nuevo corte AT03: se procesa solo, se recalculan los rankings y se detectan los movimientos.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { useApp } from '../../contexto.jsx';
import { EncabezadoPagina, Tarjeta } from '../../componentes/Comunes.jsx';
import { entero, etiquetaPeriodo, fechaCorte, fechaHora } from '../../formato.js';
import { Bitacora, ErrorCarga, HistorialCargas } from '../../producto/Bitacora.jsx';
import { ACEPTA, esArchivoValido } from '../../producto/PrimerCorte.jsx';

export default function CargarPeriodo() {
  const { meta, recargarMeta, setFecha } = useApp();
  const [archivo, setArchivo] = useState(null);
  const [encima, setEncima] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [errorCarga, setErrorCarga] = useState(null); // error de una carga, con su detalle (columnas, sugerencias)
  const [quitando, setQuitando] = useState(null);
  const entrada = useRef(null);

  function elegir(f) {
    setError('');
    setResultado(null);
    if (!f) return;
    setErrorCarga(null);
    if (!esArchivoValido(f)) { setError('El archivo debe ser el AT03 en CSV (.csv) o Excel (.xlsx), por ejemplo AT03_sintetico_202609.csv.'); return; }
    setArchivo(f);
  }

  async function procesar() {
    if (!archivo) return;
    setError('');
    setErrorCarga(null);
    setProgreso(0);
    try {
      const r = await api.cargarPeriodo(archivo, setProgreso);
      setResultado(r);
      setArchivo(null);
      const m = await recargarMeta();
      const ultimo = r?.procesados?.[r.procesados.length - 1]?.fecha;
      if (m && ultimo) setFecha(ultimo);
    } catch (e) {
      setErrorCarga(e);
    } finally {
      setProgreso(null);
    }
  }

  async function quitar(fecha) {
    if (!window.confirm(`¿Quitar el período ${etiquetaPeriodo(fecha, meta)}? Podrás volver a cargarlo después.`)) return;
    setQuitando(fecha);
    try {
      await api.quitarPeriodo(fecha);
      setResultado(null);
      await recargarMeta();
    } catch (e) {
      setError(e.message);
    } finally {
      setQuitando(null);
    }
  }

  const procesando = progreso !== null;

  return (
    <>
      <EncabezadoPagina titulo="Cargar período" subtitulo="Sube un nuevo corte AT03: se valida, se recalcula todo y se señalan los movimientos, sin tocar el código" />
      <div className="rejilla-dos">
        <Tarjeta titulo="Nuevo archivo AT03" id="subir">
          <div
            className={`zona-soltar ${encima ? 'encima' : ''} ${procesando ? 'ocupada' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
            onDragLeave={() => setEncima(false)}
            onDrop={(e) => { e.preventDefault(); setEncima(false); elegir(e.dataTransfer.files?.[0]); }}
            onClick={() => entrada.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.current?.click(); } }}
            role="button" tabIndex={0} aria-label="Elegir o soltar el archivo del período (CSV o Excel)"
          >
            <input ref={entrada} type="file" accept={ACEPTA} className="oculto" onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ''; }} />
            <span className="zona-icono" aria-hidden="true">⇪</span>
            {archivo ? (
              <p><strong>{archivo.name}</strong><br /><span className="nota">{(archivo.size / 1024 / 1024).toFixed(1)} MB · listo para procesar</span></p>
            ) : (
              <p><strong>Suelta aquí el CSV o el Excel, o haz clic para elegirlo</strong><br /><span className="nota">61 columnas del diccionario AT03 · .csv o .xlsx · lo que Excel cambie (ceros, fechas, decimales) se corrige y queda en la bitácora</span></p>
            )}
          </div>
          {procesando && (
            <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso}>
              <div className="progreso-barra" style={{ width: `${progreso}%` }} />
              <span>{progreso < 100 ? `Subiendo… ${progreso} %` : 'Procesando: validación, exclusiones E1–E4, rankings y movimientos…'}</span>
            </div>
          )}
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          <ErrorCarga error={errorCarga} />
          <button type="button" className="boton boton-primario boton-ancho" onClick={procesar} disabled={!archivo || procesando}>
            {procesando ? 'Procesando…' : 'Procesar período'}
          </button>
          <p className="nota">
            Para demostrar la automatización: quita septiembre en la lista de la derecha y vuelve a cargar <code>AT03_sintetico_202609.csv</code>.
            Si el período ya existe, se reemplaza.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Períodos cargados" subtitulo={`${meta.periodos.length} cortes`} id="periodos">
          <table className="tabla tabla-compacta">
            <thead><tr><th scope="col">Período</th><th scope="col">Archivo</th><th scope="col" className="numerica">Filas</th><th scope="col">Cargado</th><th scope="col"><span className="oculto-visual">Acciones</span></th></tr></thead>
            <tbody>
              {meta.periodos.length === 0 && <tr><td colSpan={5} className="celda-vacia">Aún no hay períodos.</td></tr>}
              {meta.periodos.map((p) => (
                <tr key={p.fecha}>
                  <td className="celda-periodo"><strong>{p.etiqueta}</strong> <span className="nota">· {fechaCorte(p.fecha)}</span></td>
                  <td className="mono">{p.archivo}</td>
                  <td className="numerica num">{entero(p.filas_leidas)}</td>
                  <td className="celda-periodo">{new Date(p.cargado).toLocaleString('es-PA', { timeZone: 'America/Panama', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td><button type="button" className="boton boton-peligro boton-chico" onClick={() => quitar(p.fecha)} disabled={quitando === p.fecha}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      </div>

      {resultado && (
        <Tarjeta titulo="Resultado de la carga" className="tarjeta-exito" id="resultado">
          <ul className="lista-simple">
            {resultado.procesados?.map((p) => (
              <li key={p.fecha}>
                <strong>{etiquetaPeriodo(p.fecha, meta)}</strong>: {entero(p.filas_leidas)} filas leídas → {entero(p.universo)} en el universo local válido.
                {resultado.reemplazo ? ' (reemplazó al período anterior con la misma fecha)' : ''}
              </li>
            ))}
          </ul>
          <p><strong>{entero(resultado.movimientos_significativos)}</strong> movimientos significativos frente al período anterior.</p>
          {resultado.explicaciones?.length > 0 && (
            <ul className="destacados">
              {resultado.explicaciones.map((t, i) => <li key={i} className="destacado"><span className="destacado-icono" aria-hidden="true">✦</span><span>{t}</span></li>)}
            </ul>
          )}
          <Bitacora conversion={resultado.conversion} />
          <div className="fila-botones">
            <Link className="boton boton-primario" to="/rankings">Ver rankings</Link>
            <Link className="boton boton-secundario" to="/comparar">Ver movimientos</Link>
            <Link className="boton boton-secundario" to="/calidad">Ver calidad de datos</Link>
          </div>
        </Tarjeta>
      )}

      <Tarjeta titulo="Historial de cargas" subtitulo="Quién cargó qué, cuándo, cuánto tardó y qué se corrigió (también las cargas fallidas)" id="historial-cargas">
        <HistorialCargas />
      </Tarjeta>
    </>
  );
}
