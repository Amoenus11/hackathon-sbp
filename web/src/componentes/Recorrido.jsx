// Presentación guiada con animación tipo keynote: recorre la app en el orden del pitch (5 minutos).
// Cada paso abre con una tarjeta de título a pantalla completa; luego un foco de luz ilumina lo
// importante de la página y un globo lo explica. Teclas: → siguiente, ← anterior, Esc salir.
// Solo afecta a este modo: fuera de la presentación guiada no se dibuja nada.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexto.jsx';
import { puede } from '../permisos.js';
import './recorrido.css';

// Cada paso: una ruta, un título, una frase y de 1 a 3 «focos» (selector CSS existente + explicación).
// Si un selector no aparece en la página, ese foco se muestra solo con su texto.
export const PASOS_TODOS = [
  // «/» es distinto según el perfil: el Público ve la portada de tres preguntas; analista y administrador, el Panel.
  {
    ruta: '/', titulo: 'Tres preguntas, tres respuestas', solo: ['publico'],
    texto: 'Para el ciudadano: qué es un crédito, quién va ganando y qué tiene de distinto cada banco.',
    focos: [
      { sel: '.po-que', texto: 'Para el público, primero lo esencial: qué es un crédito y qué significa ir primero.' },
      { sel: '.po-pista', texto: '¿Quién va ganando, y por cuánto? Cada banco en su carril. En comercio: casi un empate.' },
      { sel: '.po-desvios', texto: '¿Qué tiene de distinto este banco? Lo que dedica de más o de menos frente al promedio de los 12.' },
    ],
  },
  {
    ruta: '/', titulo: 'El crédito en un vistazo', solo: ['analista', 'administrador'],
    texto: 'Cartera local válida, los líderes de cada actividad y lo que cambió este mes, explicado solo.',
    focos: [
      { sel: '.kpis', texto: 'Las cifras del mes: la cartera local válida, los préstamos que cuentan y cuántas filas quedaron fuera por las reglas E1–E4.' },
      { sel: 'section[aria-labelledby="lideres-titulo"]', texto: 'Quién lidera cada una de las 6 actividades, con su cuota de mercado. Si cambió el líder, se marca.' },
      { sel: 'section[aria-labelledby="cambios-titulo"]', texto: 'Lo que cambió este mes, explicado automáticamente en lenguaje claro: quién sube, a quién supera y por qué.' },
    ],
  },
  {
    ruta: '/rankings', titulo: 'Los rankings', minimo: 'publico',
    texto: '6 actividades × 12 bancos: posición, saldo y ponderación oficial.',
    focos: [
      { sel: 'section[aria-labelledby="grafico-ranking-titulo"]', texto: 'Los 12 bancos ordenados por saldo. Empate: gana el código de banco menor. Siempre están los 12.' },
      { sel: 'section[aria-labelledby="tabla-ranking-titulo"]', texto: 'Saldo, cartera total y ponderación oficial. Toca un banco: su desglose (Tarjeta por la regla SB21) y la ANATOMÍA DEL CAMBIO: cuánto prestó, cuánto le venció y cuánto amortizó. Un ranking dice quién va primero; Syntropy dice por qué.' },
    ],
  },
  {
    ruta: '/metodologia', titulo: 'Cómo lo calculamos', minimo: 'publico',
    texto: 'De 30,000 préstamos a 6 rankings verificados al centavo, en 5 pasos.',
    focos: [
      { sel: '.met-recorrido', texto: 'Leemos, quitamos lo que no cuenta (E1–E4), clasificamos con el catálogo oficial y sumamos en centavos enteros.' },
      { sel: '.met-confianza', texto: 'Verificado con una segunda implementación independiente: 0 diferencias en las 5 exportaciones.' },
      { sel: '.met-er', texto: 'Cómo se relacionan los archivos: cada préstamo se une al catálogo por su actividad, a la tabla SB21 por su facilidad y a su banco.' },
    ],
  },
  {
    ruta: '/admin/cargar', titulo: 'Un mes nuevo, sin tocar el código', minimo: 'administrador',
    texto: 'El administrador sube el archivo del mes: se valida, se recalcula y se compara solo.',
    focos: [
      { sel: '.zona-soltar', texto: 'Se suelta el archivo AT03 de septiembre: en segundos se valida, se calcula y se compara con agosto.' },
      { sel: 'section[aria-labelledby="periodos-titulo"]', texto: 'Los cortes cargados. Un período se puede quitar y volver a cargar para repetir la demostración.' },
    ],
  },
  {
    ruta: '/comparar?puente=COMERCIO-111', titulo: 'Quién sube y quién baja', minimo: 'analista',
    texto: 'Los movimientos significativos según una regla configurable, cada uno explicado.',
    focos: [
      { sel: 'section[aria-labelledby="explicaciones-titulo"]', texto: 'Cada movimiento, explicado con su porqué: «No prestó menos: le vencieron más». Quién sube, a quién supera y qué lo movió.' },
      { sel: 'section[aria-labelledby="tabla-movimientos-titulo"]', texto: 'La regla es configurable: posiciones, cambio de líder o variación de saldo. Todo queda en el registro.' },
    ],
  },
  {
    ruta: '/calidad', titulo: 'Confianza y trazabilidad', minimo: 'analista',
    texto: 'Cada fila excluida con su motivo y las cuentas cuadradas al centavo.',
    focos: [
      { sel: '.ecuacion', texto: 'Filas leídas = E1 + E2 + E3 + E4 + universo. Cuadra en los tres meses.' },
      { sel: 'section[aria-labelledby="reconciliaciones-titulo"]', texto: 'Reconciliaciones al centavo, y una cuarta que nadie pidió: el puente entre meses. Ningún préstamo desaparece sin explicación.' },
    ],
  },
  {
    ruta: '/publicar', titulo: 'Publicar sin miedo', minimo: 'analista',
    texto: 'Todos los controles en verde, una firma y queda registrado.',
    focos: [
      { sel: '.pub-lista', texto: 'El botón que le quita el miedo a publicar: todos los controles de la Sección 12 en verde antes de firmar.' },
      { sel: '.pub-firma', texto: 'La analista firma con su nombre y queda en el registro de operaciones, con fecha y hora.' },
    ],
  },
  {
    ruta: '/carta', titulo: 'Al banco, su carta de calidad', minimo: 'analista',
    texto: 'La SBP no solo mide: le devuelve al banco cómo mejorar.',
    focos: [
      { sel: '.car-conteos', texto: 'Cada banco recibe sus filas observadas (duplicados, saldos no positivos, actividades fuera del catálogo), lista para enviar.' },
    ],
  },
  {
    ruta: '/reportes', titulo: 'Listo para la junta', minimo: 'analista',
    texto: 'Un reporte personalizado en PDF y las exportaciones oficiales en CSV.',
    focos: [
      { sel: '.hoja-reporte', texto: 'El reporte se arma solo con los bancos, rankings y meses elegidos, listo para imprimir o guardar en PDF.' },
    ],
  },
  {
    ruta: '/extraccion', titulo: 'Descarga solo lo que necesitas', minimo: 'publico',
    texto: 'Cortes, actividades, bancos, clasificación y campos: sin código y sin limpiar después.',
    focos: [
      { sel: '.ex-pasos', texto: 'Hoy se descarga todo y después se procesa. Aquí eliges cortes, actividades, bancos, clasificación y campos.' },
      { sel: '.ex-vista', texto: 'La vista previa se actualiza sola; luego descargas en CSV o Excel. Nunca salen datos personales del cliente.' },
    ],
  },
  {
    ruta: '/asistente', titulo: 'Pregúntale a la IA', minimo: 'publico',
    texto: 'Responde en lenguaje natural con las cifras oficiales.',
    focos: [
      { sel: '.tarjeta-chat', texto: 'Pregunta como hablarías con un colega. La IA explica las cifras oficiales; nunca calcula los rankings.' },
    ],
  },
  {
    ruta: '/equipo', titulo: 'Equipo Syntropy', minimo: 'publico',
    texto: 'Del caos de datos al orden de las decisiones.',
    focos: [
      { sel: '.eq-portada', texto: 'La sintropía es la fuerza que crea orden: eso hacemos con los datos del crédito.' },
      { sel: '.eq-personas', texto: 'Gui, Nathalia y Aníbal: dirección, datos y la historia que los conecta.' },
    ],
  },
];

const NOMBRE = { analista: 'Analista', administrador: 'Administrador' };
const DURACION_TITULO = 1700; // ms que la tarjeta de título queda a la vista
const DURACION_SALIDA = 620;
const ESPERA_ELEMENTO = 3500; // las páginas cargan datos: se espera un poco a que aparezca el elemento

const prefiereQuieto = () => false; // la presentación siempre se anima (pedido del equipo)
const dosCifras = (n) => String(n).padStart(2, '0');

// Cambia de página con un fundido cruzado si el navegador lo permite (View Transitions).
function irCon(navegar, ruta) {
  if (window.location.pathname === ruta) return;
  if (document.startViewTransition && !prefiereQuieto()) {
    document.documentElement.classList.add('rc-transicion');
    const t = document.startViewTransition(() => { flushSync(() => navegar(ruta)); });
    t.finished.finally(() => document.documentElement.classList.remove('rc-transicion'));
  } else navegar(ruta);
}

// Conteo animado SOLO visual de las cifras grandes, la primera vez que se enfocan.
const yaContadas = new WeakSet();
function contarCifras(elemento) {
  if (!elemento || prefiereQuieto()) return;
  const cifras = elemento.querySelectorAll('.kpi-valor, .lider-saldo, .met-paso-cifra, .eq-cifra-valor');
  cifras.forEach((nodo) => {
    if (yaContadas.has(nodo)) return;
    yaContadas.add(nodo);
    const original = nodo.textContent;
    const m = /(\d[\d,]*)(\.\d+)?/.exec(original);
    if (!m) return;
    const destino = Number(`${m[1].replace(/,/g, '')}${m[2] || ''}`);
    if (!Number.isFinite(destino) || destino === 0) return;
    const decimales = m[2] ? m[2].length - 1 : 0;
    const formato = new Intl.NumberFormat('es-PA', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    const inicio = performance.now();
    const duracion = 900;
    let ultimo = original;
    const cuadro = (ahora) => {
      if (nodo.textContent !== ultimo) return; // React cambió el texto (otro período): se deja como está
      const t = Math.min(1, (ahora - inicio) / duracion);
      const suave = 1 - (1 - t) ** 3;
      ultimo = t < 1 ? original.replace(m[0], formato.format(destino * suave)) : original;
      nodo.textContent = ultimo;
      if (t < 1) requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  });
}

// Sigue la posición del elemento enfocado (cambia con el scroll, el tamaño o cuando terminan de cargar los datos).
function useRectangulo(selector, activo, alEncontrar) {
  const [rect, setRect] = useState(null);
  const encontrado = useRef(null);
  useEffect(() => {
    encontrado.current = null;
    setRect(null);
    if (!activo || !selector) return undefined;
    let vivo = true;
    let marco = 0;
    const desde = performance.now();
    const medir = () => {
      if (!vivo) return;
      let el = encontrado.current;
      if (!el || !el.isConnected) {
        el = document.querySelector(selector);
        if (el) {
          encontrado.current = el;
          // Elementos altos: se alinean arriba, debajo de la cabecera fija; los demás, al centro
          const r0 = el.getBoundingClientRect();
          const comportamiento = prefiereQuieto() ? 'auto' : 'smooth';
          if (r0.height > window.innerHeight - 280) window.scrollTo({ top: window.scrollY + r0.top - 124, behavior: comportamiento });
          else el.scrollIntoView({ behavior: comportamiento, block: 'center' });
          alEncontrar?.(el);
        } else if (performance.now() - desde > ESPERA_ELEMENTO) {
          return; // no existe en esta página: solo se muestra el globo
        }
      }
      if (el) {
        const r = el.getBoundingClientRect();
        setRect((prev) => (prev && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.left - r.left) < 0.5
          && Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5
          ? prev : { top: r.top, left: r.left, width: r.width, height: r.height }));
      }
      marco = requestAnimationFrame(medir);
    };
    marco = requestAnimationFrame(medir);
    return () => { vivo = false; cancelAnimationFrame(marco); };
  }, [selector, activo]); // eslint-disable-line react-hooks/exhaustive-deps
  return rect;
}

export default function Recorrido() {
  const { paso, setPaso, sesion, abrirSesion, modalSesion } = useApp();
  // Solo los pasos que este perfil puede ver (el Público no pasa por pantallas de administración)
  const PASOS = PASOS_TODOS.filter((p) => (p.solo ? p.solo.includes(sesion.perfil) : puede(sesion.perfil, p.minimo)));
  const navegar = useNavigate();
  const activo = paso !== null && paso !== undefined;
  const actual = activo ? PASOS[paso] : null;
  const [foco, setFoco] = useState(0);
  const [fase, setFase] = useState('titulo'); // titulo → saliendo → foco
  const [apartado, setApartado] = useState(false); // el presentador hizo clic en la página: se quita el oscurecido
  const [tam, setTam] = useState({ w: window.innerWidth, h: window.innerHeight });
  const relojes = useRef([]);

  const limpiarRelojes = () => { relojes.current.forEach(clearTimeout); relojes.current = []; };

  // Al entrar a un paso: cambiar de página, mostrar la tarjeta de título y luego el foco.
  useLayoutEffect(() => {
    limpiarRelojes();
    if (!actual) return undefined;
    irCon(navegar, actual.ruta);
    setFoco(0);
    setApartado(false);
    if (prefiereQuieto()) { setFase('foco'); return undefined; }
    setFase('titulo');
    relojes.current.push(setTimeout(() => setFase('saliendo'), DURACION_TITULO));
    relojes.current.push(setTimeout(() => setFase('foco'), DURACION_TITULO + DURACION_SALIDA));
    return limpiarRelojes;
  }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  const saltarTitulo = useCallback(() => {
    limpiarRelojes();
    if (prefiereQuieto()) { setFase('foco'); return; }
    setFase('saliendo');
    relojes.current.push(setTimeout(() => setFase('foco'), DURACION_SALIDA));
  }, []);

  const focos = actual?.focos || [];
  const siguiente = useCallback(() => {
    if (!activo) return;
    if (fase !== 'foco') { saltarTitulo(); return; }
    if (foco < focos.length - 1) { setFoco((f) => f + 1); setApartado(false); return; }
    if (paso < PASOS.length - 1) setPaso(paso + 1);
    else setPaso(null);
  }, [activo, fase, foco, focos.length, paso, setPaso, saltarTitulo]);
  const anterior = useCallback(() => {
    if (!activo) return;
    if (fase === 'foco' && foco > 0) { setFoco((f) => f - 1); setApartado(false); return; }
    if (paso > 0) setPaso(paso - 1);
  }, [activo, fase, foco, paso, setPaso]);

  // Teclado
  useEffect(() => {
    if (!activo) return undefined;
    const alTeclear = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); siguiente(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); anterior(); }
      if (e.key === 'Escape') setPaso(null);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [activo, siguiente, anterior, setPaso]);

  // Si el presentador hace clic en la página (fuera de la presentación), el oscurecido se aparta.
  useEffect(() => {
    if (!activo || fase !== 'foco') return undefined;
    const alTocar = (e) => { if (!e.target.closest?.('.rc-capa')) setApartado(true); };
    document.addEventListener('pointerdown', alTocar, true);
    return () => document.removeEventListener('pointerdown', alTocar, true);
  }, [activo, fase, foco]);

  useEffect(() => {
    const alCambiar = () => setTam({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, []);

  const focoActual = focos[foco];
  const rect = useRectangulo(focoActual?.sel, activo && fase === 'foco', contarCifras);

  if (!actual) return null;
  const falta = actual.solo ? !actual.solo.includes(sesion.perfil) : !puede(sesion.perfil, actual.minimo);
  const mostrarFoco = fase === 'foco' && rect && !apartado && !modalSesion;

  // Globo: debajo del elemento si cabe; si no, encima; si no, a un costado; y si el elemento ocupa
  // todo, en su esquina inferior derecha (la zona que menos tapa). Nunca encima de la barra inferior.
  const MARGEN = 18;
  const ALTO_GLOBO = 160;
  const LIMITE_ABAJO = tam.h - 120; // la barra inferior ocupa ~110 px
  let globo = null;
  if (fase === 'foco' && focoActual && !modalSesion) {
    const ancho = Math.min(400, tam.w - 32);
    if (rect) {
      const fondo = rect.top + rect.height;
      const alinearH = Math.min(Math.max(16, rect.left), tam.w - ancho - 16);
      if (LIMITE_ABAJO - fondo - MARGEN >= ALTO_GLOBO) {
        globo = { top: fondo + MARGEN, left: alinearH, ancho };
      } else if (rect.top - 110 - MARGEN >= ALTO_GLOBO) {
        globo = { top: rect.top - MARGEN - ALTO_GLOBO, left: alinearH, ancho };
      } else if (tam.w - (rect.left + rect.width) - MARGEN >= ancho + 16) {
        globo = { top: Math.max(120, Math.min(rect.top + 24, LIMITE_ABAJO - ALTO_GLOBO)), left: rect.left + rect.width + MARGEN, ancho };
      } else if (rect.left - MARGEN >= ancho + 16) {
        globo = { top: Math.max(120, Math.min(rect.top + 24, LIMITE_ABAJO - ALTO_GLOBO)), left: rect.left - MARGEN - ancho, ancho };
      } else {
        // El elemento ocupa casi toda la pantalla: el globo se vuelve un subtítulo angosto junto a la barra
        // inferior (como en un keynote), para tapar lo mínimo.
        const anchoSub = Math.min(760, tam.w - 32);
        globo = { top: LIMITE_ABAJO - 96, left: (tam.w - anchoSub) / 2, ancho: anchoSub, subtitulo: true };
      }
    } else {
      globo = { top: Math.max(120, tam.h * 0.3), left: (tam.w - ancho) / 2, ancho };
    }
  }

  return (
    <>
      {/* 1. Tarjeta de título a pantalla completa */}
      {(fase === 'titulo' || fase === 'saliendo') && (
        <div className={`rc-capa rc-titulo ${fase === 'saliendo' ? 'rc-saliendo' : ''}`} onClick={saltarTitulo} role="presentation">
          <div className="rc-titulo-contenido" key={paso}>
            <span className="rc-titulo-numero">{dosCifras(paso + 1)}</span>
            <h2 className="rc-titulo-texto">{actual.titulo}</h2>
            <p className="rc-titulo-frase">{actual.texto}</p>
          </div>
        </div>
      )}

      {/* 2. Foco de luz: oscurece todo salvo el elemento (no bloquea los clics) */}
      {mostrarFoco && (
        <div
          className="rc-foco" aria-hidden="true"
          style={{ top: rect.top - 10, left: rect.left - 10, width: rect.width + 20, height: rect.height + 20 }}
        />
      )}

      {/* 3. Globo de explicación */}
      {globo && (
        <div
          className={`rc-capa rc-globo${globo.subtitulo ? ' rc-globo-subtitulo' : ''}`} key={`${paso}-${foco}`} role="status" aria-live="polite"
          style={{ top: globo.top, left: globo.left, width: globo.ancho }}
        >
          <span className="rc-globo-eyebrow">Paso {paso + 1} · {foco + 1} de {focos.length}</span>
          <p>{focoActual.texto}</p>
          <button type="button" className="rc-globo-siguiente" onClick={siguiente}>
            {foco < focos.length - 1 ? 'Siguiente →' : paso < PASOS.length - 1 ? 'Siguiente paso →' : 'Terminar'}
          </button>
        </div>
      )}

      {/* 4. Barra inferior */}
      <div className="rc-capa recorrido rc-barra" role="region" aria-label="Presentación guiada">
        <div className="recorrido-progreso" aria-hidden="true">
          {PASOS.map((p, i) => (
            <button key={p.ruta} type="button" className={`rc-segmento ${i === paso ? 'activo' : i < paso ? 'hecho' : ''}`} onClick={() => setPaso(i)} title={p.titulo}>
              {i === paso && (
                <span className="rc-subpuntos">
                  {p.focos.map((_, j) => <i key={j} className={fase === 'foco' && j <= foco ? 'lleno' : ''} />)}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="recorrido-cuerpo">
          <span className="recorrido-numero">{paso + 1}<small>/{PASOS.length}</small></span>
          <div className="recorrido-texto">
            <strong>{actual.titulo}</strong>
            <span>{actual.texto}</span>
            {falta && (
              <button type="button" className="enlace-boton" onClick={abrirSesion}>
                Esta pantalla necesita el perfil {NOMBRE[actual.minimo]}: iniciar sesión
              </button>
            )}
          </div>
          <div className="recorrido-botones">
            <button type="button" className="boton boton-secundario boton-chico" onClick={anterior} disabled={paso === 0 && (fase !== 'foco' || foco === 0)}>← Anterior</button>
            <button type="button" className="boton boton-primario boton-chico" onClick={siguiente}>
              {paso === PASOS.length - 1 && fase === 'foco' && foco === focos.length - 1 ? 'Terminar' : 'Siguiente →'}
            </button>
            <button type="button" className="boton-cerrar" onClick={() => setPaso(null)} aria-label="Salir de la presentación">×</button>
          </div>
        </div>
      </div>
    </>
  );
}
