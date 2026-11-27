// Comparar: (1) dos períodos — movimientos de posición con la regla configurable y explicaciones
// automáticas; (2) varias entidades — saldos y ponderaciones lado a lado y mapa de calor.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp, useDatos } from '../contexto.jsx';
import { Carga } from '../componentes/Estados.jsx';
import {
  BotonDescarga, Campo, EncabezadoPagina, Insignia, Leyenda, NombreBanco, Pestanas, PuntoBanco, Tarjeta,
} from '../componentes/Comunes.jsx';
import TablaOrdenable from '../componentes/TablaOrdenable.jsx';
import Grafico from '../componentes/Grafico.jsx';
import { opcionBarrasAgrupadas, opcionCalor, opcionPendiente } from '../graficos.js';
import { colorBanco } from '../tema.js';
import {
  cambioTexto, claseCambio, etiquetaCorta, etiquetaPeriodo, monto, montoCorto, num, pct, tituloRanking, variacion,
} from '../formato.js';

export default function Comparar() {
  const [modo, setModo] = useState('periodos');
  return (
    <>
      <EncabezadoPagina titulo="Comparar" subtitulo="Entre períodos (movimientos de posición) y entre entidades (bancos lado a lado)" />
      <Pestanas
        etiqueta="Tipo de comparación" valor={modo} alCambiar={setModo}
        opciones={[{ valor: 'periodos', texto: 'Entre períodos' }, { valor: 'entidades', texto: 'Entre entidades' }]}
      />
      {modo === 'periodos' ? <EntrePeriodos /> : <EntreEntidades />}
    </>
  );
}

function ReglaActiva({ regla }) {
  const { sesion } = useApp();
  if (!regla) return null;
  const partes = [`sube o baja ${regla.mov_min_posiciones} o más posiciones`];
  if (regla.mov_cambio_lider) partes.push('cambia el líder');
  partes.push(`su saldo varía ${regla.mov_var_saldo_pct} % o más`);
  return (
    <p className="regla-activa">
      <strong>Regla de movimiento significativo:</strong> un banco se marca si {partes.join(', o ')}.{' '}
      {sesion.perfil === 'administrador' && <Link to="/admin/parametros">Cambiar regla</Link>}
    </p>
  );
}

export function EntrePeriodos() {
  const { meta, fecha, fechaAnterior } = useApp();
  const periodos = meta.periodos;
  const [desde, setDesde] = useState(fechaAnterior || periodos[Math.max(0, periodos.length - 2)]?.fecha);
  const [hasta, setHasta] = useState(fecha || periodos[periodos.length - 1]?.fecha);
  const [ranking, setRanking] = useState('');
  const [soloSignificativos, setSoloSignificativos] = useState(false);
  const [rankingGrafico, setRankingGrafico] = useState(meta.rankings[0]?.nombre);

  const valido = desde && hasta && desde < hasta;
  const estado = useDatos(() => (valido ? api.movimientos({ desde, hasta, ranking }) : null), [desde, hasta, ranking, valido]);

  if (periodos.length < 2) {
    return <Tarjeta titulo="Comparación entre períodos"><p className="nota">Se necesitan al menos dos períodos cargados.</p></Tarjeta>;
  }

  return (
    <>
      <div className="barra-filtros">
        <Campo etiqueta="Desde">
          <select value={desde} onChange={(e) => setDesde(e.target.value)}>
            {periodos.map((p) => <option key={p.fecha} value={p.fecha}>{p.etiqueta}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Hasta">
          <select value={hasta} onChange={(e) => setHasta(e.target.value)}>
            {periodos.map((p) => <option key={p.fecha} value={p.fecha}>{p.etiqueta}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Ranking">
          <select value={ranking} onChange={(e) => { setRanking(e.target.value); if (e.target.value) setRankingGrafico(e.target.value); }}>
            <option value="">Todos</option>
            {meta.rankings.map((r) => <option key={r.nombre} value={r.nombre}>{r.titulo}</option>)}
          </select>
        </Campo>
        <label className="casilla">
          <input type="checkbox" checked={soloSignificativos} onChange={(e) => setSoloSignificativos(e.target.checked)} />
          Solo movimientos significativos
        </label>
        <BotonDescarga tipo="movimientos">Movimientos (CSV)</BotonDescarga>
      </div>

      {!valido ? (
        <Tarjeta><p className="mensaje-error">«Desde» debe ser un período anterior a «Hasta».</p></Tarjeta>
      ) : (
        <Carga estado={estado} filas={10}>
          {(m) => {
            const filas = soloSignificativos ? m.filas.filter((f) => f.significativo) : m.filas;
            const significativos = m.filas.filter((f) => f.significativo).length;
            const paraGrafico = m.filas.filter((f) => f.ranking === (ranking || rankingGrafico));
            const etiquetas = [etiquetaCorta(m.desde, meta), etiquetaCorta(m.hasta, meta)];
            return (
              <>
                <ReglaActiva regla={m.regla} />
                {m.resumen && (
                  <p className="nota">
                    Con esta regla se marcan {m.resumen.significativos} de {m.resumen.total} movimientos ({pct(m.resumen.pct_marcados, 1)}).
                    {m.resumen.var_p90_pct != null && <>En estos datos, la variación de saldo típica (mediana) es {pct(m.resumen.var_mediana_pct, 1)} y el 90 % de los bancos varía menos de {pct(m.resumen.var_p90_pct, 1)}: un umbral cercano a ese valor marca solo los casos más extremos (ver Metodología).</>}
                  </p>
                )}
                {m.meses_entre > 1 && (
                  <p className="aviso-bloqueo" role="status">
                    Ojo: {etiquetaPeriodo(m.desde, meta)} y {etiquetaPeriodo(m.hasta, meta)} están a {m.meses_entre} meses de distancia. Una variación de saldo
                    acumula todos esos meses, así que con el mismo umbral se marcarán muchos más bancos que entre meses seguidos.
                  </p>
                )}
                <div className="rejilla-dos">
                  <Tarjeta
                    titulo="Explicación automática"
                    subtitulo={`${etiquetaPeriodo(m.desde, meta)} → ${etiquetaPeriodo(m.hasta, meta)} · ${significativos} movimientos significativos`}
                    id="explicaciones"
                  >
                    {m.explicaciones.length === 0 ? (
                      <p className="nota">No hubo movimientos que cumplan la regla.</p>
                    ) : (
                      <ul className="destacados">
                        {m.explicaciones.map((t, i) => <li key={i} className="destacado"><span className="destacado-icono" aria-hidden="true">✦</span><span>{t}</span></li>)}
                      </ul>
                    )}
                  </Tarjeta>
                  <Tarjeta
                    titulo={`Cambio de posiciones · ${tituloRanking(ranking || rankingGrafico, meta)}`}
                    subtitulo="Verde: sube · rojo: baja · gris: se mantiene. Línea gruesa: movimiento significativo."
                    acciones={!ranking && (
                      <select aria-label="Ranking del gráfico" value={rankingGrafico} onChange={(e) => setRankingGrafico(e.target.value)}>
                        {meta.rankings.map((r) => <option key={r.nombre} value={r.nombre}>{r.titulo}</option>)}
                      </select>
                    )}
                    id="pendiente"
                  >
                    <Grafico opcion={opcionPendiente(paraGrafico, etiquetas)} alto={420} etiqueta="Gráfico de pendiente con la posición de cada banco en ambos períodos" />
                  </Tarjeta>
                </div>
                <Tarjeta titulo="Movimientos de posición" subtitulo={`${filas.length} filas · Cambio = posición anterior − posición actual (positivo = sube) · Frente al sector = variación del banco − variación de todo el ranking, en puntos porcentuales`} id="tabla-movimientos">
                  <TablaOrdenable
                    etiqueta="Movimientos de posición"
                    claveFila={(f) => `${f.ranking}-${f.codigo_banco}`}
                    filaResaltada={(f) => f.significativo}
                    ordenInicial={{ clave: 'significativo', asc: false }}
                    columnas={[
                      { clave: 'ranking', titulo: 'Ranking', valor: (f) => meta.rankings.findIndex((r) => r.nombre === f.ranking), render: (f) => tituloRanking(f.ranking, meta) },
                      { clave: 'banco', titulo: 'Banco', render: (f) => <NombreBanco codigo={f.codigo_banco} nombre={f.banco} /> },
                      { clave: 'posicion_anterior', titulo: 'Antes', numerica: true, render: (f) => `${f.posicion_anterior}.º` },
                      { clave: 'posicion_actual', titulo: 'Ahora', numerica: true, render: (f) => `${f.posicion_actual}.º` },
                      { clave: 'cambio', titulo: 'Cambio', numerica: true, render: (f) => <span className={`cambio ${claseCambio(f.cambio)}`}>{cambioTexto(f.cambio)}</span> },
                      { clave: 'saldo_anterior', titulo: 'Saldo antes', numerica: true, valor: (f) => num(f.saldo_anterior), render: (f) => monto(f.saldo_anterior) },
                      { clave: 'saldo_actual', titulo: 'Saldo ahora', numerica: true, valor: (f) => num(f.saldo_actual), render: (f) => monto(f.saldo_actual) },
                      { clave: 'var_saldo_pct', titulo: 'Var. saldo', numerica: true, valor: (f) => num(f.var_saldo_pct), render: (f) => variacion(f.var_saldo_pct) },
                      {
                        clave: 'var_vs_sector_pp', titulo: 'Frente al sector', numerica: true, valor: (f) => num(f.var_vs_sector_pp),
                        render: (f) => (f.var_vs_sector_pp == null ? '—' : variacion(f.var_vs_sector_pp).replace(' %', ' pp')),
                      },
                      {
                        clave: 'significativo', titulo: 'Significativo', valor: (f) => (f.significativo ? 1 : 0),
                        render: (f) => (f.significativo
                          ? <span className="motivos"><Insignia tono="aviso">Sí</Insignia> {f.motivos.join(' · ')}</span>
                          : <span className="nota">No</span>),
                      },
                    ]}
                    filas={filas}
                  />
                </Tarjeta>
              </>
            );
          }}
        </Carga>
      )}
    </>
  );
}

export function EntreEntidades() {
  const { meta, fecha } = useApp();
  const [elegidos, setElegidos] = useState(() => meta.bancos.slice(0, 3).map((b) => b.codigo));
  const [metrica, setMetrica] = useState('saldo');
  const estado = useDatos(() => (fecha ? api.matriz(fecha) : null), [fecha]);
  const titulo = (r) => tituloRanking(r, meta);

  function alternar(codigo) {
    setElegidos((lista) => {
      if (lista.includes(codigo)) return lista.length > 2 ? lista.filter((c) => c !== codigo) : lista;
      return lista.length < 4 ? [...lista, codigo] : lista;
    });
  }

  return (
    <>
      <div className="barra-filtros barra-bancos">
        <p className="barra-etiqueta">Elige de 2 a 4 bancos:</p>
        <div className="chips">
          {meta.bancos.map((b) => {
            const activo = elegidos.includes(b.codigo);
            return (
              <button
                key={b.codigo} type="button" aria-pressed={activo}
                className={`chip ${activo ? 'activo' : ''}`} onClick={() => alternar(b.codigo)}
                style={activo ? { borderColor: colorBanco(b.codigo) } : undefined}
                disabled={!activo && elegidos.length >= 4}
              >
                <PuntoBanco codigo={b.codigo} /> {b.nombre}
              </button>
            );
          })}
        </div>
        <Pestanas
          compactas etiqueta="Medida" valor={metrica} alCambiar={setMetrica}
          opciones={[{ valor: 'saldo', texto: 'Saldo' }, { valor: 'ponderacion', texto: 'Ponderación %' }]}
        />
      </div>
      <Carga estado={estado} filas={10}>
        {(mz) => {
          const bancos = mz.bancos.filter((b) => elegidos.includes(b.codigo_banco));
          const celda = (b, r) => b.celdas.find((c) => c.ranking === r);
          const valor = (b, r) => num(metrica === 'saldo' ? celda(b, r)?.saldo : celda(b, r)?.ponderacion_pct) ?? 0;
          return (
            <>
              <div className="rejilla-dos">
                <Tarjeta titulo={metrica === 'saldo' ? 'Saldo por actividad' : 'Ponderación por actividad'} subtitulo={etiquetaPeriodo(mz.fecha, meta)} id="agrupadas">
                  <Grafico
                    opcion={opcionBarrasAgrupadas(mz.rankings, bancos, valor, titulo, { formato: metrica === 'saldo' ? montoCorto : (v) => `${v} %` })}
                    alto={380} etiqueta="Barras agrupadas por actividad para los bancos elegidos"
                  />
                </Tarjeta>
                <Tarjeta titulo="Posiciones lado a lado" subtitulo="Posición de cada banco en cada ranking" id="lado-a-lado">
                  <div className="tabla-envoltura">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th scope="col">Actividad</th>
                          {bancos.map((b) => <th key={b.codigo_banco} scope="col" className="numerica"><NombreBanco codigo={b.codigo_banco} nombre={b.banco} /></th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {mz.rankings.map((r) => {
                          const mejor = Math.min(...bancos.map((b) => celda(b, r)?.posicion ?? 99));
                          return (
                            <tr key={r}>
                              <th scope="row">{titulo(r)}</th>
                              {bancos.map((b) => {
                                const c = celda(b, r);
                                return (
                                  <td key={b.codigo_banco} className={`numerica num ${c?.posicion === mejor ? 'celda-mejor' : ''}`}>
                                    <strong>{c?.posicion ?? '—'}.º</strong>
                                    <span className="celda-sub">{metrica === 'saldo' ? montoCorto(c?.saldo) : pct(c?.ponderacion_pct, 2)}</span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                        <tr className="fila-total">
                          <th scope="row">Cartera local válida</th>
                          {bancos.map((b) => <td key={b.codigo_banco} className="numerica num">{monto(b.total_cartera)}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <Leyenda>En verde, el mejor puesto entre los bancos elegidos.</Leyenda>
                </Tarjeta>
              </div>
              <Tarjeta
                titulo="Mapa de calor: ¿a qué se dedica cada banco?"
                subtitulo="Ponderación oficial: qué parte de la cartera de cada banco va a cada actividad (los 12 bancos)"
                id="calor"
              >
                <Grafico opcion={opcionCalor(mz, titulo, { seleccion: elegidos })} alto={520} etiqueta="Mapa de calor de ponderaciones banco por actividad" />
              </Tarjeta>
            </>
          );
        }}
      </Carga>
    </>
  );
}
