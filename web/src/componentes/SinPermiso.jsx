// Se muestra si alguien entra por dirección a una sección que su perfil no permite.
import { Link } from 'react-router-dom';
import { useApp } from '../contexto.jsx';
import { PERFILES } from '../permisos.js';

export default function SinPermiso({ seccion }) {
  const { sesion, abrirSesion } = useApp();
  const necesario = PERFILES[seccion.minimo]?.nombre;
  return (
    <section className="estado estado-candado" aria-live="polite">
      <div className="estado-icono" aria-hidden="true">🔒</div>
      <h1>«{seccion.titulo}» es para el perfil {necesario}</h1>
      <p>
        Tu perfil actual es <strong>{PERFILES[sesion.perfil]?.nombre}</strong>.
        {seccion.minimo === 'administrador'
          ? ' Solo un administrador puede usar esta sección.'
          : ' Inicia sesión como analista o administrador para continuar.'}
      </p>
      <div className="fila-botones">
        <button type="button" className="boton boton-primario" onClick={abrirSesion}>Iniciar sesión</button>
        <Link to="/" className="boton boton-secundario">Volver al panel</Link>
      </div>
    </section>
  );
}
