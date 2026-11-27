// «Carta al banco»: borrador formal con las filas que se le excluyeron, para pedir correcciones.
// E1, E3 y E4 son observaciones a corregir; E2 (destino extranjero) es solo información.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp, useDatos } from '../contexto.jsx';
import { Carga } from '../componentes/Estados.jsx';
import { entero } from '../formato.js';
import './carta.css';

const NOMBRES = { E1: 'duplicadas', E3: 'con saldo no positivo', E4: 'con actividad no catalogada' };

function textoCarta(d) {
  const c = d.conteos;
  const obs = ['E1', 'E3', 'E4'].filter((k) => c[k] > 0).map((k) => `${entero(c[k])} filas ${NOMBRES[k]} (${k})`);
  const lineas = [
    `Superintendencia de Bancos de Panamá — Calidad de datos AT03 · ${d.etiqueta}`,
    '(Borrador generado automáticamente · datos ficticios)',
    '',
    `Señores ${d.banco}:`,
    '',
    obs.length
      ? `En la revisión de su reporte AT03 del período ${d.etiqueta} se excluyeron del cálculo de los rankings ${obs.join(', ')}. Les solicitamos revisar y corregir estas operaciones en su próximo envío. Se adjunta la lista con el número de préstamo, la fila del archivo y el motivo.`
      : `En la revisión de su reporte AT03 del período ${d.etiqueta} no se encontraron observaciones de calidad (duplicados, saldos no positivos ni actividades fuera del catálogo).`,
    '',
    c.E2 > 0 ? `Para su información: ${entero(c.E2)} operaciones con destino extranjero (E2) no forman parte del ranking local. No constituyen un error.` : '',
    '',
    'Atentamente,',
    'Dirección de Estudios Financieros (borrador)',
  ];
  return lineas.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

function csvDeFilas(filas) {
  const col = ['Numero_Prestamo', 'Fila', 'Filtro', 'Motivo', 'Destino', 'Saldo', 'Tipo_Actividad'];
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [col.join(','), ...filas.map((f) => [f.numero_prestamo, f.fila, f.filtro, f.motivo, f.destino, f.saldo, f.tipo_actividad].map(esc).join(','))].join('\r\n');
}

export default function Carta() {
  const { meta, fecha } = useApp();
  const [parametros, setParametros] = useSearchParams();
  const banco = parametros.get('banco') || meta?.bancos?.[0]?.codigo || '';
  const estado = useDatos(() => (fecha && banco ? api.carta(fecha, banco) : null), [fecha, banco]);
  return (
    <div className="car">
      <header className="car-cabecera">
        <div>
          <h1>Carta al banco</h1>
          <p className="car-subtitulo">La SBP no solo mide: le devuelve a cada banco cómo mejorar sus datos.</p>
        </div>
        <label className="car-selector">
          <span>Banco</span>
          <select value={banco} onChange={(e) => setParametros({ banco: e.target.value })}>
            {(meta?.bancos || []).map((b) => <option key={b.codigo} value={b.codigo}>{b.codigo} · {b.nombre}</option>)}
          </select>
        </label>
      </header>
      <Carga estado={estado} filas={8}>{(d) => <Documento d={d} />}</Carga>
    </div>
  );
}

function Documento({ d }) {
  const [copiado, setCopiado] = useState(false);
  const texto = useMemo(() => textoCarta(d), [d]);
  const observadas = d.filas.filter((f) => f.filtro !== 'E2');
  const informativas = d.filas.filter((f) => f.filtro === 'E2');

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { setCopiado(false); }
  }
  function descargar() {
    const blob = new Blob([csvDeFilas(d.filas)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `carta_${d.codigo_banco}_${d.fecha}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <div className="car-acciones">
        <button type="button" className="boton boton-primario boton-chico" onClick={copiar}>{copiado ? 'Copiado ✓' : 'Copiar texto'}</button>
        <button type="button" className="boton boton-secundario boton-chico" onClick={descargar}>Descargar CSV</button>
        <button type="button" className="boton boton-secundario boton-chico" onClick={() => window.print()}>Imprimir / PDF</button>
      </div>
      <article className="car-hoja">
        <header className="car-hoja-cabecera">
          <strong>Superintendencia de Bancos de Panamá — Calidad de datos AT03 · {d.etiqueta}</strong>
          <small>Borrador generado automáticamente · datos ficticios</small>
        </header>
        <p className="car-saludo">Señores {d.banco}:</p>
        {texto.split('\n').slice(5).filter((l) => l && !l.startsWith('Atentamente') && !l.startsWith('Dirección')).map((l) => (
          <p key={l} className={l.startsWith('Para su información') ? 'car-info' : ''}>{l}</p>
        ))}
        <div className="car-conteos">
          {['E1', 'E3', 'E4'].map((k) => (
            <div key={k} className="car-conteo"><span>{k}</span><strong>{entero(d.conteos[k])}</strong><small>{NOMBRES[k]}</small></div>
          ))}
          <div className="car-conteo car-conteo-info"><span>E2</span><strong>{entero(d.conteos.E2)}</strong><small>destino extranjero (información)</small></div>
        </div>
        <h2>Operaciones observadas ({entero(observadas.length)})</h2>
        {observadas.length ? <TablaFilas filas={observadas} /> : <p className="car-vacio">Sin observaciones.</p>}
        {informativas.length > 0 && (
          <details className="car-detalles">
            <summary>Operaciones con destino extranjero, solo información ({entero(informativas.length)})</summary>
            <TablaFilas filas={informativas} />
          </details>
        )}
        <p className="car-firma">Atentamente,<br />Dirección de Estudios Financieros (borrador)</p>
      </article>
    </>
  );
}

function TablaFilas({ filas }) {
  return (
    <div className="car-tabla-envoltura">
      <table className="car-tabla">
        <thead><tr><th>Número de préstamo</th><th className="num">Fila</th><th>Filtro</th><th>Motivo</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={`${f.filtro}-${f.fila}`}><td className="mono">{f.numero_prestamo}</td><td className="num">{entero(f.fila)}</td><td>{f.filtro}</td><td>{f.motivo}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
