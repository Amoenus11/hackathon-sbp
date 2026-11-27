// Consulta de rankings: por período y actividad, con filtros, gráfico, tabla ordenable,
// detalle por subactividad de cada banco y la evolución de posiciones en el tiempo.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp, useDatos } from '../contexto.jsx';
import { Carga } from '../componentes/Estados.jsx';
import {
  BotonDescarga, Campo, EncabezadoPagina, InsigniaTipo, Leyenda, NombreBanco, PanelLateral, Pestanas, Tarjeta,
} from '../componentes/Comunes.jsx';
import TablaOrdenable from '../componentes/TablaOrdenable.jsx';
import Grafico from '../componentes/Grafico.jsx';
import { opcionBarrasRanking, opcionDesglose, opcionPosiciones } from '../graficos.js';
import {
  cambioTexto, claseCambio, entero, etiquetaCorta, etiquetaPeriodo, monto, num, pct, tituloRanking, variacion,
} from '../formato.js';

export default function Rankings() {
  const { meta, fecha } = useApp();
  const [params, setParams] = useSearchParams();
  const ranking = params.get('ranking') && meta.rankings.some((r) => r.nombre === params.get('ranking'))
    ? params.get('ranking') : meta.rankings[0]?.nombre;
  const vista = params.get('vista') || 'tabla';
  const banco = params.get('banco') || '';
  const subactividad = params.get('sub') || '';
  const [detalle, setDetalle] = useState(null); // fila del banco abierto en el panel lateral

  const infoRanking = meta.rankings.find((r) => r.nombre === ranking);

  function cambiar(clave, valor) {
    const nuevos = new URLSearchParams(params);
    if (valor) nuevos.set(clave, valor); else nuevos.delete(clave);
    if (clave === 'ranking') nuevos.delete('sub');
    setParams(nuevos, { replace: true });
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Rankings de crédito"
        subtitulo={`Posición de los 12 bancos por saldo en cada actividad · ${etiquetaPeriodo(fecha, meta)}`}
      >
        <BotonDescarga tipo="rankings" fecha={fecha}>Ranking (CSV)</BotonDescarga>
        <BotonDescarga tipo="desglose" fecha={fecha}>Desglose (CSV)</BotonDescarga>
      </EncabezadoPagina>

      <Pestanas
        etiqueta="Ranking" valor={ranking} alCambiar={(v) => cambiar('ranking', v)}
        opciones={meta.rankings.map((r) => ({ valor: r.nombre, texto: r.titulo || tituloRanking(r.nombre), extra: <InsigniaTipo tipo={r.tipo} /> }))}
      />

      <div className="barra-filtros">
        <Pestanas
          compactas etiqueta="Vista" valor={vista} alCambiar={(v) => cambiar('vista', v === 'tabla' ? '' : v)}
          opciones={[{ valor: 'tabla', texto: 'Ranking del período' }, { valor: 'evolucion', texto: 'Evolución' }]}
        />
        <Campo etiqueta="Banco (resaltar)">
          <select value={banco} onChange={(e) => cambiar('banco', e.target.value)}>
            <option value="">Todos</option>
            {meta.bancos.map((b) => <option key={b.codigo} value={b.codigo}>{b.nombre} ({b.codigo})</option>)}
          </select>
        </Campo>
        {vista === 'tabla' && (
          <Campo etiqueta="Subactividad">
            <select value={subactividad} onChange={(e) => cambiar('sub', e.target.value)}>
              <option value="">Todas (ranking oficial)</option>
              {infoRanking?.subactividades.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Campo>
        )}
      </div>

      {vista === 'evolucion' ? (
        <Evolucion ranking={ranking} banco={banco} />
      ) : subactividad ? (
        <PorSubactividad fecha={fecha} ranking={ranking} subactividad={subactividad} banco={banco} />
      ) : (
        <RankingDelPeriodo fecha={fecha} ranking={ranking} banco={banco} alElegir={setDetalle} />
      )}

      <PanelLateral
        abierto={!!detalle} alCerrar={() => setDetalle(null)}
        titulo={detalle ? `${detalle.banco} · ${tituloRanking(ranking, meta)}` : ''}
      >
        {detalle && <DesgloseBanco fecha={fecha} ranking={ranking} fila={detalle} />}
      </PanelLateral>
    </>
  );
}

export function RankingDelPeriodo({ fecha, ranking, banco, alElegir }) {
  const { meta } = useApp();
  const estado = useDatos(() => (fecha && ranking ? api.rankings(fecha, ranking) : null), [fecha, ranking]);

  return (
    <Carga estado={estado} filas={10}>
      {(d) => {
        const hayAnterior = d.fecha_anterior != null;
        const columnas = [
          { clave: 'posicion', titulo: 'Posición', numerica: true, render: (f) => <span className="posicion">{f.posicion}</span> },
          { clave: 'banco', titulo: 'Banco', render: (f) => <NombreBanco codigo={f.codigo_banco} nombre={f.banco} /> },
          { clave: 'saldo_actividad', titulo: 'Saldo de la actividad', numerica: true, valor: (f) => num(f.saldo_actividad), render: (f) => monto(f.saldo_actividad) },
          { clave: 'total_cartera', titulo: 'Cartera total del banco', numerica: true, valor: (f) => num(f.total_cartera), render: (f) => monto(f.total_cartera) },
          { clave: 'ponderacion_pct', titulo: 'Ponderación', numerica: true, valor: (f) => num(f.ponderacion_pct), render: (f) => pct(f.ponderacion_pct) },
          { clave: 'participacion_pct', titulo: 'Participación', numerica: true, valor: (f) => num(f.participacion_pct), render: (f) => pct(f.participacion_pct, 2) },
          { clave: 'operaciones', titulo: 'Operaciones', numerica: true, render: (f) => entero(f.operaciones) },
          ...(hayAnterior ? [
            { clave: 'cambio', titulo: `Cambio vs ${etiquetaCorta(d.fecha_anterior, meta)}`, numerica: true, render: (f) => <span className={`cambio ${claseCambio(f.cambio)}`}>{cambioTexto(f.cambio)}</span> },
            { clave: 'var_saldo_pct', titulo: 'Var. saldo', numerica: true, valor: (f) => num(f.var_saldo_pct), render: (f) => variacion(f.var_saldo_pct) },
          ] : []),
        ];
        return (
          <div className="rejilla-dos">
            <Tarjeta
              titulo={`${tituloRanking(ranking, meta)} · ${etiquetaPeriodo(d.fecha, meta)}`}
              subtitulo={`Saldo total del ranking en el sistema: ${monto(d.total_ranking)} u.m.`}
              id="grafico-ranking"
            >
              <Grafico
                opcion={opcionBarrasRanking(d.filas, { resaltado: banco || null })} alto={430}
                etiqueta={`Barras con el saldo de cada banco en ${tituloRanking(ranking, meta)}`}
                alEventos={{ click: (p) => alElegir([...d.filas].sort((a, b) => a.posicion - b.posicion)[p.dataIndex]) }}
              />
              <Leyenda>Haz clic en una barra o en una fila para ver el detalle por subactividad.</Leyenda>
            </Tarjeta>
            <Tarjeta titulo="Tabla del ranking" subtitulo="Ordena con clic en los encabezados" id="tabla-ranking">
              <TablaOrdenable
                etiqueta={`Ranking ${tituloRanking(ranking, meta)}`} columnas={columnas} filas={d.filas}
                ordenInicial={{ clave: 'posicion', asc: true }} claveFila={(f) => f.codigo_banco}
                alClicFila={alElegir} filaResaltada={(f) => f.codigo_banco === banco}
              />
              <Leyenda>
                <strong>Ponderación</strong> = saldo del banco en esta actividad ÷ su cartera local válida total × 100 (regla oficial, 4 decimales).{' '}
                <strong>Participación</strong> = saldo del banco ÷ saldo de la actividad en todo el sistema (cuota de mercado, indicador adicional).
              </Leyenda>
            </Tarjeta>
          </div>
        );
      }}
    </Carga>
  );
}

// Saldos de una subactividad para los 12 bancos (informativo: el ranking oficial es por actividad)
export function PorSubactividad({ fecha, ranking, subactividad, banco }) {
  const { meta } = useApp();
  const estado = useDatos(() => (fecha && ranking ? api.desglose(fecha, ranking) : null), [fecha, ranking]);
  return (
    <Carga estado={estado} filas={8}>
      {(d) => {
        const filas = d.filas.filter((f) => f.subactividad === subactividad)
          .sort((a, b) => (num(b.saldo) - num(a.saldo)) || a.codigo_banco.localeCompare(b.codigo_banco))
          .map((f, i) => ({ ...f, posicion: i + 1, saldo_actividad: f.saldo }));
        const total = filas.reduce((s, f) => s + (num(f.saldo) || 0), 0);
        return (
          <div className="rejilla-dos">
            <Tarjeta titulo={`${subactividad} · ${tituloRanking(ranking, meta)}`} subtitulo="Saldo de cada banco en esta subactividad (informativo)" id="sub-grafico">
              <Grafico
                opcion={opcionBarrasRanking(filas.map((f) => ({ ...f, ponderacion_pct: null })), { resaltado: banco || null })}
                alto={430} etiqueta={`Saldo por banco en la subactividad ${subactividad}`}
              />
            </Tarjeta>
            <Tarjeta titulo="Tabla por subactividad" id="sub-tabla">
              <TablaOrdenable
                etiqueta={`Subactividad ${subactividad}`} claveFila={(f) => f.codigo_banco}
                filaResaltada={(f) => f.codigo_banco === banco}
                columnas={[
                  { clave: 'posicion', titulo: 'Orden', numerica: true },
                  { clave: 'banco', titulo: 'Banco', render: (f) => <NombreBanco codigo={f.codigo_banco} nombre={f.banco} /> },
                  { clave: 'saldo', titulo: 'Saldo', numerica: true, valor: (f) => num(f.saldo), render: (f) => monto(f.saldo) },
                  { clave: 'cuota', titulo: '% de la subactividad', numerica: true, valor: (f) => num(f.saldo), render: (f) => (total ? `${((num(f.saldo) / total) * 100).toFixed(2)} %` : '—') },
                  { clave: 'operaciones', titulo: 'Operaciones', numerica: true, render: (f) => entero(f.operaciones) },
                ]}
                filas={filas}
              />
              {ranking === 'CONSUMO' && subactividad === 'Tarjeta' && (
                <p className="nota-sb21">
                  Incluye operaciones con CINU de Crédito personal y facilidad <strong>07</strong> reclasificadas a Tarjeta (regla SB21).
                </p>
              )}
              <Leyenda>El ranking oficial se calcula por actividad; esta vista por subactividad es complementaria.</Leyenda>
            </Tarjeta>
          </div>
        );
      }}
    </Carga>
  );
}

// Detalle de un banco: de qué subactividades se compone su saldo y cómo sale su ponderación
export function DesgloseBanco({ fecha, ranking, fila }) {
  const { meta } = useApp();
  const estado = useDatos(() => api.desglose(fecha, ranking, fila.codigo_banco), [fecha, ranking, fila.codigo_banco]);
  return (
    <>
      <div className="resumen-banco">
        <div><span>Posición</span><strong className="num">{fila.posicion}.º</strong></div>
        <div><span>Saldo de la actividad</span><strong className="num">{monto(fila.saldo_actividad)}</strong></div>
        <div><span>Cartera local válida del banco</span><strong className="num">{monto(fila.total_cartera)}</strong></div>
        <div><span>Ponderación</span><strong className="num">{pct(fila.ponderacion_pct)}</strong></div>
      </div>
      <p className="formula">
        Ponderación = {monto(fila.saldo_actividad)} ÷ {monto(fila.total_cartera)} × 100 = <strong>{pct(fila.ponderacion_pct)}</strong>
      </p>
      {fila.posicion_anterior != null && <AnatomiaBanco fecha={fecha} ranking={ranking} fila={fila} />}
      <Carga estado={estado} filas={4}>
        {(d) => {
          const filas = d.filas.filter((f) => f.codigo_banco === fila.codigo_banco);
          const suma = filas.reduce((s, f) => s + (num(f.saldo) || 0), 0);
          const reclasificadas = filas.reduce((s, f) => s + (f.reclasificadas_sb21 || 0), 0);
          return (
            <>
              <h3 className="titulo-seccion">Desglose por subactividad</h3>
              <Grafico opcion={opcionDesglose(filas, fila.codigo_banco)} alto={Math.max(160, filas.length * 46)} etiqueta="Saldo del banco por subactividad" />
              <table className="tabla tabla-compacta">
                <thead><tr><th scope="col">Subactividad</th><th scope="col" className="numerica">Saldo</th><th scope="col" className="numerica">%</th><th scope="col" className="numerica">Operaciones</th></tr></thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.subactividad}>
                      <td>{f.subactividad}</td>
                      <td className="numerica num">{monto(f.saldo)}</td>
                      <td className="numerica num">{suma ? `${((num(f.saldo) / suma) * 100).toFixed(2)} %` : '—'}</td>
                      <td className="numerica num">{entero(f.operaciones)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><th scope="row">Total (= saldo de la actividad)</th><th className="numerica num">{monto(fila.saldo_actividad)}</th><th /><th className="numerica num">{entero(fila.operaciones)}</th></tr>
                </tfoot>
              </table>
              {ranking === 'CONSUMO' && (
                <p className="nota-sb21">
                  <strong>Regla SB21:</strong> {reclasificadas > 0
                    ? `${entero(reclasificadas)} operaciones de Crédito personal con facilidad 07 (tarjeta de crédito) se reclasificaron a Tarjeta.`
                    : 'este banco no tuvo operaciones de Crédito personal con facilidad 07 para reclasificar.'}{' '}
                  El total de Consumo no cambia; solo se reparte distinto entre subactividades.
                </p>
              )}
              <p className="nota">{etiquetaPeriodo(fecha, meta)} · {tituloRanking(ranking, meta)} · banco {fila.codigo_banco}</p>
            </>
          );
        }}
      </Carga>
    </>
  );
}

export function Evolucion({ ranking, banco }) {
  const { meta } = useApp();
  const estado = useDatos(() => (ranking ? api.historia(ranking) : null), [ranking]);
  const titulo = tituloRanking(ranking, meta);
  return (
    <Carga estado={estado} filas={8}>
      {(h) => {
        if (h.periodos.length < 2) {
          return <Tarjeta titulo="Evolución"><p className="nota">Hace falta al menos dos períodos cargados para ver la evolución.</p></Tarjeta>;
        }
        const etiquetas = h.periodos.map((f) => etiquetaCorta(f, meta));
        return (
          <div className="rejilla-dos rejilla-evolucion">
            <Tarjeta titulo={`Posiciones en el tiempo · ${titulo}`} subtitulo="1.º arriba. Pasa el ratón por una línea para resaltar un banco." id="bump">
              <Grafico opcion={opcionPosiciones(etiquetas, h.bancos, { resaltado: banco || null })} alto={480} etiqueta={`Evolución de las posiciones en ${titulo}`} />
            </Tarjeta>
            <Tarjeta titulo="Posición por período" id="tabla-evolucion">
              <TablaOrdenable
                etiqueta="Posiciones por período" claveFila={(b) => b.codigo_banco}
                filaResaltada={(b) => b.codigo_banco === banco}
                ordenInicial={{ clave: `p${h.periodos.length - 1}`, asc: true }}
                columnas={[
                  { clave: 'banco', titulo: 'Banco', render: (b) => <NombreBanco codigo={b.codigo_banco} nombre={b.banco} /> },
                  ...h.periodos.map((f, i) => ({
                    clave: `p${i}`, titulo: etiquetas[i], numerica: true, valor: (b) => b.posiciones[i], render: (b) => `${b.posiciones[i]}.º`,
                  })),
                  {
                    clave: 'neto', titulo: 'Cambio total', numerica: true,
                    valor: (b) => b.posiciones[0] - b.posiciones[b.posiciones.length - 1],
                    render: (b) => { const c = b.posiciones[0] - b.posiciones[b.posiciones.length - 1]; return <span className={`cambio ${claseCambio(c)}`}>{cambioTexto(c)}</span>; },
                  },
                ]}
                filas={h.bancos}
              />
            </Tarjeta>
          </div>
        );
      }}
    </Carga>
  );
}

// ---------------------------------------------------------------------------------------------
// Anatomía del cambio: POR QUÉ cambió el saldo del banco entre el mes anterior y este.
// saldo anterior + préstamos nuevos − préstamos que terminaron + variación de los que siguen = saldo actual
const enM = (texto) => Math.round((num(texto) / 1e6) * 100) / 100;

function opcionCascada(a, etiquetaAntes, etiquetaAhora) {
  const A = num(a.saldo_anterior); const N = num(a.nuevos); const T = num(a.terminados); const V = num(a.variacion); const B = num(a.saldo_actual);
  const m = (x) => Math.round((x / 1e6) * 100) / 100;
  const pasos = [
    { nombre: `Saldo ${etiquetaAntes}`, base: 0, valor: A, color: '#0e7c86', texto: monto(a.saldo_anterior) },
    { nombre: `+ ${entero(a.n_nuevos)} nuevos`, base: A, valor: N, color: '#15803d', texto: `+${monto(a.nuevos)}` },
    { nombre: `− ${entero(a.n_terminados)} terminaron`, base: A + N - T, valor: T, color: '#dc2626', texto: `−${monto(a.terminados)}` },
    { nombre: `${entero(a.n_siguen)} siguen`, base: V < 0 ? A + N - T + V : A + N - T, valor: Math.abs(V), color: V < 0 ? '#f59e0b' : '#15803d', texto: `${V < 0 ? '−' : '+'}${monto(String(Math.abs(V)))}` },
    { nombre: `Saldo ${etiquetaAhora}`, base: 0, valor: B, color: '#5b4bdb', texto: monto(a.saldo_actual) },
  ];
  const minimo = Math.min(A, B, A + N - T + Math.min(0, V)) * 0.9;
  return {
    grid: { left: 8, right: 8, top: 26, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => { const d = pasos[p[0].dataIndex]; return `${d.nombre}<br/><b>${d.texto}</b>`; } },
    xAxis: { type: 'category', data: pasos.map((d) => d.nombre), axisLabel: { interval: 0, fontSize: 11 } },
    yAxis: { type: 'value', min: m(minimo), axisLabel: { formatter: (v) => `${v} M` } },
    series: [
      { type: 'bar', stack: 'c', silent: true, itemStyle: { color: 'transparent' }, data: pasos.map((d) => m(d.base)) },
      {
        type: 'bar', stack: 'c', barWidth: '56%',
        data: pasos.map((d) => ({ value: m(d.valor), itemStyle: { color: d.color, borderRadius: 6 } })),
        label: { show: true, position: 'top', fontSize: 11, color: '#334155', formatter: (p) => (p.dataIndex === 0 || p.dataIndex === 4 ? `${p.value} M` : pasos[p.dataIndex].texto.startsWith('−') ? `−${p.value} M` : `+${p.value} M`) },
      },
    ],
  };
}

export function AnatomiaBanco({ fecha, ranking, fila }) {
  const { meta } = useApp();
  const estado = useDatos(() => api.anatomia(fecha, ranking, fila.codigo_banco), [fecha, ranking, fila.codigo_banco]);
  return (
    <Carga estado={estado} filas={3}>
      {(d) => {
        const a = d.filas[0];
        if (!a) return null;
        const antes = etiquetaCorta(d.desde, meta);
        const ahora = etiquetaCorta(d.hasta, meta);
        const sube = num(a.saldo_actual) >= num(a.saldo_anterior);
        return (
          <section className="anatomia">
            <h3 className="titulo-seccion">¿Por qué cambió? <span className="anatomia-etiqueta">Anatomía del cambio · {antes} → {ahora}</span></h3>
            <p className="anatomia-frase">
              Su saldo {sube ? 'creció' : 'bajó'} de <strong>{enM(a.saldo_anterior)} M</strong> a <strong>{enM(a.saldo_actual)} M</strong>
              {a.var_saldo_pct != null && <> ({variacion(a.var_saldo_pct)})</>}: otorgó <strong>{entero(a.n_nuevos)} préstamos nuevos</strong> (+{enM(a.nuevos)} M),
              {' '}<strong>{entero(a.n_terminados)}</strong> terminaron o salieron (−{enM(a.terminados)} M) y los {entero(a.n_siguen)} que siguen
              {' '}{num(a.variacion) < 0 ? 'se amortizaron' : 'variaron'} {enM(a.variacion)} M.
            </p>
            <Grafico opcion={opcionCascada(a, antes, ahora)} alto={240} etiqueta="Cascada del cambio de saldo entre los dos meses" />
            <p className="nota anatomia-nota">
              {a.cuadra ? '✓ Cuadra al centavo: ' : ''}saldo anterior + nuevos − terminados + variación de los que siguen = saldo actual.
              {' '}Un préstamo «sigue» si tiene el mismo número, banco y actividad en ambos meses.
            </p>
          </section>
        );
      }}
    </Carga>
  );
}
