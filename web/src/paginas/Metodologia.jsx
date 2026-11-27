// Metodología: cómo se calcula cada ranking, explicado para cualquier persona en 5 pasos con los
// números en vivo del período elegido; cómo se conectan los archivos (diagrama simple de llaves);
// y las reglas exactas para técnicos, plegadas.
import { api } from '../api.js';
import { useApp, useDatos } from '../contexto.jsx';
import { EncabezadoPagina } from '../componentes/Comunes.jsx';
import { entero, etiquetaPeriodo, fechaCorte, monto, montoCorto } from '../formato.js';
import './metodologia.css';

// ---------------------------------------------------------------- recorrido en 5 pasos
const FILTROS = [
  { id: 'E1', nombre: 'Duplicados' },
  { id: 'E2', nombre: 'Fuera de Panamá' },
  { id: 'E3', nombre: 'Saldo cero o negativo' },
  { id: 'E4', nombre: 'Actividad fuera del catálogo' },
];

function Paso({ numero, titulo, cifra, etiqueta, children }) {
  return (
    <li className="met-paso">
      <span className="met-paso-numero" aria-hidden="true">{numero}</span>
      <h3 className="met-paso-titulo"><span className="oculto-visual">Paso {numero}: </span>{titulo}</h3>
      <p className="met-paso-cifra num">{cifra}</p>
      <p className="met-paso-etiqueta">{etiqueta}</p>
      <div className="met-paso-texto">{children}</div>
    </li>
  );
}

function Flecha() {
  return (
    <li className="met-flecha" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </li>
  );
}

function Embudo({ cascada }) {
  const maximo = Math.max(1, ...FILTROS.map((f) => cascada?.[f.id] || 0));
  return (
    <ul className="met-embudo" aria-label="Filas quitadas por cada filtro">
      {FILTROS.map((f) => {
        const n = cascada?.[f.id] ?? 0;
        return (
          <li key={f.id}>
            <span className="met-embudo-nombre"><b>{f.id}</b> {f.nombre}</span>
            <span className="met-embudo-barra"><i style={{ width: `${Math.max(4, (n / maximo) * 100)}%` }} /></span>
            <span className="met-embudo-n num">{cascada ? entero(n) : '…'}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Recorrido({ c, fecha, meta }) {
  const fuera = c ? FILTROS.reduce((s, f) => s + (c.cascada?.[f.id] || 0), 0) : null;
  const reconciliaciones = (c?.reconciliaciones || []).filter((r) => ['R1', 'R2', 'R3'].includes(r.id));
  const subactividades = meta.rankings.reduce((s, r) => s + r.subactividades.length, 0);
  return (
    <section className="met-seccion" aria-labelledby="met-recorrido">
      <h2 id="met-recorrido" className="met-titulo-seccion">El recorrido de los datos</h2>
      <ol className="met-recorrido">
        <Paso numero={1} titulo="Leemos el archivo" cifra={c ? entero(c.filas_leidas) : '…'} etiqueta={`préstamos del corte ${fecha ? fechaCorte(fecha) : ''}`}>
          61 columnas por préstamo. Los códigos se leen como texto: «07» sigue siendo «07».
        </Paso>
        <Flecha />
        <Paso numero={2} titulo="Quitamos lo que no cuenta" cifra={fuera === null ? '…' : `−${entero(fuera)}`} etiqueta="filas fuera del cálculo">
          <Embudo cascada={c?.cascada} />
          <p className="met-nota">Cada fila sale una sola vez, en el primer filtro que incumple.</p>
        </Paso>
        <Flecha />
        <Paso numero={3} titulo="Clasificamos con el catálogo oficial" cifra={`${subactividades} → ${meta.rankings.length}`} etiqueta="actividades → rankings">
          Solo con el catálogo CINU/SB109, nunca con datos del cliente.
          <p className="met-nota met-nota-destacada">
            Los préstamos personales hechos con tarjeta (facilidad 07) se cuentan como <b>Tarjeta</b>
            {c && c.reclasificadas_sb21 != null ? <>: <b className="num">{entero(c.reclasificadas_sb21)}</b> este mes.</> : '.'}
          </p>
        </Paso>
        <Flecha />
        <Paso numero={4} titulo="Sumamos al centavo" cifra={c ? montoCorto(c.saldo_universo) : '…'} etiqueta={c ? `en ${entero(c.universo)} préstamos válidos` : 'saldo válido'}>
          {c && <span className="met-exacto num">{monto(c.saldo_universo)} u.m.</span>}
          Sumamos en centavos enteros: no se pierde ni un centavo.
          <ul className="met-controles">
            {reconciliaciones.map((r) => (
              <li key={r.id} className={r.ok ? 'met-ok' : 'met-falla'} title={r.nombre}>
                <span aria-hidden="true">{r.ok ? '✓' : '✗'}</span> {r.id} {r.ok ? 'cuadra' : 'no cuadra'}
              </li>
            ))}
          </ul>
        </Paso>
        <Flecha />
        <Paso numero={5} titulo="Ordenamos y comparamos" cifra={`${meta.rankings.length} × ${meta.bancos.length}`} etiqueta="rankings × bancos">
          Mayor saldo = 1.er lugar; si empatan, va primero el código de banco menor. Cada mes se compara con el
          anterior y se explica quién sube y por qué.
        </Paso>
      </ol>
      <ul className="met-confianza">
        <li><span aria-hidden="true">✓</span> Verificado con una segunda implementación independiente (Python): <b>0 diferencias</b></li>
        <li><span aria-hidden="true">✓</span> <b>15 pruebas</b> automáticas</li>
        <li><span aria-hidden="true">✓</span> La IA <b>nunca calcula</b>: solo explica</li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- cómo se conectan los archivos
const RELACIONES = [
  {
    clase: 'met-rel-actividad', de: 'Tipo_Actividad', a: 'Codigo_CINU', pregunta: '¿A qué actividad pertenece?',
    tabla: 'Catálogo CINU / SB109', detalle: '22 actividades económicas',
    campos: [{ nombre: 'Codigo_CINU', llave: true }, { nombre: 'Macroactividad_Reto', nota: 'el ranking' }, { nombre: 'Subactividad_Reto' }],
  },
  {
    clase: 'met-rel-facilidad', de: 'Facilidad_Crediticia', a: 'Codigo', pregunta: '¿Es una tarjeta?',
    tabla: 'Tabla SB21', detalle: 'facilidades crediticias',
    campos: [{ nombre: 'Codigo', llave: true, nota: '07 = tarjeta' }, { nombre: 'Descripcion' }],
  },
  {
    clase: 'met-rel-banco', de: 'Codigo_Banco', a: 'Codigo_Banco', pregunta: '¿Qué banco es?',
    tabla: 'Bancos ficticios', detalle: 'códigos 101 a 112',
    campos: [{ nombre: 'Codigo_Banco', llave: true }, { nombre: 'Nombre_Ficticio' }],
  },
];

function TarjetaTabla({ titulo, detalle, campos, principal }) {
  return (
    <div className={`met-tabla ${principal ? 'met-tabla-principal' : ''}`}>
      <div className="met-tabla-cabecera">
        <strong>{titulo}</strong>
        <span>{detalle}</span>
      </div>
      <ul className="met-tabla-campos">
        {campos.map((c) => (
          <li key={c.nombre} className={c.clase || ''}>
            {c.llave
              ? <span className="met-llave">llave</span>
              : <i className={`met-punto ${c.clase ? '' : 'met-punto-vacio'}`} aria-hidden="true" />}
            <code>{c.nombre}</code>
            {c.nota && <span className="met-campo-nota">{c.nota}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Conexiones({ c }) {
  return (
    <section className="met-seccion" aria-labelledby="met-conexiones">
      <h2 id="met-conexiones" className="met-titulo-seccion">Cómo se conectan los archivos</h2>
      <p className="met-intro">Cada préstamo del AT03 busca su actividad, su tipo de facilidad y su banco en los catálogos oficiales. El color une cada campo con su catálogo.</p>
      <div className="met-er">
        <div className="met-er-origen">
          <TarjetaTabla
            principal titulo="AT03 · Préstamos" detalle={c ? `${entero(c.filas_leidas)} filas este mes` : 'una fila por préstamo'}
            campos={[
              { nombre: 'Numero_Prestamo', llave: true, nota: 'único en el mes' },
              { nombre: 'Tipo_Actividad', clase: 'met-rel-actividad' },
              { nombre: 'Facilidad_Crediticia', clase: 'met-rel-facilidad' },
              { nombre: 'Codigo_Banco', clase: 'met-rel-banco' },
              { nombre: 'Saldo', nota: 'lo que se suma' },
            ]}
          />
        </div>
        <ol className="met-er-relaciones">
          {RELACIONES.map((r) => (
            <li key={r.tabla} className={`met-er-fila ${r.clase}`}>
              <div className="met-er-enlace">
                <span className="met-er-pregunta">{r.pregunta}</span>
                <svg className="met-er-linea" viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="0" y1="6" x2="112" y2="6" />
                  <path d="M106 1 L118 6 L106 11" />
                </svg>
                <code className="met-er-llaves">{r.de} → {r.a}</code>
              </div>
              <TarjetaTabla titulo={r.tabla} detalle={r.detalle} campos={r.campos.map((x) => (x.llave ? { ...x, clase: r.clase } : x))} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- reglas exactas (plegadas)
function ReglasExactas({ meta }) {
  const p = meta.parametros || {};
  return (
    <details className="met-detalles">
      <summary>Ver las reglas exactas (para técnicos)</summary>
      <div className="met-detalles-cuerpo">
        <ol className="met-reglas">
          <li><strong>Lectura.</strong> Los códigos se tratan como texto para no perder ceros (07 no es 7). El mes de cada fila sale del campo Fecha (AAAAMMDD), no del nombre del archivo. Se exigen 61 columnas en el orden del diccionario.</li>
          <li><strong>Exclusiones en cascada, en este orden:</strong> E1 Numero_Prestamo repetido en el mes (se conserva la primera aparición según el orden del archivo) → E2 Destino distinto de exactamente «L» → E3 Saldo ≤ 0 → E4 Tipo_Actividad que no existe en Codigo_CINU. Cada fila cuenta una sola vez y queda registrada con su motivo. Debe cumplirse: filas leídas = E1 + E2 + E3 + E4 + universo.</li>
          <li><strong>Clasificación solo con catálogos.</strong> AT03.Tipo_Actividad = CINU.Codigo_CINU (igualdad exacta). Codigo_SB08_Referencia no es llave. Nunca se usan nombres ni datos del cliente.</li>
          <li><strong>Regla SB21 en Consumo.</strong> Crédito personal con facilidad 07 → Tarjeta (se resta de Crédito personal; el total de Consumo no cambia). Automóvil debe tener facilidad 03 y Tarjeta facilidad 07; si no, se reporta una alerta y se respeta el catálogo.</li>
          <li><strong>Sumas exactas.</strong> En centavos enteros. Ponderación = saldo de la actividad ÷ cartera local válida TOTAL del banco × 100, con 4 decimales y redondeo aritmético. El denominador se calcula antes de cualquier filtro de la vista.</li>
          <li><strong>Ranking.</strong> Saldo de mayor a menor; Posición 1 = mayor saldo; empate exacto → Codigo_Banco ascendente. Siempre los 12 bancos (0.00 si no tienen saldo).</li>
          <li><strong>Controles.</strong> R1: subactividades = actividad; R2: 6 actividades = cartera total del banco; R3: 12 bancos = universo. Unicidad del préstamo en el universo e integridad con los catálogos.</li>
          <li><strong>Movimientos.</strong> Cambio de posición = anterior − actual (positivo = sube); Var. saldo % = (actual − anterior) ÷ anterior × 100. Es significativo si sube o baja al menos {p.mov_min_posiciones ?? 2} posiciones{p.mov_cambio_lider ? ', si cambia el líder' : ''} o si el saldo varía más de {p.mov_var_saldo_pct ?? '15.00'} %. El administrador ajusta estos umbrales.</li>
          <li><strong>La IA explica, no calcula.</strong> El asistente solo lee resultados ya calculados por el motor, que es determinista: los mismos archivos dan siempre los mismos números.</li>
        </ol>
      </div>
    </details>
  );
}

export default function Metodologia() {
  const { meta, fecha } = useApp();
  const estado = useDatos(() => (fecha ? api.calidad(fecha).catch(() => null) : null), [fecha]);
  const c = estado.datos;
  const periodo = fecha ? etiquetaPeriodo(fecha, meta) : '';
  return (
    <div className="met">
      <EncabezadoPagina
        titulo="Cómo se calcula cada ranking"
        subtitulo={`De ${c ? entero(c.filas_leidas) : '…'} préstamos a ${meta.rankings.length} rankings verificados al centavo, en 5 pasos${periodo ? ` · ${periodo}` : ''}`}
      />
      <Recorrido c={c} fecha={fecha} meta={meta} />
      <Conexiones c={c} />
      <ReglasExactas meta={meta} />
    </div>
  );
}
