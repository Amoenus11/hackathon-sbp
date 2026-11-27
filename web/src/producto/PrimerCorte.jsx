// Espacio vacío (modo producto, sin períodos): guía para cargar el primer corte en CSV o Excel.
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import { puede } from '../permisos.js';
import { entero, etiquetaPeriodo } from '../formato.js';
import { Bitacora, ErrorCarga } from './Bitacora.jsx';
import './producto.css';

export const ACEPTA = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const esArchivoValido = (f) => /\.(csv|xlsx)$/i.test(f?.name || '');

export default function PrimerCorte() {
  const { meta, sesion, recargarMeta, setFecha } = useApp();
  const navegar = useNavigate();
  const [archivo, setArchivo] = useState(null);
  const [encima, setEncima] = useState(false);
  const [progreso, setProgreso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const entrada = useRef(null);
  const admin = puede(sesion.perfil, 'administrador');

  function elegir(f) {
    setError(null);
    if (!f) return;
    if (!esArchivoValido(f)) { setError(Object.assign(new Error('Sube el AT03 como CSV (.csv) o Excel (.xlsx).'), { datos: null })); return; }
    setArchivo(f);
  }

  async function procesar() {
    if (!archivo) return;
    setError(null);
    setProgreso(0);
    try {
      const r = await api.cargarPeriodo(archivo, setProgreso);
      setResultado(r);
      setArchivo(null);
    } catch (e) {
      setError(e);
    } finally {
      setProgreso(null);
    }
  }

  async function verPanel() {
    const m = await recargarMeta();
    const ultimo = resultado?.procesados?.at(-1)?.fecha;
    if (m && ultimo) setFecha(ultimo);
    navegar('/');
  }

  const procesando = progreso !== null;

  if (resultado) {
    return (
      <div className="pr-vacio pr-aparece">
        <span className="pr-check-animado" aria-hidden="true">✓</span>
        <h1 className="pr-titulo pr-titulo-chico">Tu primer corte está listo</h1>
        <p className="pr-texto">
          {resultado.procesados?.map((p) => `${etiquetaPeriodo(p.fecha, meta)}: ${entero(p.filas_leidas)} filas leídas → ${entero(p.universo)} préstamos válidos`).join(' · ')}
          {resultado.milisegundos != null ? ` · calculado en ${(resultado.milisegundos / 1000).toFixed(1)} s` : ''}
        </p>
        <Bitacora conversion={resultado.conversion} />
        <button type="button" className="boton boton-primario pr-boton-grande" onClick={verPanel}>Ver mi panel →</button>
      </div>
    );
  }

  return (
    <div className="pr-vacio pr-aparece">
      <p className="pr-antetitulo">Bienvenida{sesion.usuario ? `, ${sesion.usuario}` : ''}</p>
      <h1 className="pr-titulo">Tu observatorio está listo.<br />Falta tu primer corte.</h1>
      <ol className="pr-tres-pasos">
        <li><span className="pr-paso-num">1</span><strong>Exporta tu AT03</strong><span>En CSV o Excel (.xlsx), con las 61 columnas del diccionario.</span></li>
        <li><span className="pr-paso-num">2</span><strong>Súbelo aquí</strong><span>Lo validamos y calculamos los 6 rankings en segundos.</span></li>
        <li><span className="pr-paso-num">3</span><strong>Revisa la bitácora</strong><span>Te contamos qué corregimos (ceros, fechas, decimales) y qué revisar.</span></li>
      </ol>
      {admin ? (
        <>
          <div
            className={`pr-soltar ${encima ? 'encima' : ''} ${procesando ? 'ocupada' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
            onDragLeave={() => setEncima(false)}
            onDrop={(e) => { e.preventDefault(); setEncima(false); elegir(e.dataTransfer.files?.[0]); }}
            onClick={() => !procesando && entrada.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); entrada.current?.click(); } }}
            role="button" tabIndex={0} aria-label="Elegir o soltar el archivo AT03 en CSV o Excel"
          >
            <input ref={entrada} type="file" accept={ACEPTA} className="oculto" onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ''; }} />
            <span className="pr-soltar-icono" aria-hidden="true">⇪</span>
            {archivo ? (
              <p><strong>{archivo.name}</strong><br /><span className="pr-nota">{(archivo.size / 1024 / 1024).toFixed(1)} MB · listo</span></p>
            ) : (
              <p><strong>Suelta aquí tu archivo</strong><br /><span className="pr-nota">o haz clic para elegirlo · CSV o Excel (.xlsx)</span></p>
            )}
          </div>
          {procesando && (
            <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progreso}>
              <div className="progreso-barra" style={{ width: `${progreso}%` }} />
              <span>{progreso < 100 ? `Subiendo… ${progreso} %` : 'Convirtiendo, validando y calculando los rankings…'}</span>
            </div>
          )}
          <ErrorCarga error={error} />
          <button type="button" className="boton boton-primario pr-boton-grande" onClick={procesar} disabled={!archivo || procesando}>
            {procesando ? 'Procesando…' : 'Cargar mi primer corte'}
          </button>
        </>
      ) : (
        <p className="pr-aviso-demo">Pide a tu administradora que cargue el primer corte. En cuanto esté, aquí verás los rankings.</p>
      )}
    </div>
  );
}
