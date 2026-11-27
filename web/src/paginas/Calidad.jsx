// Calidad de datos: la cascada de exclusiones E1–E4, la ecuación que debe cuadrar,
// las reconciliaciones, las alertas y la lista trazable de filas excluidas.
import { useState } from 'react';
import { api } from '../api.js';
import { useApp, useDatos } from '../contexto.jsx';
import { Carga } from '../componentes/Estados.jsx';
import { BotonDescarga, EncabezadoPagina, Insignia, Leyenda, Pestanas, Tarjeta } from '../componentes/Comunes.jsx';
import Grafico from '../componentes/Grafico.jsx';
import { opcionSankey } from '../graficos.js';
import { entero, etiquetaPeriodo, monto } from '../formato.js';

const FILTROS = [
  { id: 'E1', nombre: 'Duplicados', regla: 'Número de préstamo repetido en el período: se conserva la primera fila del archivo.' },
  { id: 'E2', nombre: 'Destino extranjero', regla: 'Destino distinto de «L» (local).' },
  { id: 'E3', nombre: 'Saldo no positivo', regla: 'Saldo menor o igual a 0.' },
  { id: 'E4', nombre: 'Actividad no catalogada', regla: 'Tipo de actividad que no existe en el catálogo CINU/SB109.' },
];

export default function Calidad() {
  const { meta, fecha } = useApp();
  const estado = useDatos(() => (fecha ? api.calidad(fecha) : null), [fecha]);

  return (
    <>
      <EncabezadoPagina titulo="Calidad de datos" subtitulo={`Exclusiones en cascada y controles de reconciliación · ${etiquetaPeriodo(fecha, meta)}`}>
        <BotonDescarga tipo="calidad">Reporte de calidad (CSV)</BotonDescarga>
        <BotonDescarga tipo="excluidas" fecha={fecha}>Filas excluidas (CSV)</BotonDescarga>
      </EncabezadoPagina>
      <Carga estado={estado} filas={10}>
        {(c) => {
          const excluidas = c.cascada.E1 + c.cascada.E2 + c.cascada.E3 + c.cascada.E4;
          let quedan = c.filas_leidas;
          return (
            <>
              <div className={`ecuacion ${c.cuadra ? 'ecuacion-ok' : 'ecuacion-mal'}`} role="status">
                <span className="ecuacion-titulo">{c.cuadra ? '✓ Cuadra' : '✗ No cuadra'}</span>
                <span className="ecuacion-cuerpo num">
                  <b>{entero(c.filas_leidas)}</b> filas leídas = <b>{entero(c.cascada.E1)}</b> E1 + <b>{entero(c.cascada.E2)}</b> E2 + <b>{entero(c.cascada.E3)}</b> E3 + <b>{entero(c.cascada.E4)}</b> E4 + <b>{entero(c.universo)}</b> universo local válido
                </span>
                <span className="ecuacion-pie">Archivo: {c.archivo} · Saldo del universo: {monto(c.saldo_universo)} u.m.</span>
              </div>

              <div className="rejilla-dos">
                <Tarjeta titulo="Recorrido de las filas" subtitulo="Cada fila excluida cuenta una sola vez, en el primer filtro que no cumple" id="sankey">
                  <Grafico opcion={opcionSankey(c)} alto={340} etiqueta="Diagrama de flujo de las filas por los filtros E1 a E4" />
                </Tarjeta>
                <Tarjeta titulo="Cascada oficial E1–E4" subtitulo={`${entero(excluidas)} filas excluidas en total`} id="cascada">
                  <table className="tabla">
                    <thead><tr><th scope="col">Filtro</th><th scope="col">Regla</th><th scope="col" className="numerica">Excluidas</th><th scope="col" className="numerica">Quedan</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">—</th><td>Filas leídas del archivo</td><td className="numerica" /><td className="numerica num">{entero(c.filas_leidas)}</td></tr>
                      {FILTROS.map((f) => {
                        quedan -= c.cascada[f.id];
                        return (
                          <tr key={f.id}>
                            <th scope="row"><span className="filtro-id">{f.id}</span> {f.nombre}</th>
                            <td className="regla-texto">{f.regla}</td>
                            <td className="numerica num">{entero(c.cascada[f.id])}</td>
                            <td className="numerica num">{entero(quedan)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr><th scope="row" colSpan={3}>Universo local válido</th><th className="numerica num">{entero(c.universo)}</th></tr></tfoot>
                  </table>
                  {c.independientes && (
                    <details className="detalles">
                      <summary>Conteo independiente por regla (informativo, no oficial)</summary>
                      <p className="nota">Cuántas filas incumplen cada regla por sí sola, sin cascada. Una fila puede contar en varias.</p>
                      <ul className="lista-simple">
                        {FILTROS.map((f) => <li key={f.id}><span className="filtro-id">{f.id}</span> {f.nombre}: <b className="num">{entero(c.independientes[f.id])}</b></li>)}
                      </ul>
                    </details>
                  )}
                </Tarjeta>
              </div>

              <div className="rejilla-dos">
                <Tarjeta titulo="Reconciliaciones" subtitulo="Los totales deben cuadrar al centavo" id="reconciliaciones">
                  <ul className="controles">
                    {c.reconciliaciones.map((r) => (
                      <li key={r.id} className={r.ok ? 'control-ok' : 'control-mal'}>
                        <span className="control-icono" aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
                        <div>
                          <p className="control-titulo"><span className="filtro-id">{r.id}</span> {r.nombre}</p>
                          <p className="nota">{entero(r.revisados)} combinaciones revisadas · {entero(r.diferencias)} diferencias</p>
                        </div>
                      </li>
                    ))}
                    {c.esquema && (
                      <li className={c.esquema.ok ? 'control-ok' : 'control-mal'}>
                        <span className="control-icono" aria-hidden="true">{c.esquema.ok ? '✓' : '✗'}</span>
                        <div>
                          <p className="control-titulo">Esquema del archivo: {c.esquema.columnas} columnas en el orden del diccionario</p>
                          {c.esquema.problemas?.length > 0 && <ul className="lista-simple">{c.esquema.problemas.map((p, i) => <li key={i}>{p}</li>)}</ul>}
                        </div>
                      </li>
                    )}
                  </ul>
                </Tarjeta>
                <Tarjeta titulo="Alertas de calidad" subtitulo="Se informan, pero no excluyen filas" id="alertas">
                  {c.alertas.length === 0 ? <p className="nota">Sin alertas en este período.</p> : (
                    <ul className="alertas">
                      {c.alertas.map((a, i) => (
                        <li key={i} className={`alerta alerta-${a.severidad}`}>
                          <Insignia tono={a.severidad === 'alta' ? 'peligro' : a.severidad === 'media' ? 'aviso' : 'neutro'}>{a.severidad}</Insignia>
                          <span>{a.texto}</span>
                          {a.cantidad != null && <b className="num">{entero(a.cantidad)}</b>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>
              </div>

              <FilasExcluidas fecha={fecha} />
            </>
          );
        }}
      </Carga>
    </>
  );
}

function FilasExcluidas({ fecha }) {
  const [filtro, setFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const estado = useDatos(() => api.excluidas({ fecha, filtro, pagina }), [fecha, filtro, pagina]);

  function cambiarFiltro(f) { setFiltro(f); setPagina(1); }

  return (
    <Tarjeta titulo="Filas excluidas (trazabilidad)" subtitulo="Cada fila con su número en el archivo y el motivo" id="excluidas">
      <Pestanas
        compactas etiqueta="Filtro" valor={filtro} alCambiar={cambiarFiltro}
        opciones={[{ valor: '', texto: 'Todas' }, ...FILTROS.map((f) => ({ valor: f.id, texto: `${f.id} · ${f.nombre}` }))]}
      />
      <Carga estado={estado} filas={6}>
        {(d) => {
          const paginas = Math.max(1, Math.ceil(d.total / (d.por_pagina || 50)));
          return (
            <>
              <div className="tabla-envoltura">
                <table className="tabla tabla-compacta">
                  <thead>
                    <tr>
                      <th scope="col" className="numerica">Fila</th><th scope="col">Número de préstamo</th><th scope="col">Banco</th>
                      <th scope="col">Filtro</th><th scope="col">Motivo</th><th scope="col">Destino</th>
                      <th scope="col" className="numerica">Saldo</th><th scope="col">Tipo de actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.filas.length === 0 && <tr><td colSpan={8} className="celda-vacia">No hay filas excluidas con este filtro.</td></tr>}
                    {d.filas.map((f) => (
                      <tr key={`${f.fila}-${f.filtro}`}>
                        <td className="numerica num">{entero(f.fila)}</td>
                        <td className="mono">{f.numero_prestamo}</td>
                        <td>{f.codigo_banco}</td>
                        <td><span className="filtro-id">{f.filtro}</span></td>
                        <td>{f.motivo}</td>
                        <td>{f.destino}</td>
                        <td className="numerica num">{monto(f.saldo)}</td>
                        <td className="mono">{f.tipo_actividad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="paginacion">
                <button type="button" className="boton boton-secundario boton-chico" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>← Anterior</button>
                <span className="num">Página {pagina} de {paginas} · {entero(d.total)} filas</span>
                <button type="button" className="boton boton-secundario boton-chico" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente →</button>
              </div>
              <Leyenda>«Fila» es el número de la fila de datos dentro del archivo (sin contar el encabezado).</Leyenda>
            </>
          );
        }}
      </Carga>
    </Tarjeta>
  );
}
