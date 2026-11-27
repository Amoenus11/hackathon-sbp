// Estado global de la web: metadatos (períodos, rankings, bancos, permisos), sesión y período elegido.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const Contexto = createContext(null);

export function ProveedorApp({ children }) {
  const [meta, setMeta] = useState(null);
  const [sesion, setSesion] = useState({ perfil: 'publico', usuario: null });
  const [fecha, setFecha] = useState(null);
  const [error, setError] = useState(null);

  const cargarMeta = useCallback(async () => {
    try {
      const m = await api('/meta');
      setMeta(m);
      setError(null);
      setFecha((f) => (f && m.periodos.some((p) => p.fecha === f) ? f : m.ultimo));
      return m;
    } catch (e) {
      setError(e);
      return null;
    }
  }, []);

  useEffect(() => {
    cargarMeta();
    api('/sesion').then(setSesion).catch(() => {});
  }, [cargarMeta]);

  const entrar = useCallback(async (usuario, clave) => {
    const s = await api('/sesion', { metodo: 'POST', cuerpo: { usuario, clave } });
    setSesion(s);
    return s;
  }, []);

  const salir = useCallback(async () => {
    setSesion(await api('/sesion', { metodo: 'DELETE' }));
  }, []);

  const valor = useMemo(() => {
    const permisos = meta?.permisos?.[sesion.perfil] ?? ['panel', 'rankings', 'metodologia', 'descargas'];
    return {
      meta, sesion, fecha, setFecha, error, cargarMeta, entrar, salir,
      puede: (modulo) => permisos.includes(modulo),
      ranking: (nombre) => meta?.rankings.find((r) => r.nombre === nombre),
      banco: (codigo) => meta?.bancos.find((b) => b.codigo === codigo),
      anterior: (f) => {
        const i = meta?.periodos.findIndex((p) => p.fecha === f) ?? -1;
        return i > 0 ? meta.periodos[i - 1].fecha : null;
      },
    };
  }, [meta, sesion, fecha, error, cargarMeta, entrar, salir]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useApp = () => useContext(Contexto);
