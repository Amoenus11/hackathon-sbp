// Descargas autorizadas: qué CSV puede bajar cada perfil (Público: rankings y desglose).
import { urlExportar } from '../api.js';
import { useApp } from '../contexto.jsx';
import { EXPORTACIONES, PERFILES, puede } from '../permisos.js';
import { EncabezadoPagina, Tarjeta } from '../componentes/Comunes.jsx';

export default function Descargas() {
  const { meta, sesion, abrirSesion } = useApp();
  return (
    <>
      <EncabezadoPagina
        titulo="Descargas"
        subtitulo="Resultados en CSV (UTF-8, separador coma), listos para Excel o para verificar contra la clave oficial"
      />
      <div className="rejilla-descargas">
        {EXPORTACIONES.map((e) => {
          const permitido = puede(sesion.perfil, e.minimo);
          return (
            <Tarjeta key={e.tipo} titulo={e.titulo} className={permitido ? '' : 'bloqueada'}>
              <p className="nota">{e.detalle}</p>
              {permitido ? (
                <div className="lista-descargas">
                  <a className="boton boton-primario boton-chico" href={urlExportar(e.tipo)} download>⤓ Todos los períodos</a>
                  {meta.periodos.map((p) => (
                    <a key={p.fecha} className="boton boton-secundario boton-chico" href={urlExportar(e.tipo, p.fecha)} download>{p.corta || p.etiqueta}</a>
                  ))}
                </div>
              ) : (
                <p className="aviso-bloqueo">
                  🔒 Disponible para el perfil {PERFILES[e.minimo].nombre}.{' '}
                  <button type="button" className="enlace-boton" onClick={abrirSesion}>Iniciar sesión</button>
                </p>
              )}
            </Tarjeta>
          );
        })}
      </div>
    </>
  );
}
