// Piezas comunes de la interfaz.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { pctSigno } from '../formato.js';

export function Tarjeta({ titulo, subtitulo, acciones, children, className = '', tabla }) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <section className={`tarjeta ${className}`}>
      {(titulo || acciones || tabla) && (
        <header className="tarjeta-cab">
          <div>
            {titulo && <h2>{titulo}</h2>}
            {subtitulo && <p className="sub">{subtitulo}</p>}
          </div>
          <div className="acciones">
            {acciones}
            {tabla && (
              <button type="button" className="boton fantasma chico" onClick={() => setVerTabla((v) => !v)} aria-pressed={verTabla}>
                {verTabla ? 'Ver gráfico' : 'Ver como tabla'}
              </button>
            )}
          </div>
        </header>
      )}
      {tabla && verTabla ? tabla : children}
    </section>
  );
}

export function Cifra({ etiqueta, valor, detalle, delta, deltaBueno = true }) {
  const n = delta === null || delta === undefined ? null : Number(delta);
  const clase = n === null || n === 0 ? '' : (n > 0) === deltaBueno ? 'bien' : 'mal';
  return (
    <div className="cifra">
      <span className="cifra-etq">{etiqueta}</span>
      <strong className="cifra-val">{valor}</strong>
      <span className="cifra-det">
        {n !== null && <span className={`delta ${clase}`}>{n > 0 ? '▲' : n < 0 ? '▼' : '＝'} {pctSigno(delta)}</span>} {detalle}
      </span>
    </div>
  );
}

/** Cambio de posición: ▲ sube (verde) · ▼ baja (rojo) · = se mantiene. Siempre con símbolo y número, nunca solo color. */
export function Cambio({ valor }) {
  if (valor === null || valor === undefined) return <span className="tenue" title="Sin período anterior">—</span>;
  if (valor === 0) return <span className="cambio igual" title="Se mantiene">＝</span>;
  return (
    <span className={`cambio ${valor > 0 ? 'sube' : 'baja'}`} title={valor > 0 ? `Sube ${valor}` : `Baja ${-valor}`}>
      {valor > 0 ? '▲' : '▼'} {Math.abs(valor)}
    </span>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return <div className="estado-vacio" role="status"><span className="girador" aria-hidden="true" /> {texto}</div>;
}

export function Aviso({ error, tipo = 'error', children }) {
  if (!error && !children) return null;
  return (
    <div className={`alerta ${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {error ? error.message : children}
      {error?.detalles?.length > 0 && <ul>{error.detalles.map((d) => <li key={d}>{d}</li>)}</ul>}
    </div>
  );
}

export function SinPermiso({ perfil }) {
  return (
    <div className="tarjeta bloqueo">
      <h2>Sección restringida</h2>
      <p>Esta sección es para el perfil <b>{perfil}</b>. Inicie sesión con el botón «Entrar» de la parte superior.</p>
      <Link to="/" className="boton">Volver al panel</Link>
    </div>
  );
}

export function Insignia({ tipo, children }) {
  return <span className={`insignia ${tipo ?? ''}`}>{children}</span>;
}

export function Selector({ etiqueta, valor, onChange, opciones, todos, id }) {
  return (
    <label className="campo" htmlFor={id}>
      <span>{etiqueta}</span>
      <select id={id} value={valor ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        {todos && <option value="">{todos}</option>}
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
    </label>
  );
}

/**
 * Tabla ordenable. columnas: [{ clave, titulo, num?, render?(fila), orden?(fila) }]
 */
export function Tabla({ columnas, filas, inicial, claveFila, resaltar, vacia = 'Sin datos.', compacta, pie }) {
  const [orden, setOrden] = useState(inicial ?? { clave: null, asc: true });
  const ordenadas = useMemo(() => {
    if (!orden.clave) return filas;
    const col = columnas.find((c) => c.clave === orden.clave);
    const valor = col?.orden ?? ((f) => f[orden.clave]);
    return [...filas].sort((a, b) => {
      const x = valor(a), y = valor(b);
      const r = x === y ? 0 : x === null || x === undefined ? 1 : y === null || y === undefined ? -1 : x < y ? -1 : 1;
      return orden.asc ? r : -r;
    });
  }, [filas, orden, columnas]);
  const clic = (c) => setOrden((o) => ({ clave: c.clave, asc: o.clave === c.clave ? !o.asc : !c.num }));
  return (
    <div className="tabla-envoltura">
      <table className={`tabla ${compacta ? 'compacta' : ''}`}>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.clave} className={c.num ? 'num' : ''} aria-sort={orden.clave === c.clave ? (orden.asc ? 'ascending' : 'descending') : 'none'}>
                <button type="button" onClick={() => clic(c)} title="Ordenar">
                  {c.titulo}<span className="flecha" aria-hidden="true">{orden.clave === c.clave ? (orden.asc ? ' ↑' : ' ↓') : ''}</span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.length === 0 && <tr><td colSpan={columnas.length} className="tenue">{vacia}</td></tr>}
          {ordenadas.map((f, i) => (
            <tr key={claveFila ? claveFila(f) : i} className={resaltar?.(f) ? 'resaltada' : ''}>
              {columnas.map((c) => <td key={c.clave} className={c.num ? 'num' : ''}>{c.render ? c.render(f) : f[c.clave]}</td>)}
            </tr>
          ))}
        </tbody>
        {pie && <tfoot>{pie}</tfoot>}
      </table>
    </div>
  );
}

export function BotonDescarga({ href, children, chico }) {
  return <a className={`boton secundario ${chico ? 'chico' : ''}`} href={href} download>⤓ {children}</a>;
}
