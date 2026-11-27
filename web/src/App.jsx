// Estructura general: cabecera, franja de «datos ficticios», menú lateral según el perfil,
// contenido de cada página y pie. Cada ruta verifica el perfil antes de mostrarse.
import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Recorrido from './componentes/Recorrido.jsx';
import ChatIA from './componentes/ChatIA.jsx';
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
import Publicar from './paginas/Publicar.jsx';
import Carta from './paginas/Carta.jsx';
import CargarPeriodo from './paginas/admin/CargarPeriodo.jsx';
import Parametros from './paginas/admin/Parametros.jsx';
import Catalogos from './paginas/admin/Catalogos.jsx';
import Perfiles from './paginas/admin/Perfiles.jsx';
import Registro from './paginas/admin/Registro.jsx';
import NoEncontrada from './paginas/NoEncontrada.jsx';

const PAGINAS = {
  panel: Panel, rankings: Rankings, metodologia: Metodologia, descargas: Descargas,
  comparar: Comparar, calidad: Calidad, reportes: Reportes, asistente: Asistente, equipo: Equipo, publicar: Publicar, carta: Carta,
  cargar: CargarPeriodo, parametros: Parametros, catalogos: Catalogos, perfiles: Perfiles, registro: Registro,
};

// Las páginas que necesitan datos de un período no tienen sentido si aún no hay ninguno cargado
const SIN_PERIODO_OK = ['metodologia', 'descargas', 'equipo', 'cargar', 'parametros', 'catalogos', 'perfiles', 'registro'];

function Protegida({ seccion }) {
  const { sesion, meta } = useApp();
  if (!puede(sesion.perfil, seccion.minimo)) return <SinPermiso seccion={seccion} />;
  if (meta && meta.periodos.length === 0 && !SIN_PERIODO_OK.includes(seccion.clave)) {
    return (
      <EstadoVacio titulo="Aún no hay períodos cargados">
        Un administrador debe cargar al menos un archivo AT03 en «Cargar período».
      </EstadoVacio>
    );
  }
  const Pagina = PAGINAS[seccion.clave];
  return <Pagina />;
}

export default function App() {
  const { meta, errorMeta, recargarMeta, modalSesion } = useApp();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const ubicacion = useLocation();

  useEffect(() => { setMenuAbierto(false); window.scrollTo(0, 0); }, [ubicacion.pathname]);

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
