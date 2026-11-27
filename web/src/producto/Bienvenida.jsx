// Primera pantalla del modo producto: elegir usuario (y escribir la contraseña) o crear una cuenta.
// Si la cuenta tiene verificación en 2 pasos, se pide el código antes de entrar.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import { PERFILES } from '../permisos.js';
import CodigoSeis, { AvisoCodigoDemo } from './CodigoSeis.jsx';
import './producto.css';

const iniciales = (nombre) => String(nombre || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export function reglasClave(clave, usuario) {
  return [
    { texto: '12 caracteres o más', ok: clave.length >= 12 },
    { texto: 'Letras y números', ok: /[a-zA-Z]/.test(clave) && /\d/.test(clave) },
    { texto: 'Distinta de tu usuario', ok: clave.length > 0 && !clave.toLowerCase().includes(String(usuario || '').toLowerCase() || '\u0000') },
  ];
}

function fuerza(clave) {
  let p = 0;
  if (clave.length >= 12) p++;
  if (clave.length >= 16) p++;
  if (/[a-z]/.test(clave) && /[A-Z]/.test(clave)) p++;
  if (/\d/.test(clave)) p++;
  if (/[^A-Za-z0-9]/.test(clave)) p++;
  return Math.min(4, p);
}
const NIVELES = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'];

export default function Bienvenida() {
  const { setSesion } = useApp();
  const [cuentas, setCuentas] = useState(null);
  const [vista, setVista] = useState('inicio'); // inicio · clave · crear · codigo
  const [elegida, setElegida] = useState(null);
  const [clave, setClave] = useState('');
  const [nuevo, setNuevo] = useState({ nombre: '', usuario: '', clave: '' });
  const [desafio, setDesafio] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { api.cuentas().then(setCuentas).catch(() => setCuentas([])); }, []);

  const primera = cuentas && cuentas.length === 0;

  async function entrar(usuario, contrasena) {
    const r = await api.iniciarSesion(usuario, contrasena);
    if (r.paso === 'dos_pasos') {
      setDesafio(r);
      setCodigo('');
      setVista('codigo');
      return;
    }
    setSesion(r);
  }

  async function enviarClave(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try { await entrar(elegida.usuario, clave); } catch (err) {
      setError(err.estado === 401 ? 'La contraseña no coincide. Inténtalo de nuevo.' : err.message);
    } finally { setEnviando(false); }
  }

  async function crear(e) {
    e.preventDefault();
    setError('');
    if (!reglasClave(nuevo.clave, nuevo.usuario).every((r) => r.ok)) { setError('La contraseña todavía no cumple las reglas.'); return; }
    setEnviando(true);
    try {
      await api.crearCuenta(nuevo.usuario.trim().toLowerCase(), nuevo.nombre.trim(), nuevo.clave);
      await entrar(nuevo.usuario.trim().toLowerCase(), nuevo.clave);
    } catch (err) {
      setError(err.message);
    } finally { setEnviando(false); }
  }

  async function verificar(e) {
    e?.preventDefault();
    if (codigo.length !== 6) return;
    setError('');
    setEnviando(true);
    try {
      setSesion(await api.dosPasos(desafio.desafio, codigo));
    } catch (err) {
      setError(err.message || 'El código no es correcto.');
      setCodigo('');
    } finally { setEnviando(false); }
  }

  useEffect(() => { if (vista === 'codigo' && codigo.length === 6) verificar(); }, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps

  const fz = fuerza(nuevo.clave);

  return (
    <div className="pr-pantalla">
      <div className="pr-fondo" aria-hidden="true" />
      <main className="pr-centro">
        <div className="pr-marca">
          <span className="pr-logo" aria-hidden="true">✦</span>
          <span>SYNTROPY</span>
        </div>
        <h1 className="pr-titulo">Bienvenida al Observatorio de Crédito</h1>
        <p className="pr-lema">Del caos de datos al orden de las decisiones.</p>

        {vista === 'inicio' && (
          <div className="pr-tarjeta pr-aparece">
            {cuentas === null && <p className="pr-nota">Cargando…</p>}
            {primera && (
              <div className="pr-primera">
                <strong>Eres la primera persona aquí.</strong>
                <span>Serás la administradora de este espacio: podrás cargar los cortes e invitar a tu equipo.</span>
              </div>
            )}
            {cuentas?.length > 0 && (
              <>
                <h2 className="pr-subtitulo">Elige tu usuario</h2>
                <div className="pr-usuarios">
                  {cuentas.map((c) => (
                    <button key={c.usuario} type="button" className="pr-usuario" onClick={() => { setElegida(c); setClave(''); setError(''); setVista('clave'); }}>
                      <span className="pr-avatar">{iniciales(c.nombre || c.usuario)}</span>
                      <strong>{c.nombre || c.usuario}</strong>
                      <span className="pr-nota">@{c.usuario} · {PERFILES[c.perfil]?.nombre || c.perfil}{c.dos_pasos ? ' · 🔒 2 pasos' : ''}</span>
                    </button>
                  ))}
                </div>
                <div className="pr-separador"><span>o</span></div>
              </>
            )}
            <button type="button" className={`boton ${primera ? 'boton-primario' : 'boton-secundario'} boton-ancho pr-boton-grande`} onClick={() => { setError(''); setVista('crear'); }}>
              Crear una cuenta
            </button>
          </div>
        )}

        {vista === 'clave' && elegida && (
          <form className="pr-tarjeta pr-aparece" onSubmit={enviarClave}>
            <div className="pr-quien">
              <span className="pr-avatar pr-avatar-grande">{iniciales(elegida.nombre || elegida.usuario)}</span>
              <div><strong>{elegida.nombre || elegida.usuario}</strong><span className="pr-nota">@{elegida.usuario}</span></div>
            </div>
            <label className="campo">
              <span>Contraseña</span>
              <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" autoFocus required />
            </label>
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            <button className="boton boton-primario boton-ancho pr-boton-grande" type="submit" disabled={enviando || !clave}>{enviando ? 'Verificando…' : 'Entrar'}</button>
            <button type="button" className="enlace-boton pr-volver" onClick={() => setVista('inicio')}>← Elegir otro usuario</button>
          </form>
        )}

        {vista === 'crear' && (
          <form className="pr-tarjeta pr-aparece" onSubmit={crear}>
            <h2 className="pr-subtitulo">Crea tu cuenta</h2>
            {primera && <p className="pr-nota">Serás la administradora de este espacio.</p>}
            <label className="campo">
              <span>Tu nombre</span>
              <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} autoComplete="name" placeholder="Ej.: María Pérez" autoFocus required />
            </label>
            <label className="campo">
              <span>Usuario</span>
              <input value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 24) })}
                autoComplete="username" autoCapitalize="none" placeholder="ej.: mperez" required minLength={3} />
              <small className="pr-nota">De 3 a 24 letras, números o guion.</small>
            </label>
            <label className="campo">
              <span>Contraseña</span>
              <input type="password" value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} autoComplete="new-password" required />
            </label>
            {nuevo.clave && (
              <div className="pr-fuerza" aria-live="polite">
                <div className="pr-fuerza-barra"><span className={`nivel-${fz}`} style={{ width: `${(fz + 1) * 20}%` }} /></div>
                <span>{NIVELES[fz]}</span>
              </div>
            )}
            <ul className="pr-reglas">
              {reglasClave(nuevo.clave, nuevo.usuario).map((r) => (
                <li key={r.texto} className={r.ok ? 'ok' : ''}><span aria-hidden="true">{r.ok ? '✓' : '○'}</span>{r.texto}</li>
              ))}
            </ul>
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            <button className="boton boton-primario boton-ancho pr-boton-grande" type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear cuenta y entrar'}</button>
            {!primera && <button type="button" className="enlace-boton pr-volver" onClick={() => setVista('inicio')}>← Volver</button>}
          </form>
        )}

        {vista === 'codigo' && desafio && (
          <form className="pr-tarjeta pr-aparece" onSubmit={verificar}>
            <span className="pr-icono-grande" aria-hidden="true">🔒</span>
            <h2 className="pr-subtitulo">Verificación en 2 pasos</h2>
            <p className="pr-nota">Escribe el código de 6 dígitos de tu app autenticadora.</p>
            <AvisoCodigoDemo codigo={desafio.codigo_demo} />
            <CodigoSeis valor={codigo} alCambiar={setCodigo} deshabilitado={enviando} />
            {error && <p className="mensaje-error" role="alert">{error}</p>}
            <button className="boton boton-primario boton-ancho pr-boton-grande" type="submit" disabled={enviando || codigo.length !== 6}>{enviando ? 'Verificando…' : 'Verificar'}</button>
            <button type="button" className="enlace-boton pr-volver" onClick={() => setVista('inicio')}>← Cancelar</button>
          </form>
        )}

        <p className="pr-pie">Datos de demostración · Uso informativo; no constituye opinión formal de la SBP.</p>
      </main>
    </div>
  );
}
