// Página «Equipo Syntropy»: quiénes somos, por qué el nombre, misión, roles, cultura, qué logramos,
// el pitch en 5 minutos y lo que los tres debemos poder explicar (requisito R6 del jurado).
import './equipo.css';

const numero = new Intl.NumberFormat('es-PA');

const PERSONAS = [
  {
    iniciales: 'G',
    foto: '/equipo/guillermo-2.webp',
    nombre: 'Guillermo Aparicio',
    rol: 'Dirección y producto',
    texto: 'Define la estrategia y las prioridades, decide en 2 minutos, dirige a Claude y cuida el reloj del equipo.',
    etiquetas: ['Estrategia', 'Prioridades', 'Decisiones'],
  },
  {
    iniciales: 'N',
    foto: '/equipo/nathalia-2.webp',
    nombre: 'Nathalia Asyn',
    rol: 'Datos y verificación',
    texto: 'Entiende el AT03 a fondo, verifica cada cifra (cascada E1–E4 y reconciliaciones) y prepara los datos que pedirá el jurado. Tiene su propio Claude Code en el servidor.',
    etiquetas: ['AT03', 'Cascada E1–E4', 'Reconciliaciones'],
  },
  {
    iniciales: 'A',
    foto: '/equipo/anibal.webp',
    nombre: 'Aníbal Abrego',
    rol: 'Historia, pitch, usabilidad y experiencia',
    texto: 'La voz del equipo y el guardián de la experiencia: arma el pitch, conduce la demo y cuida que cada pantalla sea clara y usable para el público, la analista y quien administra.',
    etiquetas: ['Pitch', 'Usabilidad', 'Experiencia de usuario'],
  },
];

const VALORES = [
  { simbolo: '0.00', titulo: 'Exactitud al centavo', texto: 'Si no cuadra, no se publica.' },
  { simbolo: '⌕', titulo: 'Transparencia', texto: 'Cada número con su fuente y su regla.' },
  { simbolo: '◐', titulo: 'Claridad para todos', texto: 'Público, analista y administrador entienden lo que ven.' },
  { simbolo: '2′', titulo: 'Decidir rápido', texto: 'Dos minutos para debatir; Dirección cierra.' },
  { simbolo: '▶', titulo: 'Demo antes que diapositivas', texto: 'Lo que mostramos funciona en vivo.' },
  { simbolo: '♥', titulo: 'Cuidarnos', texto: 'Agua, comida y pausas: la energía también compite.' },
];

const CIFRAS = [
  { valor: '3', texto: 'períodos procesados' },
  { valor: numero.format(82500), texto: 'filas leídas' },
  { valor: '6 × 12', texto: 'rankings × bancos' },
  { valor: '0', texto: 'diferencias contra una segunda implementación independiente (Python)', destacada: true },
  { valor: '17', texto: 'pruebas automáticas' },
  { valor: '6/6', texto: 'automatizaciones de la lámina 8' },
];

const PITCH = [
  { tiempo: '0:00', titulo: 'El problema', texto: 'Hoy: Excel y PDF. Comparar bancos y meses es lento y opaco.' },
  { tiempo: '0:40', titulo: 'La solución', texto: 'Un observatorio que calcula al centavo y explica cada cambio, en una frase.' },
  { tiempo: '1:00', titulo: 'Demo en vivo', texto: 'Panel → ranking → desglose SB21 → cargar septiembre → movimientos explicados → reporte.', destacado: true },
  { tiempo: '3:30', titulo: 'Por qué confiar', texto: 'Centavos exactos, doble verificación, pruebas, perfiles y auditoría.' },
  { tiempo: '4:15', titulo: 'Impacto', texto: 'Qué gana la SBP y cuál es el siguiente paso.' },
  { tiempo: '4:45', titulo: 'Cierre', texto: 'Del caos de datos al orden de las decisiones.' },
];

const PREGUNTAS = [
  {
    pregunta: '¿Cómo evitan errores de centavos?',
    respuesta: 'Sumamos en centavos enteros (BigInt de JavaScript), nunca con decimales binarios. La ponderación se calcula con enteros y redondeo aritmético exacto a 4 decimales.',
  },
  {
    pregunta: '¿Cómo saben que los rankings están bien?',
    respuesta: 'Una segunda implementación independiente, escrita en Python, da exactamente lo mismo en las 5 exportaciones, celda por celda. Además hay 17 pruebas automáticas y las reconciliaciones R1–R3 cuadran al centavo.',
  },
  {
    pregunta: '¿Qué hace la IA y qué no?',
    respuesta: 'Explica resultados ya calculados por el motor. Nunca calcula rankings. Vive aislada: no tiene internet ni credenciales y solo puede leer los resultados.',
  },
  {
    pregunta: '¿Cómo se carga un mes nuevo?',
    respuesta: 'El administrador sube el CSV del AT03. El sistema valida el esquema, recalcula todo, compara con el mes anterior y explica los movimientos, sin tocar el código.',
  },
];

// Dibujo «caos → orden»: puntos dispersos a la izquierda que se ordenan en una rejilla a la derecha.
const CAOS = [
  [18, 30], [42, 112], [64, 52], [30, 76], [88, 128], [96, 34], [52, 140], [110, 84], [76, 96], [24, 132],
  [120, 46], [58, 22], [104, 118], [40, 56], [84, 66], [130, 106], [16, 100], [70, 130], [124, 20], [92, 100],
];
const ORDEN = Array.from({ length: 20 }, (_, k) => [196 + (k % 5) * 26, 34 + Math.floor(k / 5) * 30]);

function Constelacion() {
  return (
    <svg className="eq-constelacion" viewBox="0 0 330 160" role="img" aria-label="Puntos desordenados que se convierten en una rejilla ordenada">
      <defs>
        <linearGradient id="eq-degradado" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0e7c86" />
          <stop offset="1" stopColor="#5b4bdb" />
        </linearGradient>
        <marker id="eq-flecha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="#5b4bdb" />
        </marker>
      </defs>
      {CAOS.map(([x, y], k) => (
        <circle key={`c${k}`} className="eq-punto-caos" cx={x} cy={y} r={k % 3 === 0 ? 4.5 : 3.5} style={{ animationDelay: `${(k % 7) * 0.4}s` }} />
      ))}
      <path d="M146 80 C 160 80, 166 80, 180 80" stroke="url(#eq-degradado)" strokeWidth="3" fill="none" strokeLinecap="round" markerEnd="url(#eq-flecha)" />
      {ORDEN.map(([x, y], k) => (
        <circle key={`o${k}`} className="eq-punto-orden" cx={x} cy={y} r="5" fill="url(#eq-degradado)" style={{ animationDelay: `${k * 0.08}s` }} />
      ))}
      <text x="72" y="156" className="eq-constelacion-texto" textAnchor="middle">caos</text>
      <text x="248" y="156" className="eq-constelacion-texto" textAnchor="middle">orden</text>
    </svg>
  );
}

export default function Equipo() {
  return (
    <div className="eq">
      {/* 1. Portada */}
      <section className="eq-portada">
        <div className="eq-portada-texto">
          <p className="eq-antetitulo">Equipo · Hackathon SBP 2026</p>
          <h1 className="eq-marca">SYNTROPY</h1>
          <p className="eq-lema">Del caos de datos al orden de las decisiones</p>
          <p className="eq-porque">
            La <strong>sintropía</strong> es lo contrario de la entropía: la fuerza que crea orden, cooperación y
            propósito (Luigi Fantappiè, 1942). Eso hacemos: convertir {numero.format(82500)} registros desordenados en
            rankings claros, verificables y explicados.
          </p>
        </div>
        <Constelacion />
      </section>

      {/* 2. Misión */}
      <section className="eq-mision" aria-labelledby="eq-mision-titulo">
        <h2 id="eq-mision-titulo" className="eq-etiqueta">Nuestra misión en una frase</h2>
        <p className="eq-mision-frase">
          Para la <strong>Superintendencia de Bancos</strong> y el <strong>público</strong> que necesitan comparar el crédito
          bancario con confianza, construimos un observatorio que <span className="eq-subrayado">calcula los rankings al
          centavo</span>, <span className="eq-subrayado">explica cada cambio</span> y <span className="eq-subrayado">deja
          rastro de cada decisión</span>.
        </p>
      </section>

      {/* 3. Quiénes somos */}
      <section className="eq-seccion" aria-labelledby="eq-quienes">
        <h2 id="eq-quienes" className="eq-titulo">Quiénes somos</h2>
        <div className="eq-personas">
          {PERSONAS.map((p) => (
            <article key={p.nombre} className="eq-persona">
              <div className="eq-avatar" aria-hidden="true">{p.foto ? <img src={p.foto} alt="" className={`eq-foto eq-foto-${p.iniciales.toLowerCase()}`} /> : p.iniciales}</div>
              <h3 className="eq-persona-nombre">{p.nombre}</h3>
              <p className="eq-persona-rol">{p.rol}</p>
              <p className="eq-persona-texto">{p.texto}</p>
              <ul className="eq-chips" aria-label={`Fortalezas de ${p.nombre}`}>
                {p.etiquetas.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </article>
          ))}
        </div>
        <article className="eq-claude">
          <div className="eq-claude-icono" aria-hidden="true">✦</div>
          <div>
            <h3>Claude (Opus 5.5) · Ingeniería</h3>
            <p>Construye, verifica y publica. Nunca calcula rankings con IA: los calcula un motor determinista.</p>
          </div>
        </article>
      </section>

      {/* 4. Cultura */}
      <section className="eq-seccion" aria-labelledby="eq-cultura">
        <h2 id="eq-cultura" className="eq-titulo">Cómo trabajamos</h2>
        <div className="eq-valores">
          {VALORES.map((v) => (
            <article key={v.titulo} className="eq-valor">
              <span className="eq-valor-simbolo" aria-hidden="true">{v.simbolo}</span>
              <h3>{v.titulo}</h3>
              <p>{v.texto}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 5. Qué hicimos */}
      <section className="eq-seccion eq-logros" aria-labelledby="eq-logros">
        <h2 id="eq-logros" className="eq-titulo">Qué logramos hoy</h2>
        <div className="eq-cifras">
          {CIFRAS.map((c) => (
            <div key={c.texto} className={`eq-cifra${c.destacada ? ' eq-cifra-destacada' : ''}`}>
              <span className="eq-cifra-valor">{c.valor}</span>
              <span className="eq-cifra-texto">{c.texto}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 6. El pitch */}
      <section className="eq-seccion" aria-labelledby="eq-pitch">
        <h2 id="eq-pitch" className="eq-titulo">El pitch en 5 minutos</h2>
        <ol className="eq-linea">
          {PITCH.map((p) => (
            <li key={p.tiempo} className={`eq-paso${p.destacado ? ' eq-paso-destacado' : ''}`}>
              <span className="eq-paso-tiempo">{p.tiempo}</span>
              <span className="eq-paso-punto" aria-hidden="true" />
              <strong className="eq-paso-titulo">{p.titulo}</strong>
              <span className="eq-paso-texto">{p.texto}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 7. R6: lo que los tres debemos poder explicar */}
      <section className="eq-seccion" aria-labelledby="eq-r6">
        <h2 id="eq-r6" className="eq-titulo">Los tres debemos poder explicar</h2>
        <p className="eq-nota">Requisito R6 del jurado: cualquiera de nosotros responde estas preguntas en 20 segundos.</p>
        <div className="eq-preguntas">
          {PREGUNTAS.map((q) => (
            <details key={q.pregunta} className="eq-pregunta">
              <summary>{q.pregunta}</summary>
              <p>{q.respuesta}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="eq-pie">
        Equipo <strong>Syntropy</strong> · Hackathon SBP 2026 · Universidad Tecnológica de Panamá (FISC)
      </footer>
    </div>
  );
}
