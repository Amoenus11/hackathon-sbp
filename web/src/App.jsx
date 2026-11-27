// Estructura general: cabecera, franja de «datos ficticios», menú lateral según el perfil,
// contenido de cada página y pie. Cada ruta verifica el perfil antes de mostrarse.
import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Recorrido from './componentes/Recorrido.jsx';
import ChatIA from './componentes/ChatIA.jsx';
import Bienvenida from './producto/Bienvenida.jsx';
import DosPasos from './producto/DosPasos.jsx';
import PrimerCorte from './producto/PrimerCorte.jsx';
import Saludo from './producto/Saludo.jsx';
import { useApp } from './contexto.jsx';
import { SECCIONES, puede } from './permisos.js';
import Cabecera from './componentes/Cabecera.jsx';
import Menu from './componentes/Menu.jsx';
import Pie from './componentes/Pie.jsx';
import ModalSesion from './componentes/ModalSesion.jsx';
import SinPermiso from './componentes/SinPermiso.jsx';
import { EstadoError, EstadoVacio, Esqueleto } from './componentes/Estados.jsx';
import Panel from './paginas/Panel.jsx';
import Rankings from './paginas/Rankings.jsx';
import Metodologia from './paginas/Metodologia.jsx';
import Descargas from './paginas/Descargas.jsx';
import Comparar from './paginas/Comparar.jsx';
import Calidad from './paginas/Calidad.jsx';
import Reportes from './paginas/Reportes.jsx';
import Asistente from './paginas/Asistente.jsx';
import Equipo from './paginas/Equipo.jsx';
import Pitch from './paginas/Pitch.jsx';
import Portada from './paginas/Portada.jsx';
import Publicar from './paginas/Publicar.jsx';
import Carta from './paginas/Carta.jsx';
import Extraccion from './paginas/Extraccion.jsx';
import CargarPeriodo from './paginas/admin/CargarPeriodo.jsx';
import Parametros from './paginas/admin/Parametros.jsx';
import Catalogos from './paginas/admin/Catalogos.jsx';
import Perfiles from './paginas/admin/Perfiles.jsx';
import Registro from './paginas/admin/Registro.jsx';
import NoEncontrada from './paginas/NoEncontrada.jsx';

const PAGINAS = {
  panel: Panel, rankings: Rankings, metodologia: Metodologia, descargas: Descargas,
  comparar: Comparar, calidad: Calidad, reportes: Reportes, asistente: Asistente, equipo: Equipo, publicar: Publicar, carta: Carta, extraccion: Extraccion,
  cargar: CargarPeriodo, parametros: Parametros, catalogos: Catalogos, perfiles: Perfiles, registro: Registro,
};

// Las páginas que necesitan datos de un período no tienen sentido si aún no hay ninguno cargado
const SIN_PERIODO_OK = ['metodologia', 'descargas', 'equipo', 'cargar', 'parametros', 'catalogos', 'perfiles', 'registro'];

function Protegida({ seccion }) {
  const { sesion, meta } = useApp();
  if (!puede(sesion.perfil, seccion.minimo)) return <SinPermiso seccion={seccion} />;
  // Modo producto: sin cortes, toda pantalla de datos guía a cargar el primero
  if (meta && meta.modo === 'producto' && meta.periodos.length === 0 && !SIN_PERIODO_OK.includes(seccion.clave)) return <PrimerCorte />;
  if (meta && meta.periodos.length === 0 && !SIN_PERIODO_OK.includes(seccion.clave)) {
    return (
      <EstadoVacio titulo="Aún no hay períodos cargados">
        Un administrador debe cargar al menos un archivo AT03 en «Cargar período».
      </EstadoVacio>
    );
  }
  // Idea 0: el Público ve la portada de tres preguntas; analista y administrador, el Panel de siempre
  const Pagina = seccion.clave === 'panel' && sesion.perfil === 'publico' ? Portada : PAGINAS[seccion.clave];
  if (meta?.modo === 'producto' && seccion.clave === 'panel') return <><Saludo /><Pagina /></>;
  return <Pagina />;
}

export default function App() {
  const { meta, errorMeta, recargarMeta, modalSesion, sesion } = useApp();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const ubicacion = useLocation();

  useEffect(() => { setMenuAbierto(false); window.scrollTo(0, 0); }, [ubicacion.pathname]);

  // Modo producto (demo.syntropy.com.pa): primero la cuenta, luego los 2 pasos y después la app
  if (meta?.modo === 'producto' && ubicacion.pathname !== '/pitch') {
    if (sesion.perfil === 'publico' && (!meta.periodos.length || new URLSearchParams(ubicacion.search).has('entrar'))) return <Bienvenida />;
    if (sesion.configurar_dos_pasos) return <DosPasos />;
  }

  return (
    <div className="app">
      <a className="saltar" href="#contenido">Saltar al contenido</a>
      <Cabecera alAbrirMenu={() => setMenuAbierto((v) => !v)} menuAbierto={menuAbierto} />
      <div className="cuerpo">
        <Menu abierto={menuAbierto} alCerrar={() => setMenuAbierto(false)} />
        <main id="contenido" className="contenido" tabIndex={-1}>
          {errorMeta ? (
            <EstadoError error={errorMeta} alReintentar={recargarMeta} titulo="No se pudo conectar con el servidor" />
          ) : !meta ? (
            <Esqueleto filas={6} />
          ) : (
            <Routes>
              {SECCIONES.map((s) => (
                <Route key={s.clave} path={s.ruta} element={<Protegida seccion={s} />} />
              ))}
              <Route path="/pitch" element={<Pitch />} />
              <Route path="*" element={<NoEncontrada />} />
            </Routes>
          )}
        </main>
      </div>
      <Pie />
      <Recorrido />
      <ChatIA />
      {modalSesion && <ModalSesion />}
    </div>
  );
}
