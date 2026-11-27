// Panel principal: resumen del período, líderes, composición, movimientos y mapa de especialización.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexto.jsx';
import { useApi, qs } from '../api.js';
import Grafico, { EJE_CATEGORIA, EJE_VALOR } from '../componentes/Grafico.jsx';
import { Aviso, Cargando, Cifra, Insignia, Tabla, Tarjeta } from '../componentes/Comunes.jsx';
import { AZUL, TINTA, dinero, escaparHtml, mes, millones, numero, pct } from '../formato.js';

const ICONO_DESTACADO = { lider: '★', sube: '▲', baja: '▼', saldo: '◆' };

export default function Panel() {
  const { fecha, ranking, meta } = useApp();
  const navegar = useNavigate();
  const panel = useApi(fecha ? `/panel${qs({ fecha })}` : null);
  const matriz = useApi(fecha ? `/matriz${qs({ fecha })}` : null);

  const opcionComposicion = useMemo(() => {
    if (!panel.datos) return null;
    const filas = [...panel.datos.composicion].reverse();
    return {
      grid: { left: 8, right: 70, top: 8, bottom: 8, containLabel: true },
      xAxis: { ...EJE_VALOR, axisLabel: { ...EJE_VALOR.axisLabel, formatter: (v) => `${v / 1e6} M` } },
      yAxis: { ...EJE_CATEGORIA, data: filas.map((f) => ranking(f.ranking)?.titulo ?? f.ranking) },
      tooltip: { trigger: 'item', formatter: (p) => `<b>${escaparHtml(p.name)}</b><br>${dinero(filas[p.dataIndex].saldo)}<br>${pct(filas[p.dataIndex].pct)} de la cartera local válida` },
      series: [{
        type: 'bar', barMaxWidth: 22, itemStyle: { color: AZUL[450], borderRadius: [0, 4, 4, 0] },
        data: filas.map((f) => Number(f.saldo)),
        label: { show: true, position: 'right', color: TINTA.secundaria, formatter: (p) => pct(filas[p.dataIndex].pct, 1) },
      }],
    };
  }, [panel.datos, ranking]);

  const opcionMapa = useMemo(() => {
    if (!matriz.datos) return null;
    const { rankings, bancos } = matriz.datos;
    const datos = [];
    bancos.forEach((b, y) => b.celdas.forEach((c, x) => datos.push([x, y, Number(c.ponderacion_pct), c.posicion])));
    return {
      grid: { left: 8, right: 16, top: 30, bottom: 50, containLabel: true },
      xAxis: { type: 'category', position: 'top', data: rankings.map((r) => ranking(r)?.titulo ?? r), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: TINTA.secundaria, interval: 0 } },
      yAxis: { type: 'category', inverse: true, data: bancos.map((b) => b.banco), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: TINTA.secundaria } },
      visualMap: {
        min: 0, max: Math.ceil(Math.max(...datos.map((d) => d[2])) / 5) * 5, calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
        inRange: { color: [AZUL[100], AZUL[300], AZUL[450], AZUL[650]] }, text: ['más concentrado', 'menos'], textStyle: { color: TINTA.tenue, fontSize: 11 },
        formatter: (v) => `${Math.round(v)} %`,
      },
      tooltip: {
        trigger: 'item',
        formatter: (p) => `<b>${escaparHtml(bancos[p.value[1]].banco)}</b> · ${escaparHtml(ranking(rankings[p.value[0]])?.titulo)}<br>Ponderación: ${p.value[2].toFixed(4)} % de su cartera<br>Saldo: ${dinero(bancos[p.value[1]].celdas[p.value[0]].saldo)}<br>Posición en el ranking: ${p.value[3]}.º`,
      },
      series: [{
        type: 'heatmap', data: datos, itemStyle: { borderColor: TINTA.superficie, borderWidth: 2, borderRadius: 3 },
        label: { show: true, fontSize: 11, formatter: (p) => p.value[2].toFixed(1), color: '#0b0b0b' },
        emphasis: { itemStyle: { borderColor: TINTA.primaria, borderWidth: 1 } },
      }],
    };
  }, [matriz.datos, ranking]);

  if (panel.error) return <Aviso error={panel.error} />;
  if (!panel.datos) return <Cargando />;
  const { kpis, lideres, destacados, indicadores } = panel.datos;
  const varOps = kpis.operaciones_anterior ? ((kpis.operaciones - kpis.operaciones_anterior) / kpis.operaciones_anterior) * 100 : null;

  return (
    <>
      <div className="titulo-pagina">
        <h1>Panel principal</h1>
        <p>Resumen de la cartera de crédito local válida de los {kpis.bancos} bancos a {mes(panel.datos.fecha)}{panel.datos.fecha_anterior ? `, comparada con ${mes(panel.datos.fecha_anterior)}` : ''}.</p>
      </div>

      <div className="rejilla-cifras">
        <Cifra etiqueta="Cartera local válida" valor={millones(kpis.cartera_total)} delta={kpis.var_cartera_pct} detalle={kpis.var_cartera_pct ? 'vs. mes anterior' : ''} />
        <Cifra etiqueta="Operaciones válidas" valor={numero(kpis.operaciones)} delta={varOps} detalle={varOps !== null ? 'vs. mes anterior' : ''} />
        <Cifra etiqueta="Filas excluidas por calidad" valor={numero(kpis.excluidas)} detalle={`${pct(kpis.pct_excluidas)} de ${numero(kpis.filas_leidas)} filas leídas`} />
        <Cifra etiqueta="Morosidad (saldo con días de mora)" valor={pct(indicadores.morosidad_pct)} detalle={`más de 90 días: ${pct(indicadores.mora90_pct)}`} />
      </div>

      <Tarjeta titulo="Líder de cada ranking" subtitulo="Banco con mayor saldo en cada actividad. «Cuota» = su parte del total del sector.">
        <div className="rejilla-lideres">
          {lideres.map((l) => {
            const r = ranking(l.ranking);
            const nuevo = l.lider_anterior && l.lider_anterior.codigo_banco !== l.codigo_banco;
            return (
              <button type="button" key={l.ranking} className="lider" onClick={() => navegar(`/rankings?ranking=${l.ranking}`)}>
                <span className="lider-cab">{r?.titulo} <Insignia tipo={r?.tipo}>{r?.tipo}</Insignia></span>
                <strong>{l.banco}</strong>
                <span className="lider-dato">{millones(l.saldo)} · cuota {pct(l.participacion_pct, 1)}</span>
                {nuevo ? <Insignia tipo="nuevo">★ Nuevo líder (antes {l.lider_anterior.banco})</Insignia>
                  : l.lider_anterior ? <span className="tenue chico">Mantiene el liderazgo</span> : null}
              </button>
            );
          })}
        </div>
      </Tarjeta>

      <div className="dos-columnas">
        <Tarjeta
          titulo="Composición de la cartera por actividad"
          subtitulo="Saldo total del sistema en cada ranking y su peso en la cartera local válida."
          tabla={<Tabla compacta columnas={[
            { clave: 'ranking', titulo: 'Actividad', render: (f) => ranking(f.ranking)?.titulo },
            { clave: 'saldo', titulo: 'Saldo', num: true, render: (f) => dinero(f.saldo), orden: (f) => Number(f.saldo) },
            { clave: 'pct', titulo: '% de la cartera', num: true, render: (f) => pct(f.pct, 4), orden: (f) => Number(f.pct) },
          ]} filas={panel.datos.composicion} />}
        >
          {opcionComposicion && <Grafico opcion={opcionComposicion} alto={260} descripcion="Barras horizontales con el saldo total por actividad económica" />}
        </Tarjeta>

        <Tarjeta titulo="Movimientos destacados" subtitulo={panel.datos.fecha_anterior ? `Explicación automática de los cambios frente a ${mes(panel.datos.fecha_anterior)}.` : 'Se mostrarán al cargar un segundo período.'}>
          {destacados.length === 0 && <p className="tenue">Sin movimientos significativos según la regla vigente.</p>}
          <ul className="lista-destacados">
            {destacados.map((d) => (
              <li key={`${d.ranking}-${d.codigo_banco}`} className={`destacado tipo-${d.tipo}`}>
                <span className="destacado-icono" aria-hidden="true">{ICONO_DESTACADO[d.tipo]}</span>
                <span>{d.texto}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Mapa de especialización"
        subtitulo="Ponderación oficial: qué porcentaje de la cartera de cada banco está en cada actividad. Haga clic en una celda para ver ese ranking."
        tabla={matriz.datos && (
          <Tabla compacta columnas={[
            { clave: 'banco', titulo: 'Banco' },
            ...matriz.datos.rankings.map((r, k) => ({ clave: r, titulo: ranking(r)?.titulo, num: true, render: (f) => pct(f.celdas[k].ponderacion_pct, 4), orden: (f) => Number(f.celdas[k].ponderacion_pct) })),
          ]} filas={matriz.datos.bancos} claveFila={(f) => f.codigo_banco} />
        )}
      >
        {matriz.error && <Aviso error={matriz.error} />}
        {opcionMapa && (
          <Grafico
            opcion={opcionMapa} alto={460} descripcion="Mapa de calor de bancos por actividad con la ponderación de cada uno"
            alClic={(p) => navegar(`/rankings?ranking=${matriz.datos.rankings[p.value[0]]}&banco=${matriz.datos.bancos[p.value[1]].codigo_banco}`)}
          />
        )}
      </Tarjeta>

      <Tarjeta titulo="Concentración de cada mercado" subtitulo="Índice Herfindahl-Hirschman (HHI, 0–10 000) sobre las cuotas de los 12 bancos. Menos de 1 500: baja; 1 500–2 500: moderada; más de 2 500: alta. Indicador adicional, no oficial.">
        <Tabla compacta columnas={[
          { clave: 'ranking', titulo: 'Actividad', render: (f) => ranking(f.ranking)?.titulo },
          { clave: 'hhi', titulo: 'HHI', num: true, render: (f) => numero(f.hhi) },
          { clave: 'nivel', titulo: 'Concentración', render: (f) => <Insignia tipo={`conc-${f.nivel}`}>{f.nivel}</Insignia> },
          { clave: 'top3_pct', titulo: 'Cuota de los 3 mayores', num: true, render: (f) => pct(f.top3_pct, 1), orden: (f) => Number(f.top3_pct) },
        ]} filas={indicadores.concentracion} />
        <p className="nota">Operaciones de Crédito personal con facilidad 07 reclasificadas a Tarjeta (regla SB21) en {mes(panel.datos.fecha)}: <b>{numero(indicadores.reclasificadas_sb21)}</b>. Total de períodos disponibles: {meta.periodos.length}.</p>
      </Tarjeta>
    </>
  );
}
