import { useState } from 'react';
// Cabecera: marca, selector de período (global) y perfil con inicio/cierre de sesión.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import { PERFILES, SECCIONES, puede } from '../permisos.js';
import { fechaCorte } from '../formato.js';

export function Marca() {
  return (
    <span className="marca" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="34" height="34">
        <defs>
          <linearGradient id="marca-degradado" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0e7c86" /><stop offset="1" stopColor="#5b4bdb" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#marca-degradado)" />
        <g fill="#ffffff"><circle cx="16" cy="44" r="4" /><circle cx="28" cy="36" r="4" /><circle cx="40" cy="28" r="4" /><circle cx="52" cy="20" r="4" /></g>
        <g fill="#ffffff" opacity=".45"><circle cx="14" cy="18" r="2.5" /><circle cx="25" cy="13" r="2" /><circle cx="48" cy="46" r="2.5" /></g>
      </svg>
    </span>
  );
}

export default function Cabecera({ alAbrirMenu, menuAbierto }) {
  const { meta, fecha, setFecha, sesion, setSesion, abrirSesion, paso, setPaso } = useApp();
  const navegar = useNavigate();
  const ubicacion = useLocation();

  async function salir() {
    try { await api.cerrarSesion(); } catch { /* aunque falle, el navegador vuelve a Público */ }
    setSesion({ perfil: 'publico', usuario: null });
    // Si la página actual ya no está permitida, volvemos al panel
    const actual = SECCIONES.find((s) => s.ruta === ubicacion.pathname);
    if (actual && !puede('publico', actual.minimo)) navegar('/');
  }

  const perfil = PERFILES[sesion.perfil] || PERFILES.publico;

  return (
    <header className="cabecera">
      <button
        type="button" className="boton-menu" onClick={alAbrirMenu}
        aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuAbierto}
      >
        <span /><span /><span />
      </button>
      <Link to="/" className="cabecera-marca" aria-label="Ir al panel principal">
        <Marca />
        <span className="cabecera-textos">
          <strong className="marca-texto">SYNTROPY</strong>
          <span>Observatorio de Crédito Bancario</span>
        </span>
      </Link>

      <EstadoDemo />
      <div className="cabecera-derecha">
        <button type="button" className="boton-cabecera boton-guia" onClick={() => setPaso(paso === null ? 0 : null)} aria-pressed={paso !== null}>
          <span aria-hidden="true">▶</span><span className="texto-largo"> Presentación guiada</span>
        </button>
        {meta?.periodos?.length > 0 && (
          <label className="selector-periodo">
            <span>Período</span>
            <select value={fecha || ''} onChange={(e) => setFecha(e.target.value)} aria-label="Período de los datos">
              {meta.periodos.map((p) => (
                <option key={p.fecha} value={p.fecha}>
                  {p.etiqueta} · corte {fechaCorte(p.fecha)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="perfil">
          <span className={`chip-perfil chip-${sesion.perfil}`} title={`Perfil: ${perfil.nombre}`}>
            <span className="chip-punto" aria-hidden="true" />
            {perfil.nombre}
            {sesion.usuario && <span className="chip-usuario">· {sesion.usuario}</span>}
          </span>
          {sesion.perfil === 'publico' ? (
            <button type="button" className="boton boton-primario boton-chico" onClick={abrirSesion}>Iniciar sesión</button>
          ) : (
            <button type="button" className="boton boton-secundario boton-chico" onClick={salir}>Salir</button>
          )}
        </div>
      </div>
    </header>
  );
}

// Estado «datos ficticios» (lámina 9): pequeño pero siempre visible; al pasar el ratón o tocarlo explica.
function EstadoDemo() {
  const { meta, fecha } = useApp();
  const [abierto, setAbierto] = useState(false);
  const periodo = meta?.periodos?.find((p) => p.fecha === fecha);
  return (
    <div className="estado-demo" onMouseEnter={() => setAbierto(true)} onMouseLeave={() => setAbierto(false)}>
      <button type="button" className="estado-demo-boton" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span className="estado-demo-punto" aria-hidden="true" />Datos ficticios
        {periodo && <span className="estado-demo-periodo"> · {periodo.corta}</span>}
      </button>
      {abierto && (
        <div className="estado-demo-globo" role="note">
          <strong>Modo demostración</strong>
          <p>{meta?.aviso || 'Datos 100 % ficticios con fines de demostración.'}</p>
          <dl>
            <dt>Fuente</dt><dd>{meta?.fuente || 'Paquete Hackathon SBP 2026 · AT03 sintético'}</dd>
            <dt>Período</dt><dd>{periodo ? `${periodo.etiqueta} (corte ${periodo.fecha.slice(6)}/${periodo.fecha.slice(4, 6)}/${periodo.fecha.slice(0, 4)})` : '—'}</dd>
          </dl>
          <p className="estado-demo-nota">Uso informativo; no constituye opinión formal de la SBP.</p>
        </div>
      )}
    </div>
  );
}
