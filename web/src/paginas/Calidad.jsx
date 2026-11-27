// Calidad de datos (perfil analista): cascada E1→E4, reconciliaciones, alertas y filas excluidas.
import { useState } from 'react';
import { useApp } from '../contexto.jsx';
import { useApi, qs, urlExportar } from '../api.js';
import { Aviso, BotonDescarga, Cargando, Selector, Tabla, Tarjeta } from '../componentes/Comunes.jsx';
import { dinero, fechaHora, mes, numero } from '../formato.js';

const FILTROS = [
  { id: 'E1', nombre: 'Duplicados', regla: 'Numero_Prestamo repetido en el período: se conserva la primera aparición.' },
  { id: 'E2', nombre: 'Destino extranjero', regla: 'Destino distinto de «L».' },
  { id: 'E3', nombre: 'Saldo no positivo', regla: 'Saldo igual a 0 o negativo.' },
  { id: 'E4', nombre: 'Actividad no catalogada', regla: 'Tipo_Actividad no existe en el catálogo CINU/SB109.' },
];

export default function Calidad() {
  const { fecha } = useApp();
  const [filtro, setFiltro] = useState(null);
  const [pagina, setPagina] = useState(1);
  const cal = useApi(fecha ? `/calidad${qs({ fecha })}` : null);
  const exc = useApi(fecha ? `/excluidas${qs({ fecha, filtro, pagina })}` : null);

  if (cal.error) return <Aviso error={cal.error} />;
  if (!cal.datos) return <Cargando />;
  const c = cal.datos;
  let quedan = c.filas_leidas;
  const paginas = exc.datos ? Math.max(1, Math.ceil(exc.datos.total / exc.datos.por_pagina)) : 1;

  return (
    <>
      <div className="titulo-pagina">
        <h1>Calidad de datos · {mes(c.fecha)}</h1>
        <p>Archivo <b>{c.archivo}</b>, procesado {fechaHora(c.cargado)}. Cada fila excluida se cuenta una sola vez, en el primer filtro que incumple.</p>
      </div>

      <Tarjeta
        titulo="Exclusiones en cascada"
        subtitulo={<>Filas leídas = E1 + E2 + E3 + E4 + universo local válido → <b className={c.cuadra ? 'ok' : 'mal'}>{c.cuadra ? '✔ cuadra' : '✘ no cuadra'}</b></>}
        acciones={<>
          <BotonDescarga chico href={urlExportar('calidad', { fecha })}>Reporte de calidad (CSV)</BotonDescarga>
          <BotonDescarga chico href={urlExportar('excluidas', { fecha })}>Filas excluidas (CSV)</BotonDescarga>
        </>}
      >
        <ol className="cascada">
          <li className="paso inicio"><span className="paso-num">{numero(c.filas_leidas)}</span><span className="paso-etq">filas leídas</span></li>
          {FILTROS.map((f) => {
            quedan -= c.cascada[f.id];
            return (
              <li key={f.id} className="paso">
                <span className="paso-id">{f.id}</span>
                <span className="paso-num menos">−{numero(c.cascada[f.id])}</span>
                <span className="paso-etq">{f.nombre}</span>
                <span className="paso-regla">{f.regla}</span>
                <span className="paso-quedan">quedan {numero(quedan)}</span>
              </li>
            );
          })}
          <li className="paso fin"><span className="paso-num">{numero(c.universo)}</span><span className="paso-etq">universo local válido</span><span className="paso-regla">Saldo: {dinero(c.saldo_universo)}</span></li>
        </ol>
      </Tarjeta>

      <div className="dos-columnas">
        <Tarjeta titulo="Reconciliaciones y controles" subtitulo="Se verifican al centavo en cada carga.">
          <ul className="controles">
            {c.reconciliaciones.map((r) => (
              <li key={r.id} className={r.ok ? 'ok' : 'mal'}>
                <span aria-hidden="true">{r.ok ? '✔' : '✘'}</span>
                <span><b>{r.id}</b> · {r.nombre} <span className="tenue">({numero(r.revisados)} revisados, {r.diferencias} diferencias)</span></span>
              </li>
            ))}
            <li className={c.esquema.ok ? 'ok' : 'mal'}><span aria-hidden="true">{c.esquema.ok ? '✔' : '✘'}</span><span><b>Esquema</b> · {c.esquema.columnas} columnas con los nombres y el orden del diccionario</span></li>
          </ul>
        </Tarjeta>
        <Tarjeta titulo="Alertas e indicadores informativos">
          {c.alertas.length === 0
            ? <p className="ok">✔ Sin alertas de integridad referencial (bancos, facilidades SB21) ni de coherencia de CONSUMO.</p>
            : <ul className="controles">{c.alertas.map((a) => <li key={a.texto} className="aviso"><span aria-hidden="true">⚠</span><span>{a.texto}</span></li>)}</ul>}
          <h3>Conteo independiente de cada regla</h3>
          <p className="nota">Cuántas filas incumplen cada regla por separado (una fila puede incumplir varias). No es el conteo oficial.</p>
          <Tabla compacta columnas={[
            { clave: 'id', titulo: 'Regla' }, { clave: 'nombre', titulo: 'Descripción' },
            { clave: 'cascada', titulo: 'En cascada (oficial)', num: true }, { clave: 'independiente', titulo: 'Independiente', num: true },
          ]} filas={FILTROS.map((f) => ({ ...f, cascada: numero(c.cascada[f.id]), independiente: numero(c.independientes[f.id]) }))} claveFila={(f) => f.id} />
          <p className="nota">Créditos personales con facilidad 07 reclasificados a Tarjeta: <b>{numero(c.reclasificadas_sb21)}</b>.</p>
        </Tarjeta>
      </div>

      <Tarjeta
        titulo="Filas excluidas (trazabilidad)"
        subtitulo="«Fila» = número de fila de datos en el archivo (1 = primera fila después del encabezado)."
        acciones={<Selector id="q-filtro" etiqueta="Filtro" valor={filtro} onChange={(v) => { setFiltro(v); setPagina(1); }} todos="Todos" opciones={FILTROS.map((f) => ({ valor: f.id, texto: `${f.id} · ${f.nombre}` }))} />}
      >
        {exc.error && <Aviso error={exc.error} />}
        {!exc.datos ? <Cargando /> : (
          <>
            <Tabla compacta claveFila={(f) => `${f.fila}`} columnas={[
              { clave: 'fila', titulo: 'Fila', num: true },
              { clave: 'numero_prestamo', titulo: 'Número de préstamo' },
              { clave: 'codigo_banco', titulo: 'Banco' },
              { clave: 'filtro', titulo: 'Filtro' },
              { clave: 'motivo', titulo: 'Motivo' },
              { clave: 'saldo', titulo: 'Saldo', num: true },
            ]} filas={exc.datos.filas} />
            <div className="paginacion">
              <button type="button" className="boton secundario chico" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
              <span>Página {exc.datos.pagina} de {paginas} · {numero(exc.datos.total)} filas</span>
              <button type="button" className="boton secundario chico" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
            </div>
          </>
        )}
      </Tarjeta>
    </>
  );
}
