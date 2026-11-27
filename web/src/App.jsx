// Estructura: cabecera (período, perfil), aviso de datos ficticios, navegación por perfil y páginas.
import { useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useApp } from './contexto.jsx';
import { Aviso, Cargando, SinPermiso } from './componentes/Comunes.jsx';
import { mes, fechaHora } from './formato.js';
import Panel from './paginas/Panel.jsx';
import Rankings from './paginas/Rankings.jsx';
import Comparar from './paginas/Comparar.jsx';
import Calidad from './paginas/Calidad.jsx';
import Reportes from './paginas/Reportes.jsx';
import Descargas from './paginas/Descargas.jsx';
import Metodologia from './paginas/Metodologia.jsx';
import Asistente from './paginas/Asistente.jsx';
import Administracion from './paginas/Administracion.jsx';

const MODULOS = [
  { ruta: '/', modulo: 'panel', texto: 'Panel principal', icono: '◧' },
  { ruta: '/rankings', modulo: 'rankings', texto: 'Rankings', icono: '☰' },
  { ruta: '/comparar', modulo: 'comparar', texto: 'Comparar', icono: '⇄', perfil: 'analista' },
  { ruta: '/calidad', modulo: 'calidad', texto: 'Calidad de datos', icono: '✓', perfil: 'analista' },
  { ruta: '/reportes', modulo: 'reportes', texto: 'Reportes', icono: '▤', perfil: 'analista' },
  { ruta: '/asistente', modulo: 'asistente', texto: 'Asistente IA', icono: '✦', perfil: 'analista' },
  { ruta: '/descargas', modulo: 'descargas', texto: 'Descargas', icono: '⤓' },
  { ruta: '/metodologia', modulo: 'metodologia', texto: 'Metodología', icono: 'ⓘ' },
  { ruta: '/admin', modulo: 'cargar', texto: 'Administración', icono: '⚙', perfil: 'administrador' },
];

const NOMBRE_PERFIL = { publico: 'Público', analista: 'Analista', administrador: 'Administrador' };

export default function App() {
  const { meta, error, sesion, fecha, setFecha, puede, salir } = useApp();
  const [dialogo, setDialogo] = useState(false);

  if (error && !meta) return <main className="contenido"><Aviso error={error} /></main>;
  if (!meta) return <main className="contenido"><Cargando texto="Procesando los archivos AT03…" /></main>;

  const periodo = meta.periodos.find((p) => p.fecha === fecha);
  const proteger = (modulo, perfil, elemento) => (puede(modulo) ? elemento : <SinPermiso perfil={perfil} />);

  return (
    <div className="app">
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <header className="cabecera">
        <div className="marca">
          <span className="logo" aria-hidden="true" />
          <div>
            <strong>Rankings de crédito</strong>
            <span>Plataforma de análisis bancario · Hackathon SBP 2026</span>
          </div>
        </div>
        <div className="cabecera-der">
          <label className="campo en-linea" htmlFor="periodo-global">
            <span>Período</span>
            <select id="periodo-global" value={fecha ?? ''} onChange={(e) => setFecha(e.target.value)} disabled={!meta.periodos.length}>
              {meta.periodos.map((p) => <option key={p.fecha} value={p.fecha}>{p.etiqueta}</option>)}
            </select>
          </label>
          <div className={`perfil perfil-${sesion.perfil}`}>
            <span className="perfil-etq">Perfil</span>
            <strong>{NOMBRE_PERFIL[sesion.perfil]}</strong>
            {sesion.usuario && <span className="tenue">({sesion.usuario})</span>}
          </div>
          {sesion.usuario
            ? <button type="button" className="boton secundario" onClick={salir}>Salir</button>
            : <button type="button" className="boton" onClick={() => setDialogo(true)}>Entrar</button>}
        </div>
      </header>

      <div className="franja-aviso" role="note">
        <strong>Datos ficticios.</strong> {meta.aviso}
        <span className="franja-fuente">Fuente: {meta.fuente}{periodo ? ` · Período: ${mes(periodo.fecha)} (corte ${periodo.fecha}) · Archivo: ${periodo.archivo} · Procesado ${fechaHora(periodo.cargado)}` : ''}</span>
      </div>

      <div className="cuerpo">
        <nav className="navegacion" aria-label="Módulos">
          {MODULOS.filter((m) => puede(m.modulo)).map((m) => (
            <NavLink key={m.ruta} to={m.ruta} end={m.ruta === '/'} className={({ isActive }) => (isActive ? 'activo' : '')}>
              <span className="icono" aria-hidden="true">{m.icono}</span>{m.texto}
            </NavLink>
          ))}
          {sesion.perfil === 'publico' && (
            <p className="nav-nota">Analistas y administradores: use «Entrar» para ver comparaciones, calidad, reportes y administración.</p>
          )}
        </nav>
        <main id="contenido" className="contenido">
          {!meta.periodos.length && sesion.perfil !== 'administrador'
            ? <Aviso tipo="info">Todavía no hay períodos cargados. Un administrador debe cargar un archivo AT03.</Aviso>
            : (
              <Routes>
                <Route path="/" element={meta.periodos.length ? <Panel /> : <Administracion />} />
                <Route path="/rankings" element={<Rankings />} />
                <Route path="/comparar" element={proteger('comparar', 'analista', <Comparar />)} />
                <Route path="/calidad" element={proteger('calidad', 'analista', <Calidad />)} />
                <Route path="/reportes" element={proteger('reportes', 'analista', <Reportes />)} />
                <Route path="/asistente" element={proteger('asistente', 'analista', <Asistente />)} />
                <Route path="/descargas" element={<Descargas />} />
                <Route path="/metodologia" element={<Metodologia />} />
                <Route path="/admin" element={proteger('cargar', 'administrador', <Administracion />)} />
                <Route path="*" element={<Aviso tipo="info">Esta página no existe.</Aviso>} />
              </Routes>
            )}
        </main>
      </div>
      {dialogo && <DialogoEntrar cerrar={() => setDialogo(false)} />}
    </div>
  );
}

function DialogoEntrar({ cerrar }) {
  const { entrar } = useApp();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await entrar(usuario, clave);
      cerrar();
    } catch (err) {
      setError(err);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <dialog ref={ref} className="dialogo" onClose={cerrar} aria-labelledby="titulo-entrar">
      <form onSubmit={enviar}>
        <h2 id="titulo-entrar">Entrar como analista o administrador</h2>
        <p className="sub">El perfil público no necesita sesión. Los usuarios de prueba se crean al instalar con <code>npm run configurar</code>.</p>
        <label className="campo" htmlFor="usuario"><span>Usuario</span>
          <input id="usuario" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required autoFocus />
        </label>
        <label className="campo" htmlFor="clave"><span>Contraseña</span>
          <input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
        </label>
        <Aviso error={error} />
        <div className="fila-botones">
          <button type="button" className="boton secundario" onClick={cerrar}>Cancelar</button>
          <button type="submit" className="boton" disabled={enviando}>{enviando ? 'Verificando…' : 'Entrar'}</button>
        </div>
      </form>
    </dialog>
  );
}
