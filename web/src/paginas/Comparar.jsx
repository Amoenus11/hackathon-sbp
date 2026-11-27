// Comparación entre períodos y entidades (perfil analista): movimientos, explicaciones, trayectorias.
import { useMemo, useState } from 'react';
import { useApp } from '../contexto.jsx';
import { useApi, qs, urlExportar } from '../api.js';
import Grafico, { EJE_CATEGORIA, EJE_VALOR } from '../componentes/Grafico.jsx';
import { Aviso, BotonDescarga, Cambio, Cargando, Insignia, Selector, Tabla, Tarjeta } from '../componentes/Comunes.jsx';
import { SERIES, TINTA, dinero, escaparHtml, mes, mesCorto, millones, pct, pctSigno } from '../formato.js';

export default function Comparar() {
  const { meta, fecha, ranking, anterior } = useApp();
  const fechas = meta.periodos.map((p) => p.fecha);
  const [hasta, setHasta] = useState(fecha ?? meta.ultimo);
  const [desde, setDesde] = useState(anterior(fecha ?? meta.ultimo) ?? fechas[0]);
  const [filtroRanking, setFiltroRanking] = useState(null);
  const [soloSig, setSoloSig] = useState(true);
  const [bancoA, setBancoA] = useState(meta.bancos[0]?.codigo);
  const [bancoB, setBancoB] = useState(meta.bancos[1]?.codigo);
  const [rankingHist, setRankingHist] = useState(meta.rankings[0].nombre);
  const [resaltados, setResaltados] = useState([]);

  const valido = desde && hasta && desde < hasta;
  const mov = useApi(valido ? `/movimientos${qs({ desde, hasta, ranking: filtroRanking })}` : null);
  const hist = useApi(`/historia${qs({ ranking: rankingHist })}`);
  const mz = useApi(`/matriz${qs({ fecha: hasta })}`);

  const filas = useMemo(() => (mov.datos?.filas ?? []).filter((f) => !soloSig || f.significativo), [mov.datos, soloSig]);

  // Trayectoria de posiciones (bump chart): bancos resaltados en color; el resto en gris
  const opcionTrayectoria = useMemo(() => {
    if (!hist.datos || hist.datos.periodos.length < 1) return null;
    const ultimo = hist.datos.periodos.length - 1;
    const top = [...hist.datos.bancos].sort((a, b) => a.posiciones[ultimo] - b.posiciones[ultimo]).slice(0, 3).map((b) => b.codigo_banco);
    const elegidos = resaltados.length ? resaltados : top;
    const fondo = hist.datos.bancos.filter((b) => !elegidos.includes(b.codigo_banco));
    const frente = elegidos.map((c) => hist.datos.bancos.find((b) => b.codigo_banco === c)).filter(Boolean);
    const linea = (b, color, z, ancho) => ({
      name: b.banco, type: 'line', z, data: b.posiciones, symbol: 'circle', symbolSize: z > 2 ? 9 : 5,
      lineStyle: { width: ancho, color }, itemStyle: { color, borderColor: TINTA.superficie, borderWidth: 2 },
      endLabel: { show: z > 2, formatter: () => b.banco, color: TINTA.primaria, fontSize: 12 },
      emphasis: { focus: 'series' },
    });
    return {
      legend: { show: frente.length > 1, top: 0, left: 0, data: frente.map((b) => b.banco), textStyle: { color: TINTA.secundaria } },
      grid: { left: 8, right: 150, top: 36, bottom: 8, containLabel: true },
      xAxis: { ...EJE_CATEGORIA, boundaryGap: false, data: hist.datos.periodos.map(mesCorto) },
      yAxis: { ...EJE_VALOR, inverse: true, min: 1, max: 12, interval: 1, name: 'Posición', nameTextStyle: { color: TINTA.tenue } },
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const b = hist.datos.bancos.find((x) => x.banco === p.seriesName);
          return `<b>${escaparHtml(b.banco)}</b> · ${mes(hist.datos.periodos[p.dataIndex])}<br>Posición ${b.posiciones[p.dataIndex]}.º<br>Saldo ${dinero(b.saldos[p.dataIndex])}`;
        },
      },
      series: [
        ...fondo.map((b) => linea(b, TINTA.gris, 1, 1.5)),
        ...frente.map((b, k) => linea(b, SERIES[k], 3, 2.5)),
      ],
    };
  }, [hist.datos, resaltados]);

  // Comparación de dos entidades: saldo por actividad en el período «hasta» (dos series)
  const opcionEntidades = useMemo(() => {
    if (!mz.datos) return null;
    const a = mz.datos.bancos.find((b) => b.codigo_banco === bancoA);
    const b = mz.datos.bancos.find((x) => x.codigo_banco === bancoB);
    if (!a || !b) return null;
    const cats = mz.datos.rankings.map((r) => ranking(r)?.titulo ?? r);
    const serie = (x, k) => ({
      name: x.banco, type: 'bar', barMaxWidth: 18, barGap: '15%', itemStyle: { color: SERIES[k], borderRadius: [4, 4, 0, 0] },
      data: x.celdas.map((c) => Number(c.saldo)),
    });
    return {
      legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 12, textStyle: { color: TINTA.secundaria } },
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      xAxis: { ...EJE_CATEGORIA, data: cats },
      yAxis: { ...EJE_VALOR, axisLabel: { ...EJE_VALOR.axisLabel, formatter: (v) => `${v / 1e6} M` } },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (ps) => `<b>${escaparHtml(ps[0].name)}</b><br>${ps.map((p) => {
          const x = p.seriesIndex === 0 ? a : b;
          const c = x.celdas[p.dataIndex];
          return `${p.marker}${escaparHtml(x.banco)}: ${dinero(c.saldo)} · ${c.posicion}.º · pond. ${pct(c.ponderacion_pct, 2)}`;
        }).join('<br>')}`,
      },
      series: [serie(a, 0), serie(b, 1)],
    };
  }, [mz.datos, bancoA, bancoB, ranking]);

  const alternar = (codigo) => setResaltados((r) => (r.includes(codigo) ? r.filter((c) => c !== codigo) : [...r, codigo].slice(-3)));
  const opcionesPeriodo = meta.periodos.map((p) => ({ valor: p.fecha, texto: p.etiqueta }));

  return (
    <>
      <div className="titulo-pagina">
        <h1>Comparar períodos y entidades</h1>
        <p>Cambio de posición = posición anterior − posición actual (positivo = sube). La regla de «movimiento significativo» la define el administrador.</p>
      </div>

      <div className="barra-filtros">
        <Selector id="c-desde" etiqueta="Desde" valor={desde} onChange={setDesde} opciones={opcionesPeriodo} />
        <Selector id="c-hasta" etiqueta="Hasta" valor={hasta} onChange={setHasta} opciones={opcionesPeriodo} />
        <Selector id="c-rk" etiqueta="Ranking" valor={filtroRanking} onChange={setFiltroRanking} todos="Todos" opciones={meta.rankings.map((r) => ({ valor: r.nombre, texto: r.titulo }))} />
        <label className="interruptor"><input type="checkbox" checked={soloSig} onChange={(e) => setSoloSig(e.target.checked)} /> Solo movimientos significativos</label>
        <div className="filtros-der">
          {valido && <BotonDescarga chico href={urlExportar('movimientos', { desde, hasta, ranking: filtroRanking, significativos: soloSig ? '1' : '' })}>Movimientos (CSV)</BotonDescarga>}
        </div>
      </div>

      {!valido && <Aviso tipo="info">Elija un período «desde» anterior a «hasta». Hace falta tener al menos dos períodos cargados.</Aviso>}
      {mov.error && <Aviso error={mov.error} />}
      {valido && !mov.datos && <Cargando />}
      {mov.datos && (
        <>
          <Tarjeta titulo={`Qué cambió de ${mes(mov.datos.desde)} a ${mes(mov.datos.hasta)}`} subtitulo={`Regla vigente: |cambio| ≥ ${mov.datos.regla.mov_min_posiciones} posiciones${mov.datos.regla.mov_cambio_lider ? ', cambio de líder' : ''} o variación de saldo ≥ ${mov.datos.regla.mov_var_saldo_pct} %. Explicaciones generadas automáticamente, sin IA.`}>
            {mov.datos.detalle.length === 0 ? <p className="tenue">No hay movimientos significativos con la regla vigente.</p> : (
              <ul className="lista-destacados">
                {mov.datos.detalle.slice(0, 10).map((d) => (
                  <li key={`${d.ranking}-${d.codigo_banco}`} className={`destacado tipo-${d.tipo}`}>
                    <span className="destacado-icono" aria-hidden="true">{{ lider: '★', sube: '▲', baja: '▼', saldo: '◆' }[d.tipo]}</span>
                    <span>{d.texto}</span>
                  </li>
                ))}
              </ul>
            )}
            {mov.datos.detalle.length > 10 && <p className="nota">… y {mov.datos.detalle.length - 10} más en la tabla.</p>}
          </Tarjeta>

          <Tarjeta titulo={`Movimientos de posición (${filas.length})`}>
            <Tabla
              claveFila={(f) => `${f.ranking}-${f.codigo_banco}`}
              inicial={{ clave: 'cambio', asc: false }}
              columnas={[
                { clave: 'ranking', titulo: 'Ranking', render: (f) => ranking(f.ranking)?.titulo },
                { clave: 'banco', titulo: 'Banco' },
                { clave: 'posicion_anterior', titulo: `Pos. ${mesCorto(mov.datos.desde)}`, num: true },
                { clave: 'posicion_actual', titulo: `Pos. ${mesCorto(mov.datos.hasta)}`, num: true },
                { clave: 'cambio', titulo: 'Cambio', num: true, render: (f) => <Cambio valor={f.cambio} /> },
                { clave: 'saldo_anterior', titulo: 'Saldo anterior', num: true, render: (f) => millones(f.saldo_anterior), orden: (f) => Number(f.saldo_anterior) },
                { clave: 'saldo_actual', titulo: 'Saldo actual', num: true, render: (f) => millones(f.saldo_actual), orden: (f) => Number(f.saldo_actual) },
                { clave: 'var_saldo_pct', titulo: 'Var. saldo', num: true, render: (f) => pctSigno(f.var_saldo_pct), orden: (f) => (f.var_saldo_pct === null ? null : Number(f.var_saldo_pct)) },
                { clave: 'motivos', titulo: 'Por qué es significativo', render: (f) => (f.motivos.length ? f.motivos.map((m) => <Insignia key={m} tipo={/líder/i.test(m) ? 'nuevo' : ''}>{m}</Insignia>) : <span className="tenue">—</span>), orden: (f) => f.motivos.length },
              ]}
              filas={filas}
              vacia="No hay movimientos con estos filtros."
            />
          </Tarjeta>
        </>
      )}

      <div className="dos-columnas">
        <Tarjeta
          titulo="Trayectoria de posiciones"
          subtitulo="Posición de cada banco en todos los períodos. Por defecto se resaltan los 3 primeros; elija hasta 3 bancos para seguirlos."
          acciones={<Selector id="c-hist" etiqueta="Ranking" valor={rankingHist} onChange={(v) => v && setRankingHist(v)} opciones={meta.rankings.map((r) => ({ valor: r.nombre, texto: r.titulo }))} />}
          tabla={hist.datos && (
            <Tabla compacta claveFila={(f) => f.codigo_banco} columnas={[
              { clave: 'banco', titulo: 'Banco' },
              ...hist.datos.periodos.map((p, k) => ({ clave: p, titulo: mesCorto(p), num: true, render: (f) => `${f.posiciones[k]}.º`, orden: (f) => f.posiciones[k] })),
            ]} filas={hist.datos.bancos} />
          )}
        >
          <div className="chips" role="group" aria-label="Bancos a resaltar">
            {meta.bancos.map((b) => (
              <button key={b.codigo} type="button" className={`chip ${resaltados.includes(b.codigo) ? 'activo' : ''}`} aria-pressed={resaltados.includes(b.codigo)} onClick={() => alternar(b.codigo)}>
                {resaltados.includes(b.codigo) && <span className="punto" style={{ background: SERIES[resaltados.indexOf(b.codigo)] }} />}{b.nombre.replace('Banco ', '')}
              </button>
            ))}
          </div>
          {opcionTrayectoria ? <Grafico opcion={opcionTrayectoria} alto={360} descripcion="Líneas con la posición de cada banco a lo largo de los períodos" /> : <Cargando />}
        </Tarjeta>

        <Tarjeta
          titulo="Comparar dos entidades"
          subtitulo={`Saldo por actividad en ${mes(hasta)}.`}
          acciones={<>
            <Selector id="c-a" etiqueta="Banco A" valor={bancoA} onChange={(v) => v && setBancoA(v)} opciones={meta.bancos.map((b) => ({ valor: b.codigo, texto: b.nombre }))} />
            <Selector id="c-b" etiqueta="Banco B" valor={bancoB} onChange={(v) => v && setBancoB(v)} opciones={meta.bancos.map((b) => ({ valor: b.codigo, texto: b.nombre }))} />
          </>}
          tabla={mz.datos && (
            <Tabla compacta columnas={[
              { clave: 'ranking', titulo: 'Actividad' },
              { clave: 'a', titulo: meta.bancos.find((b) => b.codigo === bancoA)?.nombre, num: true },
              { clave: 'b', titulo: meta.bancos.find((b) => b.codigo === bancoB)?.nombre, num: true },
            ]} filas={mz.datos.rankings.map((r, k) => {
              const fa = mz.datos.bancos.find((b) => b.codigo_banco === bancoA)?.celdas[k];
              const fb = mz.datos.bancos.find((b) => b.codigo_banco === bancoB)?.celdas[k];
              return { ranking: ranking(r)?.titulo, a: fa ? `${dinero(fa.saldo)} (${fa.posicion}.º)` : '—', b: fb ? `${dinero(fb.saldo)} (${fb.posicion}.º)` : '—' };
            })} />
          )}
        >
          {opcionEntidades ? <Grafico opcion={opcionEntidades} alto={360} descripcion="Columnas agrupadas con el saldo por actividad de dos bancos" /> : <Cargando />}
        </Tarjeta>
      </div>
    </>
  );
}
