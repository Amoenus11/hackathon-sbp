// Ventana para iniciar sesión como Analista o Administrador.
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import { PERFILES } from '../permisos.js';

export default function ModalSesion() {
  const { setSesion, cerrarModalSesion } = useApp();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const primerCampo = useRef(null);

  useEffect(() => {
    primerCampo.current?.focus();
    const alTeclear = (e) => { if (e.key === 'Escape') cerrarModalSesion(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [cerrarModalSesion]);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const s = await api.iniciarSesion(usuario.trim(), clave);
      setSesion(s);
      cerrarModalSesion();
    } catch (err) {
      setError(err.estado === 401 ? 'Usuario o contraseña incorrectos.' : err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-fondo" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModalSesion(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-sesion">
        <div className="modal-cabecera">
          <h2 id="titulo-sesion">Iniciar sesión</h2>
          <button type="button" className="boton-cerrar" onClick={cerrarModalSesion} aria-label="Cerrar">×</button>
        </div>
        <p className="nota">
          El perfil <strong>{PERFILES.publico.nombre}</strong> no necesita cuenta. Inicia sesión para usar las opciones de{' '}
          <strong>{PERFILES.analista.nombre}</strong> o <strong>{PERFILES.administrador.nombre}</strong>.
        </p>
        <form onSubmit={enviar} className="formulario">
          <label className="campo">
            <span>Usuario</span>
            <input ref={primerCampo} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" autoCapitalize="none" required />
          </label>
          <label className="campo">
            <span>Contraseña</span>
            <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          <button className="boton boton-primario boton-ancho" type="submit" disabled={enviando}>
            {enviando ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
        <p className="nota nota-pequena">Las cuentas se crean al instalar la aplicación; no hay contraseñas guardadas en el repositorio.</p>
      </div>
    </div>
  );
}
