// Descargas autorizadas según el perfil.
import { useApp } from '../contexto.jsx';
import { urlExportar } from '../api.js';
import { Tarjeta } from '../componentes/Comunes.jsx';
import { mes } from '../formato.js';

const ARCHIVOS = [
  { tipo: 'rankings', titulo: 'Rankings por período', desc: 'Posición, saldo, total de cartera, ponderación y operaciones de los 12 bancos en los 6 rankings.', publico: true },
  { tipo: 'desglose', titulo: 'Desglose por subactividad', desc: 'Saldo de cada banco en las 22 subactividades, con la reclasificación SB21 a Tarjeta.', publico: true },
  { tipo: 'calidad', titulo: 'Reporte de calidad de datos', desc: 'Conteos en cascada E1–E4 y universo local válido por período.' },
  { tipo: 'movimientos', titulo: 'Movimientos de posición', desc: 'Cambios entre períodos consecutivos, con variación de saldo y motivo.' },
  { tipo: 'excluidas', titulo: 'Filas excluidas', desc: 'Lista trazable de cada fila excluida y su motivo.' },
];

export default function Descargas() {
  const { meta, fecha, sesion } = useApp();
  const analista = sesion.perfil !== 'publico';
  return (
    <>
      <div className="titulo-pagina">
        <h1>Descargas</h1>
        <p>Archivos CSV calculados en el momento desde los archivos AT03. Período elegido: {mes(fecha)}.</p>
      </div>
      <Tarjeta>
        <ul className="lista-descargas">
          {ARCHIVOS.map((a) => {
            const permitido = a.publico || analista;
            return (
              <li key={a.tipo} className={permitido ? '' : 'bloqueada'}>
                <div>
                  <strong>{a.titulo}</strong>
                  <p>{a.desc}</p>
                  {!permitido && <p className="tenue">Disponible para analistas y administradores.</p>}
                </div>
                {permitido && (
                  <div className="fila-botones">
                    <a className="boton secundario chico" href={urlExportar(a.tipo, { fecha })} download>⤓ {mes(fecha)}</a>
                    <a className="boton secundario chico" href={urlExportar(a.tipo, {})} download>⤓ Todos ({meta.periodos.length} períodos)</a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Tarjeta>
    </>
  );
}
