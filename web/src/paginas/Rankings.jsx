// Consulta de rankings: período (arriba), ranking, banco y subactividad; gráfico, tabla ordenable y desglose.
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../contexto.jsx';
import { useApi, qs, urlExportar } from '../api.js';
import Grafico, { EJE_CATEGORIA, EJE_VALOR } from '../componentes/Grafico.jsx';
import { Aviso, BotonDescarga, Cambio, Cargando, Insignia, Selector, Tabla, Tarjeta } from '../componentes/Comunes.jsx';
import { AZUL, SERIES, TINTA, dinero, escaparHtml, mes, millones, numero, pct, pctSigno } from '../formato.js';

export default function Rankings() {
  const { meta, fecha, ranking: buscarRanking } = useApp();
  const [params, setParams] = useSearchParams();
  const nombre = params.get('ranking') ?? meta.rankings[0].nombre;
  const banco = params.get('banco');
  const sub = params.get('sub');
  const r = buscarRanking(nombre) ?? meta.rankings[0];
  const cambiar = (k, v) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    if (k === 'ranking') p.delete('sub');
    setParams(p, { replace: true });
  };

  const rk = useApi(fecha ? `/rankings${qs({ fecha, ranking: r.nombre })}` : null);
  const dg = useApi(fecha ? `/desglose${qs({ fecha, ranking: r.nombre })}` : null);

  // Filas a graficar: el ranking oficial o, si se filtra una subactividad, el saldo de esa subactividad
  const barras = useMemo(() => {
    if (!rk.datos) return [];
    if (!sub || !dg.datos) return rk.datos.filas.map((f) => ({ codigo: f.codigo_banco, banco: f.banco, saldo: f.saldo_actividad, posicion: f.posicion }));
    return dg.datos.filas.filter((d) => d.subactividad === sub)
      .map((d) => ({ codigo: d.codigo_banco, banco: d.banco, saldo: d.saldo }))
      .sort((a, b) => Number(b.saldo) - Number(a.saldo) || a.codigo.localeCompare(b.codigo))
      .map((d, i) => ({ ...d, posicion: i + 1 }));
  }, [rk.datos, dg.datos, sub]);

  const opcionBarras = useMemo(() => {
    if (!barras.length) return null;
    const filas = [...barras].reverse();
    return {
      grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
      xAxis: { ...EJE_VALOR, axisLabel: { ...EJE_VALOR.axisLabel, formatter: (v) => `${v / 1e6} M` } },
      yAxis: { ...EJE_CATEGORIA, data: filas.map((f) => `${f.posicion}. ${f.banco}`) },
      tooltip: { trigger: 'item', formatter: (p) => `<b>${escaparHtml(filas[p.dataIndex].banco)}</b> (${filas[p.dataIndex].codigo})<br>Posición ${filas[p.dataIndex].posicion}<br>Saldo: ${dinero(filas[p.dataIndex].saldo)}` },
      series: [{
        type: 'bar', barMaxWidth: 20,
        data: filas.map((f) => ({ value: Number(f.saldo), itemStyle: { color: !banco || f.codigo === banco ? AZUL[450] : AZUL[150], borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: 'right', color: TINTA.secundaria, fontSize: 11, formatter: (p) => millones(filas[p.dataIndex].saldo) },
      }],
    };
  }, [barras, banco]);

  const opcionDesglose = useMemo(() => {
    if (!dg.datos || !rk.datos) return null;
    const orden = [...rk.datos.filas].reverse(); // mismo orden que el ranking (líder arriba)
    const subs = r.subactividades;
    return {
      legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, textStyle: { color: TINTA.secundaria } },
      grid: { left: 8, right: 16, top: subs.length > 3 ? 56 : 32, bottom: 8, containLabel: true },
      xAxis: { ...EJE_VALOR, axisLabel: { ...EJE_VALOR.axisLabel, formatter: (v) => `${v / 1e6} M` } },
      yAxis: { ...EJE_CATEGORIA, data: orden.map((f) => f.banco) },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (ps) => `<b>${escaparHtml(ps[0].name)}</b><br>${ps.map((p) => `${p.marker}${escaparHtml(p.seriesName)}: ${dinero(p.value)}`).join('<br>')}`,
      },
      series: subs.map((s, k) => ({
        name: s, type: 'bar', stack: 'total', barMaxWidth: 20,
        itemStyle: { color: SERIES[k], borderColor: TINTA.superficie, borderWidth: 1 },
        emphasis: { focus: 'series' },
        data: orden.map((f) => Number(dg.datos.filas.find((d) => d.codigo_banco === f.codigo_banco && d.subactividad === s)?.saldo ?? 0)),
      })),
    };
  }, [dg.datos, rk.datos, r.subactividades]);

  const tablaDesglose = dg.datos && (
    <Tabla compacta claveFila={(f) => `${f.codigo_banco}-${f.subactividad}`} resaltar={(f) => f.codigo_banco === banco}
      columnas={[
        { clave: 'banco', titulo: 'Banco' },
        { clave: 'subactividad', titulo: 'Subactividad' },
        { clave: 'saldo', titulo: 'Saldo', num: true, render: (f) => dinero(f.saldo), orden: (f) => Number(f.saldo) },
        { clave: 'operaciones', titulo: 'Operaciones', num: true, render: (f) => numero(f.operaciones) },
        ...(r.nombre === 'CONSUMO' ? [{ clave: 'reclasificadas_sb21', titulo: 'Reclasificadas SB21', num: true }] : []),
      ]}
      filas={dg.datos.filas.filter((d) => (!sub || d.subactividad === sub) && (!banco || d.codigo_banco === banco))}
    />
  );
  const reclasificadas = r.nombre === 'CONSUMO' && dg.datos ? dg.datos.filas.reduce((t, d) => t + d.reclasificadas_sb21, 0) : 0;

  return (
    <>
      <div className="titulo-pagina">
        <h1>Rankings de crédito</h1>
        <p>Bancos ordenados por saldo de la actividad en {mes(fecha)}. Empates exactos: por código de banco ascendente. Siempre se muestran los 12 bancos.</p>
      </div>

      <div className="pestanas" role="tablist" aria-label="Ranking">
        {meta.rankings.map((x) => (
          <button key={x.nombre} type="button" role="tab" aria-selected={x.nombre === r.nombre} className={x.nombre === r.nombre ? 'activa' : ''} onClick={() => cambiar('ranking', x.nombre)}>
            {x.titulo} <Insignia tipo={x.tipo}>{x.tipo}</Insignia>
          </button>
        ))}
      </div>

      <div className="barra-filtros">
        <Selector id="f-banco" etiqueta="Resaltar banco" valor={banco} onChange={(v) => cambiar('banco', v)} todos="Ninguno" opciones={meta.bancos.map((b) => ({ valor: b.codigo, texto: `${b.nombre} (${b.codigo})` }))} />
        <Selector id="f-sub" etiqueta="Subactividad" valor={sub} onChange={(v) => cambiar('sub', v)} todos="Todas (ranking oficial)" opciones={r.subactividades.map((s) => ({ valor: s, texto: s }))} />
        <div className="filtros-der">
          <BotonDescarga chico href={urlExportar('rankings', { fecha, ranking: r.nombre })}>Ranking (CSV)</BotonDescarga>
          <BotonDescarga chico href={urlExportar('desglose', { fecha, ranking: r.nombre })}>Desglose (CSV)</BotonDescarga>
        </div>
      </div>

      {rk.error && <Aviso error={rk.error} />}
      {!rk.datos ? <Cargando /> : (
        <>
          <div className="dos-columnas ancha-izq">
            <Tarjeta
              titulo={sub ? `${r.titulo} · ${sub}` : `Ranking ${r.titulo}`}
              subtitulo={sub ? 'Orden por saldo de la subactividad elegida (vista de exploración; el ranking oficial es por actividad).' : `Total del sector: ${dinero(rk.datos.total_ranking)}`}
              tabla={<Tabla compacta columnas={[
                { clave: 'posicion', titulo: 'Pos.', num: true },
                { clave: 'banco', titulo: 'Banco' },
                { clave: 'saldo', titulo: 'Saldo', num: true, render: (f) => dinero(f.saldo), orden: (f) => Number(f.saldo) },
              ]} filas={barras} claveFila={(f) => f.codigo} />}
            >
              {opcionBarras && <Grafico opcion={opcionBarras} alto={400} descripcion={`Barras con el saldo de cada banco en ${r.titulo}`} />}
            </Tarjeta>
            <Tarjeta titulo="Cómo leer este ranking">
              <dl className="definiciones">
                <dt>Saldo de la actividad</dt><dd>Suma del saldo de capital de los préstamos válidos del banco clasificados en {r.titulo} por el catálogo CINU.</dd>
                <dt>Ponderación (oficial)</dt><dd>Saldo de la actividad ÷ total de cartera local válida <i>del banco</i> × 100. Mide cuánto pesa {r.titulo} dentro de ese banco.</dd>
                <dt>Cuota</dt><dd>Saldo del banco ÷ saldo de todo el sector. Mide su peso en el mercado (indicador adicional).</dd>
                <dt>Subactividades</dt><dd>{r.subactividades.join(' · ')}</dd>
                {r.nombre === 'CONSUMO' && <><dt>Regla SB21</dt><dd>Los créditos personales con facilidad 07 son tarjetas: se cuentan en Tarjeta ({numero(reclasificadas)} operaciones este mes). El total de Consumo no cambia.</dd></>}
              </dl>
            </Tarjeta>
          </div>

          <Tarjeta titulo={`Tabla del ranking ${r.titulo}`} subtitulo={rk.datos.fecha_anterior ? `«Cambio» compara con ${mes(rk.datos.fecha_anterior)} (positivo = sube).` : 'Primer período disponible: sin comparación.'}>
            <Tabla
              claveFila={(f) => f.codigo_banco} resaltar={(f) => f.codigo_banco === banco}
              inicial={{ clave: 'posicion', asc: true }}
              columnas={[
                { clave: 'posicion', titulo: 'Posición', num: true },
                { clave: 'cambio', titulo: 'Cambio', num: true, render: (f) => <Cambio valor={f.cambio} /> },
                { clave: 'banco', titulo: 'Banco', render: (f) => <>{f.banco} <span className="tenue chico">{f.codigo_banco}</span></> },
                { clave: 'saldo_actividad', titulo: 'Saldo de la actividad', num: true, render: (f) => dinero(f.saldo_actividad), orden: (f) => Number(f.saldo_actividad) },
                { clave: 'total_cartera', titulo: 'Total cartera local válida', num: true, render: (f) => dinero(f.total_cartera), orden: (f) => Number(f.total_cartera) },
                { clave: 'ponderacion_pct', titulo: 'Ponderación', num: true, render: (f) => pct(f.ponderacion_pct, 4), orden: (f) => Number(f.ponderacion_pct) },
                { clave: 'participacion_pct', titulo: 'Cuota', num: true, render: (f) => pct(f.participacion_pct, 2), orden: (f) => Number(f.participacion_pct) },
                { clave: 'operaciones', titulo: 'Operaciones', num: true, render: (f) => numero(f.operaciones) },
                { clave: 'var_saldo_pct', titulo: 'Var. saldo', num: true, render: (f) => pctSigno(f.var_saldo_pct), orden: (f) => (f.var_saldo_pct === null ? null : Number(f.var_saldo_pct)) },
              ]}
              filas={rk.datos.filas}
            />
          </Tarjeta>

          <Tarjeta titulo={`Desglose por subactividad · ${r.titulo}`} subtitulo="Cada barra suma exactamente el saldo de la actividad del banco (reconciliación 1)." tabla={tablaDesglose}>
            {dg.error && <Aviso error={dg.error} />}
            {opcionDesglose ? <Grafico opcion={opcionDesglose} alto={440} descripcion="Barras apiladas por subactividad para cada banco" /> : <Cargando />}
          </Tarjeta>
        </>
      )}
    </>
  );
}
