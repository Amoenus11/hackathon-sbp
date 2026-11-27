// Piezas pequeñas que se repiten en las páginas.
import { useEffect, useRef } from 'react';
import { urlExportar } from '../api.js';
import { colorBanco } from '../tema.js';
import { TIPOS_RANKING } from '../formato.js';

export function EncabezadoPagina({ titulo, subtitulo, children }) {
  return (
    <div className="encabezado-pagina">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p className="subtitulo">{subtitulo}</p>}
      </div>
      {children && <div className="encabezado-acciones">{children}</div>}
    </div>
  );
}

export function Tarjeta({ titulo, subtitulo, acciones, children, className = '', id }) {
  return (
    <section className={`tarjeta ${className}`} aria-labelledby={titulo && id ? `${id}-titulo` : undefined}>
      {(titulo || acciones) && (
        <div className="tarjeta-cabecera">
          <div>
            {titulo && <h2 id={id ? `${id}-titulo` : undefined}>{titulo}</h2>}
            {subtitulo && <p className="tarjeta-subtitulo">{subtitulo}</p>}
          </div>
          {acciones && <div className="tarjeta-acciones">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function KPI({ titulo, valor, detalle, variacion, tendencia, ayuda }) {
  return (
    <div className="kpi" title={ayuda}>
      <p className="kpi-titulo">{titulo}</p>
      <p className="kpi-valor num">{valor}</p>
      <div className="kpi-pie">
        {variacion && <span className={`kpi-variacion ${tendencia || ''}`}>{variacion}</span>}
        {detalle && <span className="kpi-detalle">{detalle}</span>}
      </div>
    </div>
  );
}

export function InsigniaTipo({ tipo }) {
  const t = TIPOS_RANKING[tipo];
  if (!t) return null;
  return <span className={`insignia ${t.clase}`}>{t.texto}</span>;
}

export function Insignia({ children, tono = 'neutro' }) {
  return <span className={`insignia insignia-${tono}`}>{children}</span>;
}

export function PuntoBanco({ codigo }) {
  return <span className="punto-banco" style={{ background: colorBanco(codigo) }} aria-hidden="true" />;
}

export function NombreBanco({ codigo, nombre }) {
  return (
    <span className="nombre-banco">
      <PuntoBanco codigo={codigo} />
      <span>{nombre}</span>
      <span className="codigo-banco">{codigo}</span>
    </span>
  );
}

export function BotonDescarga({ tipo, fecha, children }) {
  return (
    <a className="boton boton-secundario boton-chico" href={urlExportar(tipo, fecha)} download>
      <span aria-hidden="true">⤓</span> {children}
    </a>
  );
}

// Pestañas accesibles (role=tablist)
export function Pestanas({ opciones, valor, alCambiar, etiqueta, compactas }) {
  return (
    <div className={`pestanas ${compactas ? 'pestanas-compactas' : ''}`} role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.valor} type="button" role="tab" aria-selected={valor === o.valor}
          className={`pestana ${valor === o.valor ? 'activa' : ''}`} onClick={() => alCambiar(o.valor)}
        >
          {o.texto}
          {o.extra}
        </button>
      ))}
    </div>
  );
}

// Panel que se desliza desde la derecha (detalle de un banco, de un nodo del diagrama…)
export function PanelLateral({ titulo, abierto, alCerrar, children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    ref.current?.focus();
    const alTeclear = (e) => { if (e.key === 'Escape') alCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [abierto, alCerrar]);
  if (!abierto) return null;
  return (
    <>
      <button type="button" className="velo velo-lateral" aria-label="Cerrar panel" onClick={alCerrar} />
      <aside className="panel-lateral" role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1} ref={ref}>
        <div className="panel-lateral-cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="boton-cerrar" onClick={alCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="panel-lateral-cuerpo">{children}</div>
      </aside>
    </>
  );
}

export function Campo({ etiqueta, children, ancho }) {
  return (
    <label className={`campo ${ancho ? 'campo-ancho' : ''}`}>
      <span>{etiqueta}</span>
      {children}
    </label>
  );
}

export function Leyenda({ children }) {
  return <p className="leyenda">{children}</p>;
}
