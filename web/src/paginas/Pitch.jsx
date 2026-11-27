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
const HECHOS = { diferencias: 0, exportaciones: 5, pruebas: 36 };

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
  const [pregunta, setPregunta] = useState(null);
  useEffect(() => {
    if (!ultimo || !meta?.rankings) return undefined;
    let vigente = true;
    (async () => {
      const orden = ['COMERCIO', ...meta.rankings.map((r) => r.nombre).filter((n) => n !== 'COMERCIO')];
      for (const ranking of orden) {
        try {
          const d = await api.anatomia(ultimo, ranking);
          const perdio = d.filas.find((f) => f.posicion_anterior === 1 && f.posicion_actual !== 1);
          const gano = d.filas.find((f) => f.posicion_actual === 1);
          if (perdio && gano && Number(perdio.nuevos) >= Number(gano.nuevos) && Number(perdio.terminados) > Number(gano.terminados)) {
            if (vigente) setPregunta({ ranking: meta.rankings.find((r) => r.nombre === ranking)?.titulo || ranking, perdio, gano });
            return;
          }
        } catch { return; }
      }
    })();
    return () => { vigente = false; };
  }, [ultimo, meta]);
  const [puente, setPuente] = useState(null);
  const [calidad, setCalidad] = useState(null);
  useEffect(() => {
    if (!ultimo) return;
    api.calidad(ultimo).then((c) => { setCalidad(c); setPuente(c.reconciliaciones?.find((r) => r.id === 'R4')?.puente || null); }).catch(() => {});
  }, [ultimo]);
  const periodos = meta?.periodos || [];
  return {
    calidad,
    nombresPeriodos: periodos.map((p) => p.etiqueta?.split(' ')[0]).filter(Boolean),
    puente,
    pregunta,
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
      {puntos.map((p, i) => (
        <g
          key={`${p.x}-${p.y}`} className="pt-punto"
          style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--retraso': `${p.retraso}ms`, '--titilar': `${(i * 37) % 900}ms` }}
        >
          <circle className="pt-punto-color" cx={p.x} cy={p.y} r="6" fill="url(#pt-degradado-puntos)" />
          <circle className="pt-estrella" cx={p.x} cy={p.y} r={1.5 + ((i * 7) % 5) * 0.6} fill="#fff" />
        </g>
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------ diapositivas
// Diapositiva 0: pantalla en negro antes de empezar (al avanzar, la portada nace de un cielo de estrellas)
function Negro() {
  return null;
}

function Portada() {
  return (
    <>
      <div className="pt-noche" aria-hidden="true" />
      <CaosOrden />
      <div className="pt-contenido pt-centro">
        <h1 className="pt-marca">SYNTROPY</h1>
        <p className="pt-lema">Del caos de datos al orden de las decisiones</p>
        <p className="pt-firma">Guillermo Aparicio · Nathalia Asyn · Aníbal Abrego — Hackathon SBP 2026</p>
      </div>
    </>
  );
}

// El problema, en palabras de cualquiera: quién sufre, por qué es difícil y qué está en juego
function Problema({ cifras }) {
  const { bancos, rankings, periodos, filasTotales } = cifras;
  return (
    <div className="pt-contenido">
      <p className="pt-antetitulo">El problema, hoy</p>
      <h2 className="pt-titular">
        Cada mes llegan miles de préstamos. Alguien los ordena a mano.
      </h2>
      <p className="pt-pie-cifra">
        {filasTotales && periodos ? `Los bancos envían a la Superintendencia todos sus préstamos: ${entero(filasTotales)} en solo ${periodos} meses. ` : 'Los bancos envían a la Superintendencia todos sus préstamos. '}
        Y quien quiere saber qué banco presta más solo encuentra Excel y PDF: <b>los datos son públicos, pero no son comprensibles.</b>
      </p>
      <div className="pt-trio">
        <div className="pt-dato">
          <strong>Trabajo a mano</strong>
          <span>quitar préstamos repetidos, los que se usan fuera del país y los que ya no deben nada, uno por uno</span>
        </div>
        <div className="pt-dato">
          <strong>Fácil equivocarse</strong>
          <span>{bancos && rankings ? `${bancos} bancos en ${rankings} actividades: ` : ''}Excel cambia códigos como «07» por «7», y una tarjeta mal clasificada mueve todo un ranking</span>
        </div>
        <div className="pt-dato">
          <strong>Errores caros</strong>
          <span>una cifra pública equivocada no se corrige: <b>se recuerda</b></span>
        </div>
      </div>
    </div>
  );
}

// La pregunta que hoy nadie responde con datos (cifras reales del último mes, nunca inventadas)
function Pregunta({ cifras }) {
  const q = cifras.pregunta;
  const M = (t) => `${(Number(t) / 1e6).toLocaleString('es-PA', { maximumFractionDigits: 2 })} M`;
  return (
    <div className="pt-contenido pt-centro">
      <p className="pt-antetitulo">11:00 a. m. · la pregunta del jefe</p>
      <h2 className="pt-titular">
        {q ? `«¿Por qué ${q.perdio.banco} perdió el primer lugar en ${q.ranking}?»` : '«¿Por qué este banco perdió el primer lugar?»'}
      </h2>
      <p className="pt-pie-cifra">Excel dice <b>que</b> bajó. Syntropy pone <b>los hechos</b> sobre la mesa; la analista decide qué significan.</p>
      {q && (
        <p className="pt-respuesta">
          Los hechos: prestó {M(q.perdio.nuevos)} ({q.gano.banco}: {M(q.gano.nuevos)}) y le vencieron {M(q.perdio.terminados)}.{' '}
          <span className="pt-resaltado">La lectura la pone una persona.</span>
        </p>
      )}
    </div>
  );
}

function Solucion() {
  return (
    <div className="pt-contenido pt-centro">
      <p className="pt-antetitulo">Syntropy</p>
      <h2 className="pt-frase">
        Syntropy pone los <span className="pt-resaltado">hechos</span>.<br />Las personas <span className="pt-resaltado">deciden</span>.
      </h2>
      <p className="pt-pie-cifra">Una plataforma interactiva que transforma datos bancarios en <b>rankings, análisis y comparaciones</b>: automatizada, transparente y accesible desde un solo lugar.</p>
    </div>
  );
}

// Tres personas, tres preguntas (lámina 6)
function TresPersonas() {
  const personas = [
    { quien: 'Público', pregunta: '¿Qué banco tiene más crédito en lo que me importa?', icono: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></> },
    { quien: 'Analista', pregunta: '¿Qué cambió y puedo respaldarlo?', icono: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></> },
    { quien: 'Administración', pregunta: '¿El mes nuevo entró bien?', icono: <><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></> },
  ];
  return (
    <div className="pt-contenido pt-centro">
      <p className="pt-antetitulo">Tres personas, tres preguntas</p>
      <h2 className="pt-titular">Cada una recibe su respuesta, y cada respuesta se prueba al centavo.</h2>
      <div className="pt-tarjetas pt-tres">
        {personas.map((p) => (
          <div key={p.quien} className="pt-tarjeta">
            <svg viewBox="0 0 24 24" className="pt-icono-linea" aria-hidden="true">{p.icono}</svg>
            <span className="pt-tarjeta-titulo">{p.quien}</span>
            <span className="pt-tarjeta-texto">«{p.pregunta}»</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= Guion del pitch (Guillermo → Nathalia → Aníbal) =================

// Guillermo · apertura: la pregunta de fondo
function Apertura() {
  return (
    <div className="pt-contenido pt-centro">
      <p className="pt-antetitulo">La pregunta de fondo</p>
      <h2 className="pt-titular">«¿De qué sirve tener miles de datos financieros disponibles, si convertirlos en información útil sigue siendo lento y complicado?»</h2>
      <p className="pt-pie-cifra">El problema no es la falta de información: es transformarla en conocimiento <b>accesible, comprensible y útil</b> para quien decide con esa cifra.</p>
    </div>
  );
}

// Guillermo · el perfil público: tres preguntas que deberían responderse en segundos
function PerfilPublico() {
  const preguntas = ['¿Cuál banco ocupa la primera posición en este ranking?', '¿Cómo cambió su posición respecto al mes anterior?', '¿Cómo se compara con las demás entidades?'];
  return (
    <div className="pt-contenido pt-centro">
      <p className="pt-antetitulo">El usuario más básico: el público</p>
      <h2 className="pt-titular">Hoy la respuesta está en Excel y PDF.</h2>
      <ol className="pt-rubrica pt-preguntas">
        {preguntas.map((q, i) => <li key={q}><span className="pt-rub-pts">{i + 1}</span><span>{q}</span></li>)}
      </ol>
      <p className="pt-pie-cifra">Deberían responderse en segundos. <b>El acceso a la información no debería depender de qué tan bien alguien maneje Excel.</b></p>
    </div>
  );
}

// Guillermo · arquitectura: el recorrido del motor
function Arquitectura() {
  const pasos = [
    ['Archivos CSV', 'un mes nuevo, sin tocar el código'],
    ['Validación', 'columnas, fechas y ceros a la izquierda'],
    ['Reglas E1–E4', 'el universo local válido'],
    ['Catálogos', 'CINU y SB21 clasifican'],
    ['Agrupación', 'saldo por banco y actividad'],
    ['Ponderación', 'sobre la cartera completa'],
    ['Rankings', 'del 1 al 12, con trazabilidad'],
  ];
  return (
    <div className="pt-contenido pt-centro">
      <p className="pt-antetitulo">Detrás de la interfaz</p>
      <h2 className="pt-titular">No es una interfaz bonita sobre los mismos archivos.</h2>
      <div className="pt-flujo">
        <span className="pt-capa">React · la pantalla</span>
        <div className="pt-pasos">
          {pasos.map(([t, d], i) => (
            <div key={t} className="pt-paso" style={{ animationDelay: `${i * 120}ms` }}>
              <b>{t}</b><span>{d}</span>
            </div>
          ))}
        </div>
        <span className="pt-capa">Node.js · el motor de cálculo</span>
      </div>
      <p className="pt-pie-cifra">Llega un período nuevo y el sistema <b>repite todo el proceso solo</b>.</p>
    </div>
  );
}

// Nathalia · del registro al ranking (cifras EN VIVO del último mes)
function DelRegistroAlRanking({ cifras }) {
  const c = cifras.calidad;
  const reglas = [
    ['E1', 'Duplicados dentro del período'],
    ['E2', 'Destino extranjero'],
    ['E3', 'Saldo cero o negativo'],
    ['E4', 'Actividad fuera del catálogo'],
  ];
  const meses = cifras.nombresPeriodos?.length ? cifras.nombresPeriodos.join(', ') : 'los tres períodos';
  return (
    <div className="pt-contenido">
      <p className="pt-antetitulo">Cómo convertimos miles de registros en resultados confiables</p>
      <h2 className="pt-titular">{c ? `${entero(c.filas_leidas)} filas → ${entero(c.universo)} préstamos válidos` : 'De miles de filas al universo válido'}</h2>
      <div className="pt-tarjetas pt-tec">
        {reglas.map(([id, t]) => (
          <div key={id} className="pt-tarjeta">
            <strong className="pt-tarjeta-valor">{c ? entero(c.cascada[id]) : id}</strong>
            <span className="pt-tarjeta-titulo">{id} · {t}</span>
            <span className="pt-tarjeta-texto">excluidas, en cascada: cada fila cuenta una sola vez</span>
          </div>
        ))}
      </div>
      <p className="pt-pie-cifra">
        Meses: {meses}. Clasificamos con <b>CINU</b> y <b>SB21</b>{c ? ` (${entero(c.reclasificadas_sb21)} tarjetas reclasificadas en Consumo)` : ''},
        sumamos por banco y actividad, y la <b>ponderación</b> se calcula sobre la cartera local válida <b>completa</b> del banco. Los 12 bancos en cada ranking.
      </p>
    </div>
  );
}

// Aníbal · automatización (las 6 de la lámina 8)
function Automatizacion() {
  const autos = [
    ['Cargar un período', 'CSV o Excel; recalcula todo en menos de 2 s'],
    ['Comparar períodos', 'quién sube, quién baja y quién se mantiene'],
    ['Movimientos', 'con una regla configurable de lo significativo'],
    ['Hechos de cada cambio', 'nuevos, vencidos y pagos, listos para que la analista los evalúe'],
    ['Alertas', 'variaciones fuera de lo normal, por reglas'],
    ['Reporte', 'listo para descargar e imprimir'],
  ];
  return (
    <div className="pt-contenido">
      <p className="pt-antetitulo">¿Qué pasa cuando llega información nueva?</p>
      <h2 className="pt-titular">Nada se repite a mano.</h2>
      <div className="pt-tarjetas pt-tres">
        {autos.map(([t, d]) => (
          <div key={t} className="pt-tarjeta">
            <span className="pt-check" aria-hidden="true">✓</span>
            <span className="pt-tarjeta-titulo">{t}</span>
            <span className="pt-tarjeta-texto">{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Aníbal · el factor diferenciador
function Diferenciador() {
  const tres = [
    ['Hechos, no conclusiones', 'Cuánto prestó, cuánto le venció y cuánto le pagaron. La interpretación la hace la analista en «Tu lectura».'],
    ['Se prueba al centavo', `Dos implementaciones independientes, ${HECHOS.diferencias} diferencias, y cada préstamo que sale tiene su vencimiento.`],
    ['La última palabra es humana', 'Ningún mes se publica sin la firma de una persona; la IA ayuda a encontrar las cifras, pero no calcula ni opina.'],
  ];
  return (
    <div className="pt-contenido pt-centro">
      <p className="pt-antetitulo">Nuestro factor diferenciador</p>
      <h2 className="pt-frase">
        Potenciamos a las <span className="pt-resaltado">personas</span>.<br />No reemplazamos sus <span className="pt-resaltado">decisiones</span>.
      </h2>
      <div className="pt-tarjetas pt-tres">
        {tres.map(([t, d]) => (
          <div key={t} className="pt-tarjeta">
            <span className="pt-tarjeta-titulo">{t}</span>
            <span className="pt-tarjeta-texto">{d}</span>
          </div>
        ))}
      </div>
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

function Confianza({ cifras }) {
  const tarjetas = [
    { valor: String(HECHOS.diferencias), titulo: 'diferencias', texto: `contra una segunda implementación independiente en Python, en las ${HECHOS.exportaciones} exportaciones oficiales` },
    { valor: '4', titulo: 'reconciliaciones', texto: 'una más que las pedidas: ningún préstamo desaparece entre un mes y otro sin explicación' },
    { valor: String(HECHOS.pruebas), titulo: 'pruebas automáticas', texto: 'reglas, perfiles, carga de un mes nuevo y exportaciones; sumas en centavos enteros' },
    ...(cifras?.puente ? [{ valor: `${entero(cifras.puente.vencian)} de ${entero(cifras.puente.n_terminados)}`, titulo: 'préstamos explicados', texto: 'ningún préstamo sale sin su fecha de vencimiento: el puente entre meses cuadra al centavo' }] : []),
    { valor: '✦', titulo: 'IA que no decide', texto: 'ayuda a encontrar y leer las cifras oficiales; no calcula ni opina, vive aislada y solo puede leer' },
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

// Tecnología elegida y por qué (criterio «Calidad técnica»)
function Tecnologia() {
  const piezas = [
    { que: 'React + Vite', por: 'La pantalla. Lo pide la lámina 7; carga rápido y cada perfil ve solo lo suyo.' },
    { que: 'Node.js + Express', por: 'La API. Un solo lenguaje, JavaScript, de punta a punta: más simple de mantener y de auditar.' },
    { que: 'Centavos enteros (BigInt)', por: 'El cálculo. Nunca decimales flotantes: las sumas cuadran al centavo.' },
    { que: 'Python de referencia', por: 'Una segunda implementación independiente que compara las 5 exportaciones.' },
    { que: 'node --test', por: `${HECHOS.pruebas} pruebas automáticas en cada cambio: reglas, perfiles y cargas.` },
    { que: 'Docker + Cloudflare', por: 'Publicada sin puertos abiertos; también corre local con npm start (R1).' },
    { que: 'Claude, aislado', por: 'La IA ayuda a leer las cifras ya calculadas; nunca calcula ni decide (Sección 9).' },
    { que: 'Datos guardados en el servidor', por: 'Cuentas (contraseñas cifradas), meses cargados, firmas y registro en archivos JSON persistentes; los rankings se recalculan siempre desde los archivos del reto (R2).' },
  ];
  return (
    <div className="pt-contenido">
      <p className="pt-antetitulo">La tecnología, y por qué</p>
      <h2 className="pt-titular">Simple de explicar, difícil de equivocarse.</h2>
      <div className="pt-tarjetas pt-tec">
        {piezas.map((t) => (
          <div key={t.que} className="pt-tarjeta">
            <span className="pt-tarjeta-titulo">{t.que}</span>
            <span className="pt-tarjeta-texto">{t.por}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Los 7 criterios de la rúbrica (Sección 11), cada uno con su respuesta
function Rubrica() {
  const criterios = [
    ['Exactitud', 25, `Cascada E1–E4, 6 rankings, SB21 y R1–R4 al centavo; ${HECHOS.diferencias} diferencias contra Python.`],
    ['Funcionalidad', 15, 'Panel, rankings, filtros, gráficos, reportes y exportaciones; 3 perfiles validados en el servidor.'],
    ['Automatización', 15, 'Cargar un mes y recalcular solo, comparar, puente del cambio, alertas y reporte descargable.'],
    ['Usabilidad', 15, 'Portada de tres preguntas, presentación guiada, fuente y «datos ficticios» siempre visibles.'],
    ['Calidad técnica', 10, `React + Node, código ordenado, ${HECHOS.pruebas} pruebas, README y repositorio público sin claves.`],
    ['Innovación', 10, 'Anatomía del cambio, «Tu lectura» (la evaluación humana), semáforo con firma, carta al banco, IA que orienta.'],
    ['Presentación', 10, 'Este pitch con cifras en vivo y una presentación guiada dentro de la propia plataforma.'],
  ];
  return (
    <div className="pt-contenido">
      <p className="pt-antetitulo">Lo que pide la rúbrica</p>
      <h2 className="pt-titular">Cada criterio, con su respuesta.</h2>
      <ol className="pt-rubrica">
        {criterios.map(([c, pts, txt]) => (
          <li key={c}><span className="pt-rub-pts">{pts}</span><span><b>{c}.</b> {txt}</span></li>
        ))}
      </ol>
      <p className="pt-pie-cifra">Requisitos mínimos <b>R1–R6 ✓</b>: corre local, nada fijado a mano, solo catálogos, repositorio público con README, sin credenciales y código explicable.</p>
    </div>
  );
}

function Impacto() {
  const puntos = [
    'Publicar sin miedo: todos los controles en verde y una firma',
    'Al banco, su carta de calidad lista para enviar',
    'Al público, rankings claros y verificables',
    'A quien hace esto a mano, le devolvemos la mañana',
    'La decisión, siempre en manos de una persona',
  ];
  return (
    <div className="pt-contenido">
      <p className="pt-antetitulo">Impacto y visión: más allá de tres meses</p>
      <h2 className="pt-titular pt-titular-grande">
        Menos tiempo <span className="pt-resaltado">ordenando</span>, más tiempo <span className="pt-resaltado">pensando</span>.
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
      <h2 className="pt-titular">Los datos, por sí solos, son solamente números.<br />El verdadero valor está en lo que hacemos con ellos.</h2>
      <p className="pt-pie-cifra">Somos <b>Syntropy</b>: del caos de datos al orden de las decisiones. Muchas gracias.</p>
      <p className="pt-dominio">syntropy.com.pa</p>
      <p className="pt-marca-chica">SYNTROPY</p>
    </div>
  );
}

// «quien» = quién del equipo la presenta (guion de Guillermo → Nathalia → Aníbal)
const DIAPOSITIVAS = [
  { titulo: 'Inicio', Componente: Negro, negro: true },
  { titulo: 'Portada', Componente: Portada, quien: 'Guillermo' },
  { titulo: 'La pregunta de fondo', Componente: Apertura, quien: 'Guillermo' },
  { titulo: 'El problema', Componente: Problema, quien: 'Guillermo' },
  { titulo: 'El perfil público', Componente: PerfilPublico, quien: 'Guillermo' },
  { titulo: 'La solución', Componente: Solucion, quien: 'Guillermo' },
  { titulo: 'Arquitectura', Componente: Arquitectura, quien: 'Guillermo' },
  { titulo: 'La tecnología, y por qué', Componente: Tecnologia, quien: 'Guillermo' },
  { titulo: 'Del registro al ranking', Componente: DelRegistroAlRanking, quien: 'Nathalia' },
  { titulo: 'Por qué confiar', Componente: Confianza, quien: 'Nathalia' },
  { titulo: 'Automatización', Componente: Automatizacion, quien: 'Aníbal' },
  { titulo: 'Tres personas, tres preguntas', Componente: TresPersonas, quien: 'Aníbal' },
  { titulo: 'La pregunta', Componente: Pregunta, quien: 'Aníbal' },
  { titulo: 'Factor diferenciador', Componente: Diferenciador, quien: 'Aníbal' },
  { titulo: 'Demostración', Componente: Demo, quien: 'Aníbal' },
  { titulo: 'Lo que pide la rúbrica', Componente: Rubrica, quien: 'Aníbal' },
  { titulo: 'Impacto', Componente: Impacto, quien: 'Aníbal' },
  { titulo: 'Cierre', Componente: Cierre, quien: 'Aníbal' },
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
    return Number.isInteger(n) && n >= 0 && n < DIAPOSITIVAS.length ? n : 0;
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

  useEffect(() => { window.history.replaceState(null, '', `#${indice}`); }, [indice]);

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

  const { Componente, titulo, quien, negro } = DIAPOSITIVAS[indice];
  return (
    <div
      ref={raiz}
      className={`pt-raiz${negro ? ' pt-oscuro' : ''}`}
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
        aria-label={`Diapositiva ${indice} de ${total - 1}: ${titulo}`}
        aria-live="polite"
      >
        <Componente cifras={cifras} irALaApp={() => { navegar('/'); if (setPaso) setPaso(0); }} />
      </section>

      <nav className="pt-progreso" aria-label="Diapositivas">
        {DIAPOSITIVAS.map((d, i) => (d.negro ? null : (
          <button
            key={d.titulo} type="button" aria-label={`Ir a ${d.titulo}`} aria-current={i === indice ? 'step' : undefined}
            className={i === indice ? 'pt-activo' : ''} onClick={() => ir(i)}
          />
        )))}
      </nav>
      <span className="pt-contador" aria-hidden="true">{quien && <span className="pt-quien">Presenta: {quien} · </span>}{indice} / {total - 1}</span>
      <span className="pt-ayuda" aria-hidden="true">← → para avanzar · F pantalla completa</span>
    </div>
  );
}
