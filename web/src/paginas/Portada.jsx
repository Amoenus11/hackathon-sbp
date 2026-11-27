// Portada para el perfil Público: tres preguntas en lenguaje simple (Idea 0 de «innovación SBP»).
// Todas las cifras salen de la API (/api/matriz y /api/panel): nada fijo en el código (R2).
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp, useDatos } from '../contexto.jsx';
import { etiquetaPeriodo } from '../formato.js';
import { TarjetaCambios, TarjetaComposicion } from './Panel.jsx';
import './portada.css';

// Los 6 rankings con nombre cotidiano e ícono de línea
const TEMAS = [
  { ranking: 'HIPOTECARIO', nombre: 'Vivienda', icono: <><path d="M3 11l9-7 9 7v9H3z" /><path d="M10 20v-6h4v6" /></> },
  { ranking: 'CONSTRUCCION', nombre: 'Construcción', icono: <><path d="M4 20h16M6 20V9l6-4 6 4v11" /><path d="M10 13h4M10 16h4" /></> },
  { ranking: 'INDUSTRIA', nombre: 'Industria', icono: <path d="M3 20V10l6 4V10l6 4V6h6v14z" /> },
  { ranking: 'AGROPECUARIO', nombre: 'Campo', icono: <><path d="M12 21V9" /><path d="M12 13c-4 0-6-3-6-6 4 0 6 2 6 6zM12 11c0-4 2-6 6-6 0 3-2 6-6 6z" /></> },
  { ranking: 'COMERCIO', nombre: 'Comercio', icono: <><path d="M4 9h16l-1 11H5z" /><path d="M9 9V6a3 3 0 016 0v3" /></> },
  { ranking: 'CONSUMO', nombre: 'Personal, auto y tarjeta', icono: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h3" /></> },
];

const corto = (nombre) => String(nombre || '').replace(/^Banco\s+/, '');
const enM = (saldo) => `${(Number(saldo) / 1e6).toLocaleString('es-PA', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;

function Icono({ children, className = 'po-icono' }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
}

// Sección que entra suavemente al aparecer en pantalla
function Seccion({ children, retraso = 0, className = '' }) {
  const ref = useRef(null);
  const [dentro, setDentro] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setDentro(true); }), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section ref={ref} className={`po-seccion ${dentro ? 'po-dentro' : ''} ${className}`} style={{ transitionDelay: `${retraso}ms` }}>
      {children}
    </section>
  );
}

// Pregunta 1: ¿quién va ganando, y por cuánto? Carrera en carriles (cada banco en su propia línea).
function QuienGana({ matriz }) {
  const [tema, setTema] = useState('COMERCIO');
  const [visible, setVisible] = useState(true);
  const t = TEMAS.find((x) => x.ranking === tema);
  const top = useMemo(() => matriz.bancos
    .map((b) => ({ banco: corto(b.banco), saldo: Number(b.celdas.find((c) => c.ranking === tema)?.saldo || 0) }))
    .sort((a, b) => b.saldo - a.saldo).slice(0, 5), [matriz, tema]);
  const ventaja = top[0].saldo - top[1].saldo;
  const relativa = top[0].saldo ? ventaja / top[0].saldo : 0;
  const [clase, sello] = relativa < 0.01 ? ['empate', 'Casi un empate'] : relativa < 0.03 ? ['renido', 'Muy reñido'] : ['clara', 'Ventaja clara'];
  const lejos = top[0].saldo - top[4].saldo || 1;

  function elegir(r) {
    if (r === tema) return;
    setVisible(false);
    setTimeout(() => { setTema(r); setVisible(true); }, 280);
  }

  return (
    <>
      <h2 className="po-pregunta">¿Quién va ganando, y por cuánto?<span>Elige un tema</span></h2>
      <div className="po-temas" role="group" aria-label="Temas">
        {TEMAS.map((x) => (
          <button key={x.ranking} type="button" className={`po-tema ${x.ranking === tema ? 'po-activo' : ''}`} onClick={() => elegir(x.ranking)} aria-pressed={x.ranking === tema}>
            <Icono>{x.icono}</Icono>{x.nombre}
          </button>
        ))}
      </div>
      <p className={`po-titular ${visible ? '' : 'po-fuera'}`}>
        En {t.nombre.toLowerCase()}, <b>Banco {top[0].banco}</b> va primero por {enM(ventaja)}.
      </p>
      <span className={`po-sello po-${clase}`}>{sello}</span>
      <div className="po-pista" aria-label={`Los 5 primeros bancos en ${t.nombre}`}>
        {top.map((b, k) => (
          <div key={k} className="po-carril">
            <span className="po-carril-nombre">{b.banco}</span>
            <div className="po-via">
              <div className={`po-corredor ${k === 0 ? 'po-uno' : ''}`} style={{ left: `${4 + 92 * (1 - (top[0].saldo - b.saldo) / lejos)}%` }}><b /></div>
            </div>
            <span className="po-distancia num">{k === 0 ? enM(b.saldo) : `−${enM(top[0].saldo - b.saldo)}`}</span>
          </div>
        ))}
      </div>
      <div className="po-eje"><span>← más lejos del primero</span><span>primero</span></div>
      <p className="po-nota">La distancia en la pista está ampliada (del 5.º al 1.º) para que se note; las cifras exactas van en el texto.</p>
    </>
  );
}

// Pregunta 2: ¿qué tiene de distinto este banco? Desviación de su ponderación frente al promedio de los 12.
function QueLoDistingue({ matriz }) {
  const [codigo, setCodigo] = useState(matriz.bancos[0]?.codigo_banco);
  const promedio = useMemo(() => TEMAS.map((t) => matriz.bancos.reduce((s, b) => s + Number(b.celdas.find((c) => c.ranking === t.ranking)?.ponderacion_pct || 0), 0) / matriz.bancos.length), [matriz]);
  const banco = matriz.bancos.find((b) => b.codigo_banco === codigo) || matriz.bancos[0];
  const desvios = TEMAS.map((t, i) => Number(banco.celdas.find((c) => c.ranking === t.ranking)?.ponderacion_pct || 0) - promedio[i]);
  const destaca = desvios.map((d, i) => [d, i]).filter(([d]) => d >= 2).sort((a, b) => b[0] - a[0]);
  return (
    <>
      <h2 className="po-pregunta">¿Qué tiene de distinto este banco?<span>Comparado con el promedio de los 12 bancos</span></h2>
      <select className="po-selector" value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-label="Banco">
        {matriz.bancos.map((b) => <option key={b.codigo_banco} value={b.codigo_banco}>{b.banco}</option>)}
      </select>
      <div className="po-desvios">
        {TEMAS.map((t, i) => {
          const d = desvios[i];
          const ancho = (Math.min(Math.abs(d), 5) / 5) * 50;
          return (
            <div key={t.ranking} className="po-desvio">
              <span>{t.nombre}</span>
              <div className="po-barra-carril" title={`${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} puntos frente al promedio`}>
                <i className={d >= 0 ? 'po-mas' : 'po-menos'} style={{ width: `${ancho}%`, left: `${d >= 0 ? 50 : 50 - ancho}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="po-eje po-eje-desvio"><span>menos que el promedio</span><span>más</span></div>
      <p className="po-lectura">
        {destaca.length
          ? <><b>{banco.banco}</b> dedica más que el promedio a {destaca.map(([d, i]) => `${TEMAS[i].nombre.toLowerCase()} (+${d.toFixed(1)} puntos)`).join(' y ')}.</>
          : <><b>{banco.banco}</b> reparte su crédito casi igual que el promedio: no se especializa en un tema.</>}
      </p>
    </>
  );
}

// Pregunta 3: ¿qué cambió este mes? Tres frases de las explicaciones automáticas, rotando.
function QueCambio({ frases }) {
  const [n, setN] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (frases.length < 2) return undefined;
    const reloj = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setN((x) => (x + 1) % frases.length); setVisible(true); }, 450);
    }, 4200);
    return () => clearInterval(reloj);
  }, [frases.length]);
  return <p className={`po-frase ${visible ? '' : 'po-fuera'}`}>{frases[n]}</p>;
}

export default function Portada() {
  const { meta, fecha, abrirSesion } = useApp();
  const matriz = useDatos(() => (fecha ? api.matriz(fecha) : null), [fecha]);
  const panel = useDatos(() => (fecha ? api.panel(fecha) : null), [fecha]);
  const anterior = panel.datos?.fecha_anterior;
  const frases = (panel.datos?.destacados || []).slice(0, 3).map((d) => d.texto);

  return (
    <div className="po">
      <header className="po-cabeza">
        <h1 className="po-titulo">¿A qué bancos les confían más dinero en Panamá?</h1>
        <p className="po-sub">
          {etiquetaPeriodo(fecha, meta)} · Fuente: {meta?.fuente} · <span className="po-ficticios">DATOS FICTICIOS</span>
        </p>
        <div className="po-que">
          <Icono className="po-icono po-icono-info"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icono>
          <p>
            <b>Un crédito</b> es dinero que el banco presta y que personas o empresas le devuelven poco a poco.
            {' '}<b>Estar primero</b> en un tema significa que es el banco al que más dinero le deben ahí.
          </p>
        </div>
      </header>

      {matriz.error && <p className="mensaje-error">{matriz.error.message}</p>}
      {matriz.datos && matriz.datos.bancos.length >= 5 && (
        <>
          <Seccion><QuienGana matriz={matriz.datos} /></Seccion>
          <Seccion retraso={120}><QueLoDistingue matriz={matriz.datos} /></Seccion>
        </>
      )}
      {anterior && frases.length > 0 && (
        <Seccion retraso={240}>
          <h2 className="po-pregunta">¿Qué cambió este mes?<span>Frente a {etiquetaPeriodo(anterior, meta)}</span></h2>
          <QueCambio frases={frases} />
        </Seccion>
      )}

      {panel.datos && (
        <div className="po-tarjetas">
          <TarjetaCambios datos={panel.datos} />
          <TarjetaComposicion datos={panel.datos} />
        </div>
      )}

      <p className="po-entrar">
        ¿Trabajas en la SBP? <button type="button" className="enlace-boton" onClick={abrirSesion}>Inicia sesión para ver el panel completo</button>
      </p>
    </div>
  );
}
