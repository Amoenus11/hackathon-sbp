// Estado compartido de toda la app: metadatos (períodos, rankings, bancos), sesión (perfil) y el
// período seleccionado en la cabecera, que usan todas las páginas.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const Contexto = createContext(null);

export function ProveedorApp({ children }) {
  const [meta, setMeta] = useState(null);
  const [errorMeta, setErrorMeta] = useState(null);
  const [sesion, setSesion] = useState({ perfil: 'publico', usuario: null });
  const [fecha, setFecha] = useState(null);
  const [paso, setPaso] = useState(null); // presentación guiada: índice del paso o null
  // ?entrar=terminal: viene de nathalia.… o gui.…: se abre el inicio de sesión y luego vuelve a su terminal
  const [modalSesion, setModalSesion] = useState(() => new URLSearchParams(window.location.search).has('entrar'));

  const recargarMeta = useCallback(async () => {
    try {
      const m = await api.meta();
      setMeta(m);
      setErrorMeta(null);
      // Conserva el período elegido si sigue existiendo; si no, el más reciente
      setFecha((actual) => (actual && m.periodos.some((p) => p.fecha === actual) ? actual : m.ultimo || null));
      return m;
    } catch (e) {
      setErrorMeta(e);
      return null;
    }
  }, []);

  useEffect(() => {
    recargarMeta();
    api.sesion().then(setSesion).catch(() => {});
  }, [recargarMeta]);

  // Si el servidor dice que la sesión ya no vale, la cabecera se pone al día y se pide entrar de nuevo
  useEffect(() => {
    const alVencer = async () => {
      try {
        const s = await api.sesion();
        setSesion(s);
        if (s.perfil === 'publico') setModalSesion(true);
      } catch { /* sin conexión: no cambiamos nada */ }
    };
    window.addEventListener('syntropy:sesion-vencida', alVencer);
    return () => window.removeEventListener('syntropy:sesion-vencida', alVencer);
  }, []);

  // Período anterior al seleccionado (para comparar «vs mes anterior»)
  const fechaAnterior = useMemo(() => {
    if (!meta || !fecha) return null;
    const i = meta.periodos.findIndex((p) => p.fecha === fecha);
    return i > 0 ? meta.periodos[i - 1].fecha : null;
  }, [meta, fecha]);

  const valor = {
    meta, errorMeta, recargarMeta,
    sesion, setSesion,
    fecha, setFecha, fechaAnterior,
    modalSesion, abrirSesion: () => setModalSesion(true), cerrarModalSesion: () => setModalSesion(false),
    paso, setPaso,
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp() {
  return useContext(Contexto);
}

// Carga datos de la API y recuerda su estado (cargando / error / datos).
// `cargar` puede devolver null cuando aún falta algún dato (por ejemplo, el período).
export function useDatos(cargar, dependencias) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    Promise.resolve()
      .then(cargar)
      .then((datos) => { if (vigente) setEstado({ datos, cargando: false, error: null }); })
      .catch((error) => { if (vigente) setEstado({ datos: null, cargando: false, error }); });
    return () => { vigente = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, version]);

  return { ...estado, recargar: () => setVersion((v) => v + 1) };
}
