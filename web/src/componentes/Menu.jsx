// Menú lateral: solo muestra las secciones que el perfil actual puede usar.
import { NavLink } from 'react-router-dom';
import { useApp } from '../contexto.jsx';
import { PERFILES, seccionesDe } from '../permisos.js';

export default function Menu({ abierto, alCerrar }) {
  const { sesion, abrirSesion } = useApp();
  const secciones = seccionesDe(sesion.perfil);
  const grupos = [...new Set(secciones.map((s) => s.grupo))];

  return (
    <>
      <nav className={`menu ${abierto ? 'menu-abierto' : ''}`} aria-label="Secciones">
        {grupos.map((g) => (
          <div className="menu-grupo" key={g}>
            <p className="menu-titulo">{g}</p>
            <ul>
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
