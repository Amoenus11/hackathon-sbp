// Reportes personalizados: el analista elige período, comparación, rankings, bancos y secciones;
// se arma una hoja A4 lista para imprimir o guardar como PDF, y los CSV correspondientes.
import { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import { BotonDescarga, Campo, EncabezadoPagina, PuntoBanco, Tarjeta } from '../componentes/Comunes.jsx';
import { EstadoError, Esqueleto } from '../componentes/Estados.jsx';
import Grafico from '../componentes/Grafico.jsx';
import { opcionComposicion } from '../graficos.js';
import { PERFILES } from '../permisos.js';
import {
  cambioTexto, entero, etiquetaPeriodo, fechaCorte, fechaHora, monto, montoCorto, pct, tituloRanking, variacion,
} from '../formato.js';

const SECCIONES = [
  { id: 'resumen', texto: 'Resumen ejecutivo' },
  { id: 'rankings', texto: 'Rankings' },
  { id: 'desglose', texto: 'Desglose por subactividad' },
  { id: 'movimientos', texto: 'Movimientos de posición' },
  { id: 'calidad', texto: 'Calidad de datos' },
];

export default function Reportes() {
  const { meta, fecha, fechaAnterior, sesion } = useApp();
  const [periodo, setPeriodo] = useState(fecha);
  const [comparar, setComparar] = useState(fechaAnterior || '');
  const [rankings, setRankings] = useState(meta.rankings.map((r) => r.nombre));
  const [bancos, setBancos] = useState([]); // vacío = todos
  const [secciones, setSecciones] = useState(['resumen', 'rankings', 'movimientos', 'calidad']);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const alternar = (lista, setLista, valor) => setLista(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);

  async function generar() {
    setCargando(true);
    setError(null);
    try {
      const quiere = (s) => secciones.includes(s);
      const [panel, tablas, desgloses, movs, calidad] = await Promise.all([
        quiere('resumen') ? api.panel(periodo) : null,
        quiere('rankings') ? Promise.all(rankings.map((r) => api.rankings(periodo, r))) : null,
        quiere('desglose') ? Promise.all(rankings.map((r) => api.desglose(periodo, r))) : null,
        quiere('movimientos') && comparar && comparar < periodo ? api.movimientos({ desde: comparar, hasta: periodo }) : null,
        quiere('calidad') ? api.calidad(periodo) : null,
      ]);
      setReporte({
        periodo, comparar: comparar && comparar < periodo ? comparar : null, rankings: [...rankings], bancos: [...bancos],
        secciones: [...secciones], panel, tablas, desgloses, movs, calidad, generado: new Date().toISOString(),
      });
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <EncabezadoPagina titulo="Reportes personalizados" subtitulo="Arma tu reporte, revísalo y guárdalo como PDF o descarga los CSV" />
      <div className="rejilla-reportes">
        <Tarjeta titulo="Configuración" className="formulario-reporte no-imprimir" id="config-reporte">
          <div className="formulario">
            <Campo etiqueta="Período del reporte">
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                {meta.periodos.map((p) => <option key={p.fecha} value={p.fecha}>{p.etiqueta}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Comparar con">
              <select value={comparar} onChange={(e) => setComparar(e.target.value)}>
                <option value="">Sin comparación</option>
                {meta.periodos.filter((p) => p.fecha < periodo).map((p) => <option key={p.fecha} value={p.fecha}>{p.etiqueta}</option>)}
              </select>
            </Campo>
            <fieldset className="grupo-casillas">
              <legend>Rankings</legend>
              {meta.rankings.map((r) => (
                <label key={r.nombre} className="casilla">
                  <input type="checkbox" checked={rankings.includes(r.nombre)} onChange={() => alternar(rankings, setRankings, r.nombre)} />
                  {r.titulo}
                </label>
              ))}
            </fieldset>
            <fieldset className="grupo-casillas">
              <legend>Bancos {bancos.length === 0 ? '(todos)' : `(${bancos.length})`}</legend>
              <div className="chips chips-compactas">
                {meta.bancos.map((b) => (
                  <button key={b.codigo} type="button" className={`chip ${bancos.includes(b.codigo) ? 'activo' : ''}`} aria-pressed={bancos.includes(b.codigo)} onClick={() => alternar(bancos, setBancos, b.codigo)}>
                    <PuntoBanco codigo={b.codigo} /> {b.nombre}
                  </button>
                ))}
              </div>
              {bancos.length > 0 && <button type="button" className="enlace-boton" onClick={() => setBancos([])}>Ver todos</button>}
            </fieldset>
            <fieldset className="grupo-casillas">
              <legend>Secciones</legend>
              {SECCIONES.map((s) => (
                <label key={s.id} className="casilla">
                  <input type="checkbox" checked={secciones.includes(s.id)} onChange={() => alternar(secciones, setSecciones, s.id)} />
                  {s.texto}
                </label>
              ))}
            </fieldset>
            <button type="button" className="boton boton-primario boton-ancho" onClick={generar} disabled={cargando || rankings.length === 0 || secciones.length === 0}>
              {cargando ? 'Preparando…' : 'Generar vista previa'}
            </button>
            {reporte && (
              <>
                <button type="button" className="boton boton-secundario boton-ancho" onClick={() => window.print()}>Imprimir o guardar PDF</button>
                <div className="lista-descargas">
                  <BotonDescarga tipo="rankings" fecha={reporte.periodo}>Rankings</BotonDescarga>
                  <BotonDescarga tipo="desglose" fecha={reporte.periodo}>Desglose</BotonDescarga>
                  <BotonDescarga tipo="calidad" fecha={reporte.periodo}>Calidad</BotonDescarga>
                  <BotonDescarga tipo="movimientos">Movimientos</BotonDescarga>
                </div>
              </>
            )}
          </div>
        </Tarjeta>

        <div className="zona-vista-previa">
          {error && <EstadoError error={error} alReintentar={generar} />}
          {cargando && <Esqueleto filas={10} />}
          {!reporte && !cargando && !error && (
            <div className="hoja-vacia no-imprimir">
              <p>La vista previa aparecerá aquí, en formato de hoja A4.</p>
            </div>
          )}
          {reporte && !cargando && <HojaReporte r={reporte} meta={meta} sesion={sesion} />}
        </div>
      </div>
    </>
  );
}

export function HojaReporte({ r, meta, sesion }) {
  const filtraBanco = (codigo) => r.bancos.length === 0 || r.bancos.includes(codigo);
  const titulo = (x) => tituloRanking(x, meta);
  return (
    <article className="hoja-reporte" aria-label="Vista previa del reporte">
      <header className="hoja-cabecera">
        <div>
          <p className="hoja-marca">SYNTROPY · Observatorio de Crédito Bancario</p>
          <h2>Reporte personalizado de crédito</h2>
          <p className="hoja-meta">
            Período: <strong>{etiquetaPeriodo(r.periodo, meta)}</strong> (corte {fechaCorte(r.periodo)})
            {r.comparar && <> · Comparado con <strong>{etiquetaPeriodo(r.comparar, meta)}</strong></>}
          </p>
          <p className="hoja-meta">Generado: {fechaHora(r.generado)} · Perfil: {PERFILES[sesion.perfil]?.nombre}{sesion.usuario ? ` (${sesion.usuario})` : ''}</p>
        </div>
        <div className="hoja-sello">DATOS<br />FICTICIOS</div>
      </header>
      <p className="hoja-aviso">Fuente: {meta.fuente}. {meta.aviso}</p>

      {r.panel && (
        <section className="hoja-seccion">
          <h3>Resumen ejecutivo</h3>
          <div className="hoja-kpis">
            <div><span>Cartera local válida</span><strong className="num">{monto(r.panel.kpis.cartera_total)}</strong></div>
            <div><span>Operaciones válidas</span><strong className="num">{entero(r.panel.kpis.operaciones)}</strong></div>
            <div><span>Variación vs mes anterior</span><strong className="num">{variacion(r.panel.kpis.var_cartera_pct)}</strong></div>
            <div><span>Filas excluidas</span><strong className="num">{entero(r.panel.kpis.excluidas)}</strong></div>
          </div>
          <div className="hoja-dos">
            <table className="tabla tabla-compacta">
              <thead><tr><th scope="col">Actividad</th><th scope="col">Líder</th><th scope="col" className="numerica">Saldo</th></tr></thead>
              <tbody>
                {r.panel.lideres.filter((l) => r.rankings.includes(l.ranking)).map((l) => (
                  <tr key={l.ranking}><td>{titulo(l.ranking)}</td><td><PuntoBanco codigo={l.codigo_banco} /> {l.banco}</td><td className="numerica num">{montoCorto(l.saldo)}</td></tr>
                ))}
              </tbody>
            </table>
            <Grafico opcion={opcionComposicion(r.panel.composicion, titulo)} alto={220} svg etiqueta="Composición de la cartera por actividad" />
          </div>
          {r.panel.destacados.length > 0 && (
            <ul className="hoja-lista">{r.panel.destacados.map((d, i) => <li key={i}>{d.texto}</li>)}</ul>
          )}
        </section>
      )}

      {r.tablas && (
        <section className="hoja-seccion">
          <h3>Rankings</h3>
          {r.tablas.map((t) => (
            <div key={t.ranking} className="hoja-bloque">
              <h4>{titulo(t.ranking)} <span className="nota">· total del sistema {monto(t.total_ranking)}</span></h4>
              <table className="tabla tabla-compacta">
                <thead>
                  <tr>
                    <th scope="col" className="numerica">Pos.</th><th scope="col">Banco</th><th scope="col" className="numerica">Saldo</th>
                    <th scope="col" className="numerica">Cartera del banco</th><th scope="col" className="numerica">Ponderación</th>
                    <th scope="col" className="numerica">Operaciones</th>{t.fecha_anterior && <th scope="col" className="numerica">Cambio</th>}
                  </tr>
                </thead>
                <tbody>
                  {t.filas.filter((f) => filtraBanco(f.codigo_banco)).map((f) => (
                    <tr key={f.codigo_banco}>
                      <td className="numerica num">{f.posicion}</td><td>{f.banco} ({f.codigo_banco})</td>
                      <td className="numerica num">{monto(f.saldo_actividad)}</td><td className="numerica num">{monto(f.total_cartera)}</td>
                      <td className="numerica num">{pct(f.ponderacion_pct)}</td><td className="numerica num">{entero(f.operaciones)}</td>
                      {t.fecha_anterior && <td className="numerica num">{cambioTexto(f.cambio)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}

      {r.desgloses && (
        <section className="hoja-seccion">
          <h3>Desglose por subactividad</h3>
          {r.desgloses.map((d) => (
            <div key={d.ranking} className="hoja-bloque">
              <h4>{titulo(d.ranking)}</h4>
              <table className="tabla tabla-compacta">
                <thead><tr><th scope="col">Banco</th><th scope="col">Subactividad</th><th scope="col" className="numerica">Saldo</th></tr></thead>
                <tbody>
                  {d.filas.filter((f) => filtraBanco(f.codigo_banco)).map((f) => (
                    <tr key={`${f.codigo_banco}-${f.subactividad}`}><td>{f.banco} ({f.codigo_banco})</td><td>{f.subactividad}</td><td className="numerica num">{monto(f.saldo)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="nota">Consumo aplica la regla SB21: Crédito personal con facilidad 07 se reclasifica a Tarjeta.</p>
        </section>
      )}

      {r.movs && (
        <section className="hoja-seccion">
          <h3>Movimientos de posición · {etiquetaPeriodo(r.movs.desde, meta)} → {etiquetaPeriodo(r.movs.hasta, meta)}</h3>
          {r.movs.explicaciones.length > 0 && <ul className="hoja-lista">{r.movs.explicaciones.map((t, i) => <li key={i}>{t}</li>)}</ul>}
          <table className="tabla tabla-compacta">
            <thead><tr><th scope="col">Ranking</th><th scope="col">Banco</th><th scope="col" className="numerica">Antes</th><th scope="col" className="numerica">Ahora</th><th scope="col" className="numerica">Var. saldo</th><th scope="col">Motivo</th></tr></thead>
            <tbody>
              {r.movs.filas.filter((f) => f.significativo && r.rankings.includes(f.ranking) && filtraBanco(f.codigo_banco)).map((f) => (
                <tr key={`${f.ranking}-${f.codigo_banco}`}>
                  <td>{titulo(f.ranking)}</td><td>{f.banco}</td><td className="numerica num">{f.posicion_anterior}.º</td><td className="numerica num">{f.posicion_actual}.º</td>
                  <td className="numerica num">{variacion(f.var_saldo_pct)}</td><td>{f.motivos.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {r.calidad && (
        <section className="hoja-seccion">
          <h3>Calidad de datos</h3>
          <p>
            {entero(r.calidad.filas_leidas)} filas leídas = {entero(r.calidad.cascada.E1)} (E1 duplicados) + {entero(r.calidad.cascada.E2)} (E2 destino extranjero) +{' '}
            {entero(r.calidad.cascada.E3)} (E3 saldo ≤ 0) + {entero(r.calidad.cascada.E4)} (E4 actividad no catalogada) + {entero(r.calidad.universo)} (universo local válido){' '}
            <strong>{r.calidad.cuadra ? '✓ cuadra' : '✗ no cuadra'}</strong>.
          </p>
          <ul className="hoja-lista">
            {r.calidad.reconciliaciones.map((x) => <li key={x.id}>{x.id} · {x.nombre}: {x.ok ? 'cuadra ✓' : `${x.diferencias} diferencias ✗`}</li>)}
          </ul>
        </section>
      )}

      <footer className="hoja-pie">Uso informativo; no constituye opinión formal de la SBP. Datos 100 % ficticios. Syntropy · Hackathon SBP 2026.</footer>
    </article>
  );
}
