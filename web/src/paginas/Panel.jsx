// Panel principal: el resumen del período en una sola pantalla.
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp, useDatos } from '../contexto.jsx';
import { Carga } from '../componentes/Estados.jsx';
import { EncabezadoPagina, InsigniaTipo, KPI, NombreBanco, Tarjeta, Insignia } from '../componentes/Comunes.jsx';
import Grafico from '../componentes/Grafico.jsx';
import { opcionComposicion, opcionHHI } from '../graficos.js';
import { entero, etiquetaPeriodo, monto, montoCorto, pct, tituloRanking, variacion } from '../formato.js';

const ICONOS = { lider: '★', sube: '▲', baja: '▼', saldo: '↗' };

export default function Panel() {
  const { meta, fecha } = useApp();
  const estado = useDatos(() => (fecha ? api.panel(fecha) : null), [fecha]);
  const titulo = (r) => tituloRanking(r, meta);

  return (
    <>
      <EncabezadoPagina
        titulo="Panel principal"
        subtitulo={`Cartera de crédito local válida por actividad económica · ${etiquetaPeriodo(fecha, meta)}`}
      />
      <Carga estado={estado} filas={8}>
        {(p) => {
          const varCartera = p.kpis.var_cartera_pct;
          return (
            <div className="rejilla-panel">
              <div className="kpis">
                <KPI
                  titulo="Cartera local válida" valor={montoCorto(p.kpis.cartera_total)}
                  detalle={`${monto(p.kpis.cartera_total)} u.m.`}
                  variacion={varCartera != null ? `${variacion(varCartera)} vs ${etiquetaPeriodo(p.fecha_anterior, meta)}` : null}
                  tendencia={Number(varCartera) >= 0 ? 'sube' : 'baja'}
                  ayuda="Suma del saldo de todas las operaciones que superaron los filtros E1 a E4"
                />
                <KPI titulo="Operaciones válidas" valor={entero(p.kpis.operaciones)} detalle={`de ${entero(p.kpis.filas_leidas)} filas leídas`} />
                <KPI titulo="Bancos" valor={entero(p.kpis.bancos)} detalle="licencia general · ficticios" />
                <KPI
                  titulo="Filas excluidas" valor={entero(p.kpis.excluidas)}
                  detalle={`${pct(p.kpis.pct_excluidas, 2)} del total · reglas E1–E4`}
                  ayuda="Duplicados, destino extranjero, saldo no positivo y actividad no catalogada"
                />
                {p.indicadores?.morosidad_pct != null && (
                  <KPI titulo="Cartera con atraso" valor={pct(p.indicadores.morosidad_pct, 2)} detalle="saldo con días de mora / saldo válido (indicador adicional)" />
                )}
              </div>

              <Tarjeta
                titulo="Líderes por actividad" subtitulo="El banco con mayor saldo en cada ranking del período"
                className="tarjeta-lideres" id="lideres"
              >
                <div className="lideres">
                  {p.lideres.map((l) => {
                    const cambio = l.lider_anterior && l.lider_anterior.codigo_banco !== l.codigo_banco;
                    const tipo = meta.rankings.find((r) => r.nombre === l.ranking)?.tipo;
                    return (
                      <Link key={l.ranking} to={`/rankings?ranking=${l.ranking}`} className="lider">
                        <div className="lider-cabecera">
                          <span className="lider-ranking">{titulo(l.ranking)}</span>
                          <InsigniaTipo tipo={tipo} />
                        </div>
                        <NombreBanco codigo={l.codigo_banco} nombre={l.banco} />
                        <p className="lider-saldo num">{montoCorto(l.saldo)}</p>
                        <p className="lider-detalle">
                          {pct(l.participacion_pct, 1)} del mercado · ponderación {pct(l.ponderacion_pct, 2)}
                        </p>
                        {cambio && <Insignia tono="aviso">Nuevo líder · antes {l.lider_anterior.banco}</Insignia>}
                      </Link>
                    );
                  })}
                </div>
              </Tarjeta>

              <Tarjeta titulo="Lo que cambió este mes" subtitulo="Explicaciones automáticas a partir de las reglas configuradas" id="cambios">
                {p.destacados.length === 0 ? (
                  <p className="nota">{p.fecha_anterior ? 'No hubo movimientos significativos.' : 'Es el primer período cargado: aún no hay con qué comparar.'}</p>
                ) : (
                  <ul className="destacados">
                    {p.destacados.map((d, i) => (
                      <li key={i} className={`destacado destacado-${d.tipo}`}>
                        <span className="destacado-icono" aria-hidden="true">{ICONOS[d.tipo] || '•'}</span>
                        <span>{d.texto}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {p.fecha_anterior && <Link to="/comparar" className="enlace-mas">Ver todos los movimientos →</Link>}
              </Tarjeta>

              <Tarjeta titulo="Composición de la cartera" subtitulo="Saldo del sistema por actividad económica" id="composicion">
                <Grafico
                  opcion={opcionComposicion(p.composicion, titulo)} alto={300}
                  etiqueta="Gráfico de dona con la participación de cada actividad en la cartera local válida"
                />
              </Tarjeta>

              {p.indicadores?.concentracion?.length > 0 && (
                <Tarjeta
                  titulo="Concentración por actividad" id="hhi" className="tarjeta-ancha"
                  subtitulo="Índice Herfindahl-Hirschman (HHI): menos de 1 500 = baja; 1 500–2 500 = moderada; más de 2 500 = alta"
                >
                  <Grafico
                    opcion={opcionHHI(p.indicadores.concentracion, titulo)} alto={280}
                    etiqueta="Barras con el índice de concentración de cada actividad"
                  />
                </Tarjeta>
              )}
            </div>
          );
        }}
      </Carga>
    </>
  );
}
