// Diapositivas del pitch (estilo keynote) para presentar a pantalla completa en el navegador.
// Teclas: → · espacio · clic = siguiente  ·  ← = anterior  ·  F = pantalla completa  ·  Esc = salir de ella.
// En el teléfono: deslizar a la izquierda o a la derecha.
// Las cifras de los datos vienen EN VIVO de la API (nada inventado): si algo no carga, se muestra el texto sin la cifra.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import { entero, montoCorto } from '../formato.js';
import './pitch.css';

// Hechos del proyecto que no salen de la API (verificados en el repositorio):
//  - DIFERENCIAS: resultado de verificacion/comparar.py contra la implementación de referencia en Python.
//  - PRUEBAS: número de test() en pruebas/*.test.js (ejecuta «npm test» para confirmarlo).
const HECHOS = { diferencias: 0, exportaciones: 5, pruebas: 17 };

// Cifras en vivo: metadatos (períodos, bancos, rankings) y el panel del período más reciente
function useCifras() {
  const { meta } = useApp() || {};
  const [panel, setPanel] = useState(null);
  const ultimo = meta?.ultimo;
  useEffect(() => {
    if (!ultimo) return undefined;
    let vigente = true;
    api.panel(ultimo).then((p) => { if (vigente) setPanel(p); }).catch(() => {});
    return () => { vigente = false; };
  }, [ultimo]);
  const periodos = meta?.periodos || [];
  return {
    panel,
    filasTotales: periodos.length ? periodos.reduce((s, p) => s + (Number(p.filas_leidas) || 0), 0) : null,
    periodos: periodos.length || null,
    bancos: meta?.bancos?.length || null,
    rankings: meta?.rankings?.length || null,
  };
}

// ------------------------------------------------------------------ fondo: del caos al orden
// Puntos en rejilla que llegan desde posiciones desordenadas (pseudoazar fijo: siempre el mismo dibujo).
function CaosOrden() {
  const puntos = useMemo(() => {
    let semilla = 27;
    const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
    const lista = [];
    for (let fila = 0; fila < 6; fila++) {
      for (let col = 0; col < 14; col++) {
        lista.push({
          x: 80 + col * 80, y: 100 + fila * 80,
          dx: Math.round((azar() - 0.5) * 520), dy: Math.round((azar() - 0.5) * 360),
          retraso: Math.round((fila * 14 + col) * 18 + azar() * 300),
        });
      }
    }
    return lista;
  }, []);
  return (
    <svg className="pt-caos" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="pt-degradado-puntos" x1="0" y1="0" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0e7c86" /><stop offset="1" stopColor="#5b4bdb" />
        </linearGradient>
      </defs>
      {puntos.map((p) => (
        <circle
          key={`${p.x}-${p.y}`} className="pt-punto" cx={p.x} cy={p.y} r="6" fill="url(#pt-degradado-puntos)"
          style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--retraso': `${p.retraso}ms` }}
        />
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------ diapositivas
function Portada() {
  return (
    <>
      <CaosOrden />
      <div className="pt-contenido pt-centro">
        <h1 className="pt-marca">SYNTROPY</h1>
        <p className="pt-lema">Del caos de datos al orden de las decisiones</p>
        <p className="pt-firma">Gui · Nathalia · Aníbal — Hackathon SBP 2026</p>
      </div>
    </>
  );
}

function Problema({ cifras }) {
  const { bancos, rankings, periodos, filasTotales } = cifras;
  const dimensiones = bancos && rankings && periodos;
  return (
    <div className="pt-contenido">
      <p className="pt-antetitulo">El problema</p>
      <h2 className="pt-titular">Hoy, comparar el crédito bancario es lento y opaco.</h2>
      <div className="pt-trio">
        <div className="pt-dato">
          <strong>Excel y PDF</strong>
          <span>así se consultan hoy las estadísticas</span>
        </div>
        <div className="pt-dato">
          <strong>{dimensiones ? `${bancos} × ${rankings} × ${periodos}` : 'Bancos × actividades × meses'}</strong>
          <span>{dimensiones ? `${bancos} bancos × ${rankings} actividades × ${periodos} meses` : 'para comparar a mano'}</span>
        </div>
        <div className="pt-dato">
          <strong>{filasTotales ? entero(filasTotales) : 'Miles'}</strong>
          <span>registros, con errores intencionales que hay que detectar</span>
        </div>
      </div>
    </div>
  );
}

function Solucion() {
  return (
    <div className="pt-contenido pt-centro">
      <p className="pt-antetitulo">La solución</p>
      <h2 className="pt-frase">
        Un observatorio que calcula los rankings <span className="pt-resaltado">al centavo</span>,{' '}
        <span className="pt-resaltado">explica</span> cada cambio y deja <span className="pt-resaltado">rastro</span> de cada decisión.
      </h2>
    </div>
  );
}

function Demo({ cifras, irALaApp }) {
  const k = cifras.panel?.kpis;
  return (
    <div className="pt-contenido pt-centro">
      <p className="pt-antetitulo">Demostración</p>
      <h2 className="pt-titular">Veámoslo en vivo</h2>
      {k && (
        <>
          <p className="pt-gigante">{montoCorto(k.cartera_total)}</p>
          <p className="pt-pie-cifra">
            de cartera local válida en {entero(k.operaciones)} préstamos válidos
            {cifras.panel?.etiqueta ? ` · ${cifras.panel.etiqueta}` : ''}
          </p>
        </>
      )}
      <button type="button" className="pt-boton" onClick={irALaApp}>Ver en vivo →</button>
    </div>
  );
}

function Confianza() {
  const tarjetas = [
    { valor: String(HECHOS.diferencias), titulo: 'diferencias', texto: `contra una segunda implementación independiente en Python, en las ${HECHOS.exportaciones} exportaciones oficiales` },
    { valor: String(HECHOS.pruebas), titulo: 'pruebas automáticas', texto: 'reglas, perfiles, carga de un mes nuevo y exportaciones, en cada publicación' },
    { valor: '¢', titulo: 'Centavos enteros', texto: 'nunca decimales binarios: no se pierde ni un centavo en ninguna suma' },
    { valor: '✦', titulo: 'IA que no calcula', texto: 'explica las cifras oficiales; vive aislada y solo puede leer' },
  ];
  return (
    <div className="pt-contenido">
      <p className="pt-antetitulo">Por qué confiar</p>
      <h2 className="pt-titular">Exacto. Verificado. Explicable.</h2>
      <div className="pt-tarjetas">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="pt-tarjeta">
            <strong className="pt-tarjeta-valor">{t.valor}</strong>
            <span className="pt-tarjeta-titulo">{t.titulo}</span>
            <span className="pt-tarjeta-texto">{t.texto}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Impacto() {
  const puntos = ['Acceso para todos', 'Rankings claros y verificables', 'Comparación inmediata entre bancos y meses', 'Base para servicios digitales'];
  return (
    <div className="pt-contenido">
      <p className="pt-antetitulo">Impacto para la SBP</p>
      <h2 className="pt-titular pt-titular-grande">
        De horas de Excel a <span className="pt-resaltado">2 segundos</span> por mes.
      </h2>
      <ul className="pt-puntos">
        {puntos.map((p) => (
          <li key={p}><span className="pt-check" aria-hidden="true">✓</span>{p}</li>
        ))}
      </ul>
    </div>
  );
}

function Cierre() {
  return (
    <div className="pt-contenido pt-centro">
      <h2 className="pt-titular">Rankings confiables para decisiones mejor informadas.</h2>
      <p className="pt-dominio">syntropy.com.pa</p>
      <p className="pt-marca-chica">SYNTROPY</p>
    </div>
  );
}

const DIAPOSITIVAS = [
  { titulo: 'Portada', Componente: Portada },
  { titulo: 'El problema', Componente: Problema },
  { titulo: 'La solución', Componente: Solucion },
  { titulo: 'Demostración', Componente: Demo },
  { titulo: 'Por qué confiar', Componente: Confianza },
  { titulo: 'Impacto', Componente: Impacto },
  { titulo: 'Cierre', Componente: Cierre },
];

// ------------------------------------------------------------------ presentador
export default function Pitch() {
  const cifras = useCifras();
  const navegar = useNavigate();
  const { setPaso } = useApp() || {}; // «Ver en vivo» arranca la presentación guiada
  const raiz = useRef(null);
  const toque = useRef(null);
  // Se puede abrir directo en una diapositiva: /pitch#4 (y la dirección sigue a la diapositiva actual)
  const [indice, setIndice] = useState(() => {
    const n = parseInt(window.location.hash.slice(1), 10);
    return Number.isInteger(n) && n >= 1 && n <= DIAPOSITIVAS.length ? n - 1 : 0;
  });
  const [direccion, setDireccion] = useState(1);
  const total = DIAPOSITIVAS.length;

  const ir = useCallback((destino) => {
    const d = Math.max(0, Math.min(total - 1, destino));
    if (d === indice) return;
    setDireccion(d > indice ? 1 : -1);
    setIndice(d);
  }, [indice, total]);
  const siguiente = useCallback(() => ir(indice + 1), [ir, indice]);
  const anterior = useCallback(() => ir(indice - 1), [ir, indice]);

  const pantallaCompleta = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else (raiz.current || document.documentElement).requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => { window.history.replaceState(null, '', `#${indice + 1}`); }, [indice]);

  useEffect(() => {
    const alTeclear = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); siguiente(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); anterior(); }
      else if (e.key === 'f' || e.key === 'F') pantallaCompleta();
      else if (e.key === 'Home') ir(0);
      else if (e.key === 'End') ir(total - 1);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [siguiente, anterior, pantallaCompleta, ir, total]);

  const { Componente, titulo } = DIAPOSITIVAS[indice];
  return (
    <div
      ref={raiz}
      className="pt-raiz"
      role="region"
      aria-roledescription="presentación"
      aria-label="Pitch de Syntropy"
      onClick={(e) => { if (!e.target.closest('a, button')) siguiente(); }}
      onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toque.current === null) return;
        const dx = e.changedTouches[0].clientX - toque.current;
        toque.current = null;
        if (Math.abs(dx) > 50) (dx < 0 ? siguiente : anterior)();
      }}
    >
      <Link to="/" className="pt-volver">← Volver a la app</Link>
      <button type="button" className="pt-completa" onClick={pantallaCompleta} title="Pantalla completa (F)">⤢ Pantalla completa</button>

      <section
        key={indice}
        className="pt-diapo"
        style={{ '--pt-desde': `${direccion * 28}px` }}
        aria-label={`Diapositiva ${indice + 1} de ${total}: ${titulo}`}
        aria-live="polite"
      >
        <Componente cifras={cifras} irALaApp={() => { navegar('/'); if (setPaso) setPaso(0); }} />
      </section>

      <nav className="pt-progreso" aria-label="Diapositivas">
        {DIAPOSITIVAS.map((d, i) => (
          <button
            key={d.titulo} type="button" aria-label={`Ir a ${d.titulo}`} aria-current={i === indice ? 'step' : undefined}
            className={i === indice ? 'pt-activo' : ''} onClick={() => ir(i)}
          />
        ))}
      </nav>
      <span className="pt-contador" aria-hidden="true">{indice + 1} / {total}</span>
      <span className="pt-ayuda" aria-hidden="true">← → para avanzar · F pantalla completa</span>
    </div>
  );
}
