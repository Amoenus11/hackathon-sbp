// Menú lateral: solo muestra las secciones que el perfil actual puede usar.
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../contexto.jsx';
import { PERFILES, seccionesDe } from '../permisos.js';

export default function Menu({ abierto, alCerrar }) {
  const { sesion, abrirSesion } = useApp();
  const secciones = seccionesDe(sesion.perfil).filter((s) => !s.oculto);
  const grupos = [...new Set(secciones.map((s) => s.grupo))];
  const ubicacion = useLocation();
  // Grupos plegables: se recuerda la elección; el grupo de la página actual siempre se ve abierto
  const [plegados, setPlegados] = useState(() => { try { return JSON.parse(localStorage.getItem('menu-plegados') || '[]'); } catch { return []; } });
  const alternar = (g) => setPlegados((p) => { const n = p.includes(g) ? p.filter((x) => x !== g) : [...p, g]; localStorage.setItem('menu-plegados', JSON.stringify(n)); return n; });

  return (
    <>
      <nav className={`menu ${abierto ? 'menu-abierto' : ''}`} aria-label="Secciones">
        {grupos.map((g) => (
          <div className="menu-grupo" key={g}>
            {(() => {
              const actual = secciones.some((s) => s.grupo === g && s.ruta === ubicacion.pathname);
              const plegado = plegados.includes(g) && !actual;
              return (
                <button type="button" className={`menu-titulo menu-titulo-boton ${plegado ? 'plegado' : ''}`} onClick={() => alternar(g)} aria-expanded={!plegado}>
                  {g}<span className="menu-flecha" aria-hidden="true">›</span>
                </button>
              );
            })()}
            <ul className={plegados.includes(g) && !secciones.some((s) => s.grupo === g && s.ruta === ubicacion.pathname) ? 'oculto' : ''}>
              {secciones.filter((s) => s.grupo === g).map((s) => (
                <li key={s.clave}>
                  <NavLink to={s.ruta} end={s.ruta === '/'} className={({ isActive }) => `menu-enlace ${isActive ? 'activo' : ''}`}>
                    <span className="menu-icono" aria-hidden="true">{s.icono}</span>
                    {s.titulo}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <Link className="menu-github menu-pitch" to="/pitch">
          <span aria-hidden="true">▶</span> Ver el pitch (5 min)
        </Link>
        <a className="menu-github" href="https://github.com/Amoenus11/hackathon-sbp" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          Código fuente en GitHub
        </a>
        <div className="menu-perfil">
          <p>
            Perfil actual: <strong>{PERFILES[sesion.perfil]?.nombre || 'Público'}</strong>
          </p>
          {sesion.perfil === 'publico' ? (
            <p className="nota">
              Analistas y administradores ven más opciones.{' '}
              <button type="button" className="enlace-boton" onClick={abrirSesion}>Iniciar sesión</button>
            </p>
          ) : sesion.perfil === 'analista' ? (
            <p className="nota">La administración (cargar períodos, parámetros) es solo para administradores.</p>
          ) : (
            <p className="nota">Tienes acceso completo.</p>
          )}
        </div>
      </nav>
      {abierto && <button type="button" className="velo" aria-label="Cerrar menú" onClick={alCerrar} />}
    </>
  );
}
