// Bitácora de conversión de una carga: qué se corrigió automáticamente (ceros a la izquierda, fechas de Excel,
// decimales con coma, encabezados) y qué conviene revisar. También el error detallado si la carga falla
// y el historial de cargas para el uso diario.
import { api } from '../api.js';
import { useDatos } from '../contexto.jsx';
import { entero, fechaHora } from '../formato.js';
import './producto.css';

const ICONOS = { encabezado: 'Aa', ceros_izquierda: '07', fecha_excel: '📅', fecha_texto: '📅', decimal: '0.00' };
const TITULOS = {
  encabezado: 'Nombre de columna corregido',
  ceros_izquierda: 'Ceros a la izquierda restaurados',
  fecha_excel: 'Fecha de Excel convertida',
  fecha_texto: 'Fecha en texto convertida',
  decimal: 'Decimal con coma convertido',
};

function Ejemplos({ ejemplos }) {
  if (!ejemplos?.length) return null;
  return (
    <ul className="pr-ejemplos">
      {ejemplos.slice(0, 3).map((e, i) => (
        <li key={i}>
          {e.fila != null && <span className="pr-ejemplo-fila">fila {entero(e.fila)}</span>}
          <code>{String(e.antes ?? '')}</code>
          {e.despues !== undefined && <><span aria-hidden="true"> → </span><code>{String(e.despues)}</code></>}
        </li>
      ))}
    </ul>
  );
}

export function Bitacora({ conversion }) {
  if (!conversion) return null;
  const correcciones = conversion.correcciones || [];
  const advertencias = conversion.advertencias || [];
  const formato = [
    conversion.formato?.toUpperCase(),
    conversion.hoja ? `hoja «${conversion.hoja}»` : null,
    conversion.codificacion,
    conversion.separador ? `separador «${conversion.separador}»` : null,
  ].filter(Boolean).join(' · ');
  return (
    <section className="pr-bitacora" aria-labelledby="bitacora-titulo">
      <div className="pr-bitacora-resumen">
        <h3 id="bitacora-titulo">Bitácora de conversión</h3>
        <p>
          <strong>{entero(conversion.filas)}</strong> filas leídas · <strong>{correcciones.length}</strong> correcci{correcciones.length === 1 ? 'ón' : 'ones'} automática{correcciones.length === 1 ? '' : 's'} ·{' '}
          <strong>{advertencias.length}</strong> advertencia{advertencias.length === 1 ? '' : 's'}
        </p>
        {formato && <p className="pr-nota">{formato}</p>}
      </div>
      {correcciones.length === 0 && advertencias.length === 0 && (
        <p className="pr-limpio">✓ El archivo llegó limpio: no hizo falta corregir nada.</p>
      )}
      <div className="pr-correcciones">
        {correcciones.map((c, i) => (
          <article key={`c${i}`} className="pr-correccion">
            <span className="pr-correccion-icono" aria-hidden="true">{ICONOS[c.tipo] || '✓'}</span>
            <div>
              <strong>{TITULOS[c.tipo] || c.tipo}{c.columna ? ` · ${c.columna}` : ''}</strong>
              <span className="pr-cantidad">{entero(c.cantidad)} {c.cantidad === 1 ? 'celda' : 'celdas'}</span>
              {c.descripcion && <p>{c.descripcion}</p>}
              <Ejemplos ejemplos={c.ejemplos} />
            </div>
          </article>
        ))}
        {advertencias.map((a, i) => (
          <article key={`a${i}`} className="pr-correccion pr-advertencia">
            <span className="pr-correccion-icono" aria-hidden="true">!</span>
            <div>
              <strong>Revisar{a.columna ? ` · ${a.columna}` : ''}</strong>
              {a.cantidad != null && <span className="pr-cantidad">{entero(a.cantidad)}</span>}
              {a.descripcion && <p>{a.descripcion}</p>}
              <Ejemplos ejemplos={a.ejemplos} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// Error de carga con lo que falta, sobra y lo que quizá quisiste decir
export function ErrorCarga({ error }) {
  if (!error) return null;
  const d = error.datos?.detalle;
  const sugerencias = d?.sugerencias ? Object.entries(d.sugerencias) : [];
  return (
    <div className="pr-error-carga" role="alert">
      <strong>No pudimos cargar el archivo</strong>
      <p>{error.message}</p>
      {d?.faltan?.length > 0 && <p><b>Faltan columnas:</b> {d.faltan.join(', ')}</p>}
      {d?.sobran?.length > 0 && <p><b>Columnas que no reconocemos:</b> {d.sobran.join(', ')}</p>}
      {sugerencias.length > 0 && (
        <ul className="pr-ejemplos">
          {sugerencias.map(([tiene, quiso]) => (
            <li key={tiene}>¿Quisiste decir <code>{quiso}</code>? En tu archivo dice <code>{tiene}</code>.</li>
          ))}
        </ul>
      )}
      <p className="pr-nota">No se cambió nada: tus datos anteriores siguen intactos. Corrige el archivo y vuelve a subirlo.</p>
    </div>
  );
}

// Historial de cargas (también las fallidas, con su error)
export function HistorialCargas() {
  const estado = useDatos(() => api.cargas(), []);
  if (estado.cargando) return <p className="pr-nota">Cargando historial…</p>;
  if (estado.error) return <p className="pr-nota">No se pudo leer el historial ({estado.error.message}).</p>;
  const cargas = estado.datos || [];
  if (!cargas.length) return <p className="pr-nota">Aún no hay cargas registradas.</p>;
  return (
    <table className="tabla tabla-compacta">
      <thead><tr><th scope="col">Cuándo</th><th scope="col">Quién</th><th scope="col">Archivo</th><th scope="col" className="numerica">Filas</th><th scope="col" className="numerica">Tiempo</th><th scope="col">Resultado</th></tr></thead>
      <tbody>
        {cargas.map((c, i) => (
          <tr key={i}>
            <td>{fechaHora(c.cuando)}</td>
            <td>{c.usuario || '—'}</td>
            <td className="mono">{c.archivo}<br /><span className="nota">{(c.formato || '').toUpperCase()}{c.fechas?.length ? ` · ${c.fechas.join(', ')}` : ''}</span></td>
            <td className="numerica num">{c.filas != null ? entero(c.filas) : '—'}</td>
            <td className="numerica num">{c.milisegundos != null ? `${(c.milisegundos / 1000).toFixed(1)} s` : '—'}</td>
            <td>
              {c.ok
                ? <span className="pr-ok">✓ {c.conversion?.correcciones?.length || 0} correcciones</span>
                : <span className="pr-mal" title={c.error}>✗ {String(c.error || 'Error').slice(0, 80)}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
