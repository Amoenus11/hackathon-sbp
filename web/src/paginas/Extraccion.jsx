// «Descarga a tu medida»: el usuario elige cortes, actividades, bancos, clasificación y campos, ve una vista
// previa en vivo y descarga SOLO lo que necesita (CSV o Excel). Pedido directo del stakeholder de la SBP:
// «hoy descargo todo y luego veo cómo lo proceso». Sin código y sin limpiar después.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, descargarExtraccion } from '../api.js';
import { entero, montoCorto } from '../formato.js';
import './extraccion.css';

const NIVELES = [
  { clave: 'resumen', titulo: 'Resumen agrupado', texto: 'Una fila por grupo: operaciones, saldo y mora. Ideal para informes.' },
  { clave: 'detalle', titulo: 'Detalle por préstamo', texto: 'Una fila por préstamo con los campos que elijas. Ideal para modelos.' },
];

// Lista legible de lo elegido, para la cabecera de cada bloque
function resumenLista(elegidos, total, nombre, plural) {
  if (!total) return '—';
  if (elegidos.length === total) return `Todos (${total})`;
  if (elegidos.length === 0) return `Ningún ${nombre}`;
  return `${elegidos.length} ${elegidos.length === 1 ? nombre : plural}`;
}

function Bloque({ numero, titulo, resumen, abierto, alAbrir, children }) {
  return (
    <section className={`ex-bloque${abierto ? ' abierto' : ''}`}>
      <button type="button" className="ex-bloque-cabecera" onClick={alAbrir} aria-expanded={abierto}>
        <span className="ex-numero">{numero}</span>
        <span className="ex-bloque-textos">
          <strong>{titulo}</strong>
          <small>{resumen}</small>
        </span>
        <span className="ex-flecha" aria-hidden="true">{abierto ? '−' : '+'}</span>
      </button>
      {abierto && <div className="ex-bloque-cuerpo">{children}</div>}
    </section>
  );
}

function Casilla({ marcada, alCambiar, children }) {
  return (
    <label className={`ex-casilla${marcada ? ' marcada' : ''}`}>
      <input type="checkbox" checked={marcada} onChange={alCambiar} />
      <span>{children}</span>
    </label>
  );
}

const alternar = (lista, valor) => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);

export default function Extraccion() {
  const [opciones, setOpciones] = useState(null);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(1);
  const [cortes, setCortes] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [subactividades, setSubactividades] = useState([]); // vacío = todas
  const [actividadAbierta, setActividadAbierta] = useState(null);
  const [bancos, setBancos] = useState([]);
  const [clasificaciones, setClasificaciones] = useState([]);
  const [nivel, setNivel] = useState('resumen');
  const [agrupar, setAgrupar] = useState(['banco', 'actividad']);
  const [campos, setCampos] = useState([]);
  const [incluirExcluidas, setIncluirExcluidas] = useState(false);
  const [vista, setVista] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(null);
  const peticion = useRef(0);

  useEffect(() => {
    api.opcionesExtraccion().then((o) => {
      setOpciones(o);
      setCortes(o.cortes.map((c) => c.fecha));
      setActividades(o.actividades.map((a) => a.ranking));
      setBancos(o.bancos.map((b) => b.codigo));
      setClasificaciones(o.clasificaciones.map((c) => c.codigo));
      setCampos(o.campos.filter((c) => c.defecto).map((c) => c.campo));
    }).catch(setError);
  }, []);

  const cuerpo = useMemo(() => ({
    cortes,
    actividades,
    subactividades,
    bancos: opciones && bancos.length === opciones.bancos.length ? [] : bancos,
    clasificaciones: opciones && clasificaciones.length === opciones.clasificaciones.length ? [] : clasificaciones,
    campos,
    nivel,
    agrupar,
    incluir_excluidas: incluirExcluidas,
  }), [cortes, actividades, subactividades, bancos, clasificaciones, campos, nivel, agrupar, incluirExcluidas, opciones]);

  const vacio = !cortes.length || !actividades.length || (opciones && !bancos.length) || (opciones && !clasificaciones.length)
    || (nivel === 'detalle' && !campos.length) || (nivel === 'resumen' && !agrupar.length);

  // Vista previa en vivo: 400 ms después del último cambio
  useEffect(() => {
    if (!opciones) return undefined;
    if (vacio) { setVista(null); return undefined; }
    const id = ++peticion.current;
    setCargando(true);
    const reloj = setTimeout(() => {
      api.extraer(cuerpo)
        .then((v) => { if (id === peticion.current) { setVista(v); setError(null); } })
        .catch((e) => { if (id === peticion.current) setError(e); })
        .finally(() => { if (id === peticion.current) setCargando(false); });
    }, 400);
    return () => clearTimeout(reloj);
  }, [cuerpo, opciones, vacio]);

  async function descargar(formato) {
    setDescargando(formato);
    try { await descargarExtraccion(cuerpo, formato); setError(null); } catch (e) { setError(e); } finally { setDescargando(null); }
  }

  // Atajos: configuraciones listas con un clic
  function atajo(tipo) {
    if (!opciones) return;
    const todosCortes = opciones.cortes.map((c) => c.fecha);
    setActividades(opciones.actividades.map((a) => a.ranking));
    setSubactividades([]);
    setBancos(opciones.bancos.map((b) => b.codigo));
    setClasificaciones(opciones.clasificaciones.map((c) => c.codigo));
    setIncluirExcluidas(false);
    if (tipo === 'saldos') {
      setCortes(todosCortes); setNivel('resumen'); setAgrupar(['corte', 'banco', 'actividad']); setAbierto(5);
    } else if (tipo === 'mora') {
      setCortes(todosCortes.slice(-1)); setNivel('resumen'); setAgrupar(['clasificacion']); setAbierto(4);
    } else {
      setCortes(todosCortes.slice(-1)); setNivel('detalle');
      setCampos(opciones.campos.filter((c) => c.defecto).map((c) => c.campo)); setAbierto(5);
    }
  }

  if (!opciones) {
    return (
      <div className="ex">
        <h1 className="ex-titulo">Descarga solo lo que necesitas</h1>
        {error ? <p className="ex-error">{error.message}</p> : <p className="ex-sub">Preparando las opciones…</p>}
      </div>
    );
  }

  const etiquetaCorte = (f) => opciones.cortes.find((c) => c.fecha === f)?.etiqueta || f;
  const resumenCortes = cortes.length === 0 ? 'Ningún corte'
    : cortes.length === 1 ? etiquetaCorte(cortes[0])
      : `${cortes.length} cortes · ${etiquetaCorte([...cortes].sort()[0])} – ${etiquetaCorte([...cortes].sort().at(-1))}`;
  const resumenActividades = actividades.length === opciones.actividades.length && !subactividades.length
    ? `Las ${opciones.actividades.length} actividades`
    : `${actividades.length} actividades${subactividades.length ? ` · ${subactividades.length} subactividades` : ''}`;
  const grupos = [...new Set(opciones.campos.map((c) => c.grupo))];
  const resumenQue = nivel === 'resumen'
    ? `Resumen por ${agrupar.map((a) => opciones.agrupaciones.find((g) => g.clave === a)?.titulo.toLowerCase() || a).join(', ') || '—'}`
    : `Detalle · ${campos.length} campos${incluirExcluidas ? ' + excluidas' : ''}`;

  return (
    <div className="ex">
      <header className="ex-cabecera">
        <h1 className="ex-titulo">Descarga solo lo que necesitas</h1>
        <p className="ex-sub">Elige cortes, actividades, bancos y campos. Sin código, sin limpiar después.</p>
        <div className="ex-atajos" role="group" aria-label="Atajos">
          <button type="button" className="ex-chip" onClick={() => atajo('saldos')}>Saldos por banco y actividad (3 meses)</button>
          <button type="button" className="ex-chip" onClick={() => atajo('mora')}>Cartera en mora por clasificación</button>
          <button type="button" className="ex-chip" onClick={() => atajo('modelo')}>Detalle de préstamos del último corte para un modelo</button>
        </div>
      </header>

      <div className="ex-rejilla">
        <div className="ex-pasos">
          <Bloque numero={1} titulo="Cortes" resumen={resumenCortes} abierto={abierto === 1} alAbrir={() => setAbierto(abierto === 1 ? 0 : 1)}>
            <div className="ex-lista">
              {opciones.cortes.map((c) => (
                <Casilla key={c.fecha} marcada={cortes.includes(c.fecha)} alCambiar={() => setCortes((l) => alternar(l, c.fecha))}>{c.etiqueta}</Casilla>
              ))}
            </div>
          </Bloque>

          <Bloque numero={2} titulo="Actividades económicas" resumen={resumenActividades} abierto={abierto === 2} alAbrir={() => setAbierto(abierto === 2 ? 0 : 2)}>
            <div className="ex-lista">
              {opciones.actividades.map((a) => {
                const marcada = actividades.includes(a.ranking);
                const subsElegidas = a.subactividades.filter((s) => subactividades.includes(s));
                return (
                  <div key={a.ranking} className="ex-actividad">
                    <div className="ex-actividad-fila">
                      <Casilla marcada={marcada} alCambiar={() => {
                        setActividades((l) => alternar(l, a.ranking));
                        if (marcada) setSubactividades((l) => l.filter((s) => !a.subactividades.includes(s)));
                      }}>{a.titulo}</Casilla>
                      <button type="button" className="ex-mini" onClick={() => setActividadAbierta(actividadAbierta === a.ranking ? null : a.ranking)} aria-expanded={actividadAbierta === a.ranking}>
                        {subsElegidas.length ? `${subsElegidas.length} de ${a.subactividades.length}` : 'Subactividades'} {actividadAbierta === a.ranking ? '▴' : '▾'}
                      </button>
                    </div>
                    {actividadAbierta === a.ranking && (
                      <div className="ex-subs">
                        <p className="ex-nota">Sin marcar ninguna = todas las subactividades.</p>
                        {a.subactividades.map((s) => (
                          <Casilla key={s} marcada={subactividades.includes(s)} alCambiar={() => {
                            setSubactividades((l) => alternar(l, s));
                            if (!marcada) setActividades((l) => [...l, a.ranking]);
                          }}>{s}</Casilla>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Bloque>

          <Bloque numero={3} titulo="Bancos" resumen={resumenLista(bancos, opciones.bancos.length, 'banco', 'bancos')} abierto={abierto === 3} alAbrir={() => setAbierto(abierto === 3 ? 0 : 3)}>
            <div className="ex-acciones-lista">
              <button type="button" className="ex-mini" onClick={() => setBancos(opciones.bancos.map((b) => b.codigo))}>Elegir todos</button>
              <button type="button" className="ex-mini" onClick={() => setBancos([])}>Ninguno</button>
            </div>
            <div className="ex-lista ex-lista-dos">
              {opciones.bancos.map((b) => (
                <Casilla key={b.codigo} marcada={bancos.includes(b.codigo)} alCambiar={() => setBancos((l) => alternar(l, b.codigo))}>
                  {b.nombre} <small className="ex-codigo">{b.codigo}</small>
                </Casilla>
              ))}
            </div>
          </Bloque>

          <Bloque numero={4} titulo="Clasificación de riesgo" resumen={resumenLista(clasificaciones, opciones.clasificaciones.length, 'categoría', 'categorías')} abierto={abierto === 4} alAbrir={() => setAbierto(abierto === 4 ? 0 : 4)}>
            <div className="ex-lista">
              {opciones.clasificaciones.map((c) => (
                <Casilla key={c.codigo} marcada={clasificaciones.includes(c.codigo)} alCambiar={() => setClasificaciones((l) => alternar(l, c.codigo))}>
                  <small className="ex-codigo">{c.codigo}</small> {c.nombre}
                </Casilla>
              ))}
            </div>
          </Bloque>

          <Bloque numero={5} titulo="Qué quieres descargar" resumen={resumenQue} abierto={abierto === 5} alAbrir={() => setAbierto(abierto === 5 ? 0 : 5)}>
            <div className="ex-niveles">
              {NIVELES.map((n) => (
                <button key={n.clave} type="button" className={`ex-nivel${nivel === n.clave ? ' elegido' : ''}`} onClick={() => setNivel(n.clave)} aria-pressed={nivel === n.clave}>
                  <strong>{n.titulo}</strong>
                  <span>{n.texto}</span>
                </button>
              ))}
            </div>
            {nivel === 'resumen' ? (
              <div className="ex-grupo">
                <p className="ex-grupo-titulo">Agrupar por</p>
                <div className="ex-chips">
                  {opciones.agrupaciones.map((g) => (
                    <button key={g.clave} type="button" className={`ex-chip${agrupar.includes(g.clave) ? ' activo' : ''}`} onClick={() => setAgrupar((l) => alternar(l, g.clave))} aria-pressed={agrupar.includes(g.clave)}>
                      {g.titulo}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="ex-acciones-lista">
                  <button type="button" className="ex-mini" onClick={() => setCampos(opciones.campos.filter((c) => c.defecto).map((c) => c.campo))}>Solo lo esencial</button>
                  <button type="button" className="ex-mini" onClick={() => setCampos(opciones.campos.map((c) => c.campo))}>Todo</button>
                </div>
                {grupos.map((g) => (
                  <div key={g} className="ex-grupo">
                    <p className="ex-grupo-titulo">{g}</p>
                    <div className="ex-lista ex-lista-dos">
                      {opciones.campos.filter((c) => c.grupo === g).map((c) => (
                        <Casilla key={c.campo} marcada={campos.includes(c.campo)} alCambiar={() => setCampos((l) => alternar(l, c.campo))}>{c.titulo}</Casilla>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
            <Casilla marcada={incluirExcluidas} alCambiar={() => setIncluirExcluidas((v) => !v)}>Incluir filas excluidas con su motivo (calidad)</Casilla>
          </Bloque>
        </div>

        <aside className="ex-vista" aria-live="polite">
          <div className="ex-vista-cifras">
            {vacio ? (
              <p className="ex-vista-vacia">Elige al menos un corte, una actividad, un banco, una clasificación y qué descargar.</p>
            ) : vista ? (
              <>
                <p className="ex-grande">
                  <span className="num">{entero(vista.total_filas)}</span> filas
                  {vista.saldo_total != null && <> · saldo <span className="num">{montoCorto(vista.saldo_total)}</span></>}
                </p>
                {vista.nota && <p className="ex-nota">{vista.nota}</p>}
              </>
            ) : (
              <p className="ex-sub">Calculando…</p>
            )}
            {cargando && <span className="ex-cargando" aria-label="Actualizando" />}
          </div>
          {error && <p className="ex-error">{error.message}</p>}
          {!vacio && vista && (
            <div className="ex-tabla-envoltura">
              <table className="ex-tabla">
                <thead><tr>{vista.columnas.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
                <tbody>
                  {vista.filas.map((f, i) => (
                    <tr key={i}>{f.map((v, k) => <td key={k}>{v === null || v === undefined ? '' : String(v)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              {vista.total_filas > vista.filas.length && <p className="ex-nota ex-nota-tabla">Vista previa: primeras {vista.filas.length} de {entero(vista.total_filas)} filas.</p>}
            </div>
          )}
          <div className="ex-botones">
            <button type="button" className="ex-boton" disabled={vacio || !!descargando} onClick={() => descargar('csv')}>
              {descargando === 'csv' ? 'Preparando…' : 'Descargar CSV'}
            </button>
            <button type="button" className="ex-boton ex-boton-excel" disabled={vacio || !!descargando} onClick={() => descargar('xlsx')}>
              {descargando === 'xlsx' ? 'Preparando…' : 'Descargar Excel'}
            </button>
          </div>
        </aside>
      </div>

      <p className="ex-pie">Datos 100 % ficticios (paquete AT03 sintético del Hackathon SBP 2026). Los datos personales del cliente nunca se ofrecen para descarga.</p>
    </div>
  );
}
