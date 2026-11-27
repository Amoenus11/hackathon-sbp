// «Protege tu cuenta»: después de entrar por primera vez se ofrece activar la verificación en 2 pasos.
// En la demo el código se muestra en pantalla; en la versión real llegaría a una app autenticadora (TOTP).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import CodigoSeis, { AvisoCodigoDemo } from './CodigoSeis.jsx';
import './producto.css';

export default function DosPasos() {
  const { sesion, setSesion } = useApp();
  const [fase, setFase] = useState('explicar'); // explicar · codigo · listo
  const [codigoDemo, setCodigoDemo] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const continuar = () => setSesion({ ...sesion, configurar_dos_pasos: false });

  async function activar() {
    setError('');
    setEnviando(true);
    try {
      const r = await api.configurarDosPasos();
      setCodigoDemo(r.codigo_demo);
      setFase('codigo');
    } catch (e) { setError(e.message); } finally { setEnviando(false); }
  }

  async function confirmar(e) {
    e?.preventDefault();
    if (codigo.length !== 6) return;
    setError('');
    setEnviando(true);
    try {
      await api.confirmarDosPasos(codigo);
      setFase('listo');
      setTimeout(continuar, 1800);
    } catch (err) {
      setError(err.message || 'El código no es correcto.');
      setCodigo('');
    } finally { setEnviando(false); }
  }

  async function ahoraNo() {
    try { await api.omitirDosPasos(); } catch { /* aunque falle, se puede seguir */ }
    continuar();
  }

  useEffect(() => { if (fase === 'codigo' && codigo.length === 6) confirmar(); }, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pr-pantalla">
      <div className="pr-fondo" aria-hidden="true" />
      <main className="pr-centro">
        {fase === 'explicar' && (
          <div className="pr-tarjeta pr-aparece">
            <span className="pr-icono-grande" aria-hidden="true">🛡️</span>
            <h1 className="pr-titulo pr-titulo-chico">Protege tu cuenta</h1>
            <p className="pr-texto">
              Las cifras que publicas son públicas. Con la verificación en 2 pasos, además de tu contraseña se pide un código
              de 6 dígitos que cambia cada 30 segundos. Aunque alguien conozca tu contraseña, no podrá entrar.
            </p>
            <ol className="pr-pasitos">
              <li>Instalas una app autenticadora en tu teléfono.</li>
              <li>La vinculas con tu cuenta (en la versión real, con un código QR).</li>
              <li>Al entrar, escribes el código que muestra la app.</li>
            </ol>
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            <button type="button" className="boton boton-primario boton-ancho pr-boton-grande" onClick={activar} disabled={enviando}>
              {enviando ? 'Preparando…' : 'Activar verificación en 2 pasos'}
            </button>
            <button type="button" className="enlace-boton pr-volver" onClick={ahoraNo}>Ahora no</button>
          </div>
        )}
        {fase === 'codigo' && (
          <form className="pr-tarjeta pr-aparece" onSubmit={confirmar}>
            <span className="pr-icono-grande" aria-hidden="true">🔒</span>
            <h1 className="pr-titulo pr-titulo-chico">Escribe el código</h1>
            <AvisoCodigoDemo codigo={codigoDemo} />
            <CodigoSeis valor={codigo} alCambiar={setCodigo} deshabilitado={enviando} />
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            <button className="boton boton-primario boton-ancho pr-boton-grande" type="submit" disabled={enviando || codigo.length !== 6}>
              {enviando ? 'Confirmando…' : 'Confirmar'}
            </button>
            <button type="button" className="enlace-boton pr-volver" onClick={ahoraNo}>Ahora no</button>
          </form>
        )}
        {fase === 'listo' && (
          <div className="pr-tarjeta pr-aparece pr-exito">
            <span className="pr-check-animado" aria-hidden="true">✓</span>
            <h1 className="pr-titulo pr-titulo-chico">Tu cuenta está protegida</h1>
            <p className="pr-texto">La próxima vez que entres te pediremos el código.</p>
          </div>
        )}
      </main>
    </div>
  );
}
