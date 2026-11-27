// Reportes personalizados (perfil analista): exportaciones con filtros y reporte ejecutivo automático.
import { useState } from 'react';
import { useApp } from '../contexto.jsx';
import { urlExportar } from '../api.js';
import { Selector, Tarjeta } from '../componentes/Comunes.jsx';
import { mes } from '../formato.js';

const TIPOS = [
  { valor: 'rankings', texto: 'Rankings por período', desc: 'Fecha, Ranking, Posicion, Codigo_Banco, Banco, Saldo_Actividad, Total_Cartera_Local_Valida, Ponderacion_Pct, Operaciones_Validas', filtros: ['fecha', 'ranking', 'banco'] },
  { valor: 'desglose', texto: 'Desglose por subactividad', desc: 'Fecha, Ranking, Subactividad, Codigo_Banco, Saldo (incluye la reclasificación SB21 a Tarjeta)', filtros: ['fecha', 'ranking', 'banco'] },
  { valor: 'calidad', texto: 'Reporte de calidad', desc: 'Conteos en cascada E1–E4, universo local válido y si cuadra', filtros: ['fecha'] },
  { valor: 'movimientos', texto: 'Movimientos de posición', desc: 'Entre períodos consecutivos (o el par elegido), con la regla de significancia vigente', filtros: ['fecha', 'ranking', 'banco', 'significativos'] },
  { valor: 'excluidas', texto: 'Filas excluidas', desc: 'Fila, préstamo, banco, filtro y motivo de cada exclusión', filtros: ['fecha', 'filtro'] },
];

export default function Reportes() {
  const { meta, fecha } = useApp();
  const [tipo, setTipo] = useState('rankings');
  const [periodo, setPeriodo] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [banco, setBanco] = useState(null);
  const [filtro, setFiltro] = useState(null);
  const [soloSig, setSoloSig] = useState(false);
  const [repFecha, setRepFecha] = useState(fecha);
  const [repRankings, setRepRankings] = useState(meta.rankings.map((r) => r.nombre));
  const [repBanco, setRepBanco] = useState(null);

  const t = TIPOS.find((x) => x.valor === tipo);
  const usa = (f) => t.filtros.includes(f);
  const url = urlExportar(tipo, {
    fecha: usa('fecha') ? periodo : null, ranking: usa('ranking') ? ranking : null, banco: usa('banco') ? banco : null,
    filtro: usa('filtro') ? filtro : null, significativos: usa('significativos') && soloSig ? '1' : null,
  });
  const urlReporte = (ver) => urlExportar('reporte.html', { fecha: repFecha, rankings: repRankings.length === meta.rankings.length ? null : repRankings.join(','), banco: repBanco, ver: ver ? '1' : null });
  const alternarRk = (n) => setRepRankings((xs) => (xs.includes(n) ? xs.filter((x) => x !== n) : meta.rankings.map((r) => r.nombre).filter((r) => r === n || xs.includes(r))));

  return (
    <>
      <div className="titulo-pagina">
        <h1>Reportes</h1>
        <p>Arme una exportación a la medida o genere el reporte ejecutivo del período. Todo se calcula en el momento desde los archivos cargados.</p>
      </div>

      <div className="dos-columnas">
        <Tarjeta titulo="Exportación personalizada (CSV)" subtitulo="UTF-8, separador coma, códigos con sus ceros a la izquierda.">
          <div className="formulario">
            <Selector id="r-tipo" etiqueta="Contenido" valor={tipo} onChange={(v) => v && setTipo(v)} opciones={TIPOS} />
            <p className="nota">{t.desc}</p>
            {usa('fecha') && <Selector id="r-per" etiqueta="Período" valor={periodo} onChange={setPeriodo} todos="Todos los períodos" opciones={meta.periodos.map((p) => ({ valor: p.fecha, texto: p.etiqueta }))} />}
            {usa('ranking') && <Selector id="r-rk" etiqueta="Ranking" valor={ranking} onChange={setRanking} todos="Todos" opciones={meta.rankings.map((r) => ({ valor: r.nombre, texto: r.titulo }))} />}
            {usa('banco') && <Selector id="r-bk" etiqueta="Banco" valor={banco} onChange={setBanco} todos="Todos" opciones={meta.bancos.map((b) => ({ valor: b.codigo, texto: b.nombre }))} />}
            {usa('filtro') && <Selector id="r-fl" etiqueta="Filtro de exclusión" valor={filtro} onChange={setFiltro} todos="Todos" opciones={['E1', 'E2', 'E3', 'E4'].map((e) => ({ valor: e, texto: e }))} />}
            {usa('significativos') && <label className="interruptor"><input type="checkbox" checked={soloSig} onChange={(e) => setSoloSig(e.target.checked)} /> Solo movimientos significativos</label>}
            <a className="boton" href={url} download>⤓ Descargar CSV</a>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Reporte ejecutivo automático" subtitulo="Resumen, principales movimientos explicados, rankings y calidad de datos. Se abre como página lista para imprimir o guardar en PDF.">
          <div className="formulario">
            <Selector id="r-rep" etiqueta="Período" valor={repFecha} onChange={(v) => v && setRepFecha(v)} opciones={meta.periodos.map((p) => ({ valor: p.fecha, texto: p.etiqueta }))} />
            <fieldset className="casillas">
              <legend>Rankings a incluir</legend>
              {meta.rankings.map((r) => (
                <label key={r.nombre}><input type="checkbox" checked={repRankings.includes(r.nombre)} onChange={() => alternarRk(r.nombre)} /> {r.titulo}</label>
              ))}
            </fieldset>
            <Selector id="r-rep-bk" etiqueta="Enfocar en un banco (opcional)" valor={repBanco} onChange={setRepBanco} todos="Todos los bancos" opciones={meta.bancos.map((b) => ({ valor: b.codigo, texto: b.nombre }))} />
            <div className="fila-botones">
              <a className="boton" href={urlReporte(true)} target="_blank" rel="noreferrer">Ver reporte de {mes(repFecha)}</a>
              <a className="boton secundario" href={urlReporte(false)} download>⤓ Descargar HTML</a>
            </div>
          </div>
        </Tarjeta>
      </div>
    </>
  );
}
