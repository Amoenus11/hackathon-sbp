// Metodología: diagrama interactivo de los datos (entidades, llaves y flujo de cálculo) y las reglas
// explicadas en palabras simples. Al tocar un nodo se ve la regla exacta y los números del período.
import { useMemo, useState } from 'react';
import { Background, Handle, MarkerType, Panel, Position, ReactFlow, useReactFlow } from '@xyflow/react';
import { api } from '../api.js';
import { useApp, useDatos } from '../contexto.jsx';
import { EncabezadoPagina, Tarjeta } from '../componentes/Comunes.jsx';
import { entero, etiquetaPeriodo, monto, montoCorto } from '../formato.js';

// ---------------------------------------------------------------- nodos del diagrama
function NodoEntidad({ data }) {
  return (
    <div className={`nodo-entidad ${data.elegido ? 'elegido' : ''}`}>
      <Handle type="source" position={Position.Top} id="salida" className="manija" />
      <div className="nodo-entidad-cabecera">
        <strong>{data.titulo}</strong>
        <span>{data.subtitulo}</span>
      </div>
      <ul className="nodo-campos">
        {data.campos.map((c) => (
          <li key={c.nombre} className={c.tipo ? `campo-${c.tipo.toLowerCase()}` : ''}>
            <Handle type="target" position={Position.Left} id={`${c.nombre}-t`} className="manija" />
            <span className="campo-llave">{c.tipo || ''}</span>
            <span className="campo-nombre">{c.nombre}</span>
            {c.nota && <span className="campo-nota">{c.nota}</span>}
            <Handle type="source" position={Position.Right} id={`${c.nombre}-s`} className="manija" />
          </li>
        ))}
      </ul>
      {data.mas && <p className="nodo-mas">{data.mas}</p>}
      <Handle type="source" position={Position.Right} id="uso" className="manija manija-uso" />
    </div>
  );
}

function NodoPaso({ data }) {
  return (
    <div className={`nodo-paso nodo-${data.clase} ${data.elegido ? 'elegido' : ''}`}>
      <Handle type="target" position={Position.Top} id="arriba" className="manija" />
      <Handle type="target" position={Position.Left} id="izq" className="manija" />
      <div className="nodo-paso-titulo">{data.titulo}</div>
      {data.valor && <div className="nodo-paso-valor num">{data.valor}</div>}
      <div className="nodo-paso-detalle">{data.detalle}</div>
      <Handle type="source" position={Position.Bottom} id="abajo" className="manija" />
      <Handle type="source" position={Position.Right} id="der" className="manija" />
    </div>
  );
}

const TIPOS_NODO = { entidad: NodoEntidad, paso: NodoPaso };

// ---------------------------------------------------------------- qué explica cada nodo
const DETALLES = {
  at03: {
    titulo: 'AT03 · Átomo 03 (préstamos)',
    texto: 'El reporte regulatorio de cartera de crédito: una fila por operación, 61 campos. Hay un archivo por cada corte mensual.',
    regla: 'El período de cada fila sale del campo Fecha (AAAAMMDD), no del nombre del archivo. Los códigos se leen como texto para no perder ceros a la izquierda (07, 001, 0701).',
    numeros: (c, m) => [['Períodos cargados', entero(m.periodos.length)], ['Filas del período', entero(c?.filas_leidas)]],
  },
  cinu: {
    titulo: 'Catálogo CINU / SB109',
    texto: '22 actividades económicas agrupadas en 6 macroactividades (los rankings) y 22 subactividades. Es la única fuente para clasificar.',
    regla: 'Se cruza AT03.Tipo_Actividad = CINU.Codigo_CINU por igualdad exacta. Codigo_SB08_Referencia NO se usa como llave (el 2103 se repite).',
    numeros: (c, m) => [['Rankings (macroactividades)', entero(m.rankings.length)], ['Subactividades', entero(m.rankings.reduce((s, r) => s + r.subactividades.length, 0))]],
  },
  sb21: {
    titulo: 'Tabla SB21 · Facilidades crediticias',
    texto: 'Tipos de instrumento: préstamo a plazo, línea de crédito, préstamo de auto, sobregiros y tarjeta de crédito (07).',
    regla: 'Solo interviene en Consumo: un Crédito personal con facilidad 07 es en realidad una tarjeta y se pasa a la subactividad Tarjeta.',
    numeros: () => [['Códigos en la tabla', '6 (01, 02, 03, 04, 05, 07)']],
  },
  bancos: {
    titulo: 'Bancos ficticios',
    texto: '12 bancos de licencia general, códigos 101 a 112.',
    regla: 'Cada ranking incluye siempre a los 12 bancos; si un banco no tiene saldo en una actividad, aparece con 0.00. Un código que no exista en el catálogo se reporta como alerta.',
    numeros: (c, m) => [['Bancos', entero(m.bancos.length)]],
  },
  ingesta: {
    titulo: 'Ingesta y validación',
    texto: 'Se lee el archivo y se comprueba que tenga las 61 columnas en el orden del diccionario, los tipos esperados y la integridad con los catálogos.',
    regla: 'Un banco o una facilidad que no exista en su catálogo genera una alerta de calidad, pero no excluye la fila.',
    numeros: (c) => [['Filas leídas', entero(c?.filas_leidas)], ['Columnas', entero(c?.esquema?.columnas)]],
  },
  e1: {
    titulo: 'E1 · Duplicados',
    texto: 'Un mismo número de préstamo no puede aparecer dos veces en el mismo mes.',
    regla: 'Si un Numero_Prestamo se repite dentro del período, se conserva la PRIMERA aparición según el orden del archivo y se excluyen las siguientes. Que un préstamo aparezca en dos meses distintos no es duplicado.',
    numeros: (c) => [['Filas excluidas por E1', entero(c?.cascada?.E1)]],
  },
  e2: {
    titulo: 'E2 · Destino extranjero',
    texto: 'El ranking es de crédito local: las operaciones con destino en el extranjero no cuentan.',
    regla: 'Se excluye toda fila con Destino distinto de «L» (comparación exacta, sensible a mayúsculas). Se aplica sobre las filas que quedaron tras E1.',
    numeros: (c) => [['Filas excluidas por E2', entero(c?.cascada?.E2)]],
  },
  e3: {
    titulo: 'E3 · Saldo no positivo',
    texto: 'Un préstamo sin saldo (o con saldo negativo) no suma cartera.',
    regla: 'Se excluye toda fila con Saldo ≤ 0, sobre las filas locales que quedaron tras E2.',
    numeros: (c) => [['Filas excluidas por E3', entero(c?.cascada?.E3)]],
  },
  e4: {
    titulo: 'E4 · Actividad no catalogada',
    texto: 'Si la actividad económica no está en el catálogo congelado, no se puede clasificar.',
    regla: 'Se excluye toda fila cuyo Tipo_Actividad no existe en Catalogo_CINU_SB109_reto.Codigo_CINU.',
    numeros: (c) => [['Filas excluidas por E4', entero(c?.cascada?.E4)]],
  },
  universo: {
    titulo: 'Universo local válido',
    texto: 'Lo que queda después de los 4 filtros. Sobre esto se calcula todo.',
    regla: 'Cada fila excluida cuenta una sola vez, en el primer filtro que incumple. Debe cumplirse: filas leídas = E1 + E2 + E3 + E4 + universo.',
    numeros: (c) => [['Operaciones válidas', entero(c?.universo)], ['Saldo total', `${monto(c?.saldo_universo)} u.m.`], ['¿Cuadra?', c ? (c.cuadra ? 'Sí ✓' : 'No ✗') : '—']],
  },
  clasif: {
    titulo: 'Clasificación y regla SB21',
    texto: 'Cada operación recibe su macroactividad (ranking) y subactividad desde el catálogo CINU.',
    regla: 'Consumo: Crédito personal + facilidad 07 → Tarjeta (se resta de Crédito personal; el total de Consumo no cambia). Automóvil debe tener facilidad 03 y Tarjeta facilidad 07; si no, se reporta alerta y se respeta el catálogo.',
    numeros: (c) => {
      const a = c?.alertas?.find((x) => x.tipo?.includes('consumo'));
      return [['Alertas de coherencia en Consumo', a ? entero(a.cantidad) : '0']];
    },
  },
  agreg: {
    titulo: 'Agregación exacta',
    texto: 'Se suman los saldos por subactividad, luego por actividad y la cartera total de cada banco.',
    regla: 'Sumas en centavos enteros (sin errores de redondeo). Ponderación = saldo de la actividad ÷ cartera local válida TOTAL del banco × 100, redondeada a 4 decimales. El denominador se calcula antes de filtrar.',
    numeros: (c) => {
      const r = c?.reconciliaciones || [];
      return r.map((x) => [`${x.id} · ${x.nombre}`, x.ok ? 'Cuadra ✓' : `${x.diferencias} diferencias ✗`]);
    },
  },
  rankings: {
    titulo: '6 rankings × 12 bancos',
    texto: 'Hipotecario, Construcción, Industria y Agropecuario (obligatorios), Comercio (recomendado) y Consumo (bonus).',
    regla: 'Orden por saldo de la actividad, de mayor a menor; Posición 1 = mayor saldo. Empate exacto: gana el código de banco menor. Siempre 12 posiciones, sin huecos.',
    numeros: (c, m) => [['Rankings', entero(m.rankings.length)], ['Bancos por ranking', entero(m.bancos.length)]],
  },
  movs: {
    titulo: 'Movimientos y explicación automática',
    texto: 'Al cargar un nuevo corte se compara con el anterior y se explican los cambios más importantes.',
    regla: 'Cambio de posición = posición anterior − posición actual (positivo = sube). Var. saldo % = (actual − anterior) ÷ anterior × 100. La regla de «significativo» es configurable por el administrador.',
    numeros: (c, m) => [
      ['Mínimo de posiciones', entero(m.parametros?.mov_min_posiciones)],
      ['Cambio de líder cuenta', m.parametros?.mov_cambio_lider ? 'Sí' : 'No'],
      ['Variación de saldo', `> ${m.parametros?.mov_var_saldo_pct ?? '—'} %`],
    ],
  },
};

function construirDiagrama(c, elegido) {
  const n = (id, tipo, x, y, data) => ({ id, type: tipo, position: { x, y }, data: { ...data, elegido: elegido === id } });
  const nodos = [
    n('at03', 'entidad', 0, 40, {
      titulo: 'AT03 · Préstamos', subtitulo: 'una fila por operación',
      campos: [
        { nombre: 'Fecha', nota: 'período' },
        { nombre: 'Numero_Prestamo', tipo: 'PK', nota: 'único por período' },
        { nombre: 'Codigo_Banco', tipo: 'FK' },
        { nombre: 'Tipo_Actividad', tipo: 'FK' },
        { nombre: 'Facilidad_Crediticia', tipo: 'FK' },
        { nombre: 'Destino', nota: 'L / E' },
        { nombre: 'Saldo', nota: 'métrica' },
      ],
      mas: '+ 54 campos de contexto (tasas, garantías, mora…)',
    }),
    n('cinu', 'entidad', 380, 0, {
      titulo: 'Catálogo CINU / SB109', subtitulo: '22 actividades',
      campos: [
        { nombre: 'Codigo_CINU', tipo: 'PK' },
        { nombre: 'Macroactividad_Reto', nota: 'ranking' },
        { nombre: 'Subactividad_Reto' },
        { nombre: 'Codigo_SB08_Referencia', nota: 'no es llave' },
      ],
    }),
    n('sb21', 'entidad', 380, 215, {
      titulo: 'Tabla SB21', subtitulo: 'facilidades crediticias',
      campos: [{ nombre: 'Codigo', tipo: 'PK', nota: '07 = tarjeta' }, { nombre: 'Descripcion' }, { nombre: 'Uso_en_reto' }],
    }),
    n('bancos', 'entidad', 380, 390, {
      titulo: 'Bancos ficticios', subtitulo: '101 a 112',
      campos: [{ nombre: 'Codigo_Banco', tipo: 'PK' }, { nombre: 'Nombre_Ficticio' }, { nombre: 'Tipo_Licencia' }],
    }),
    n('ingesta', 'paso', 780, 0, { clase: 'proceso', titulo: 'Ingesta y validación', valor: c ? `${entero(c.filas_leidas)} filas` : '…', detalle: '61 columnas · códigos como texto' }),
    n('e1', 'paso', 780, 104, { clase: 'filtro', titulo: 'E1 · Duplicados', valor: c ? `−${entero(c.cascada.E1)}` : '…', detalle: 'se queda la 1.ª aparición' }),
    n('e2', 'paso', 780, 208, { clase: 'filtro', titulo: 'E2 · Destino extranjero', valor: c ? `−${entero(c.cascada.E2)}` : '…', detalle: 'solo Destino = L' }),
    n('e3', 'paso', 780, 312, { clase: 'filtro', titulo: 'E3 · Saldo ≤ 0', valor: c ? `−${entero(c.cascada.E3)}` : '…', detalle: 'solo saldo positivo' }),
    n('e4', 'paso', 780, 416, { clase: 'filtro', titulo: 'E4 · Actividad no catalogada', valor: c ? `−${entero(c.cascada.E4)}` : '…', detalle: 'código fuera del catálogo' }),
    n('universo', 'paso', 780, 520, { clase: 'resultado', titulo: 'Universo local válido', valor: c ? `${entero(c.universo)} op.` : '…', detalle: c ? `${montoCorto(c.saldo_universo)} u.m.` : '' }),
    n('clasif', 'paso', 1090, 104, { clase: 'proceso', titulo: 'Clasificación + SB21', valor: 'CINU → actividad', detalle: 'Crédito personal + 07 → Tarjeta' }),
    n('agreg', 'paso', 1090, 208, { clase: 'proceso', titulo: 'Agregación exacta', valor: 'centavos enteros', detalle: 'subactividad → actividad → banco' }),
    n('rankings', 'paso', 1090, 312, { clase: 'resultado', titulo: 'Rankings', valor: '6 × 12 bancos', detalle: 'saldo desc. · empate por código' }),
    n('movs', 'paso', 1090, 416, { clase: 'resultado', titulo: 'Movimientos', valor: 'mes vs mes', detalle: 'regla configurable + explicación' }),
  ];

  const flecha = { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#0e7c86' };
  const flujo = (id, s, t, sh = 'abajo', th = 'arriba') => ({
    id, source: s, target: t, sourceHandle: sh, targetHandle: th, type: 'smoothstep', animated: true,
    markerEnd: flecha, style: { stroke: '#0e7c86', strokeWidth: 2 },
  });
  const relacion = (id, s, sh, t, th, etiqueta) => ({
    id, source: s, target: t, sourceHandle: sh, targetHandle: th, label: etiqueta, type: 'default',
    style: { stroke: '#5b4bdb', strokeWidth: 1.6, strokeDasharray: '6 4' },
    labelStyle: { fill: '#334155', fontWeight: 600, fontSize: 11 }, labelBgStyle: { fill: '#ffffff' }, labelBgPadding: [4, 2],
    markerEnd: { type: MarkerType.Arrow, color: '#5b4bdb' },
  });
  const uso = (id, s, t, th, etiqueta) => ({
    id, source: s, target: t, sourceHandle: 'uso', targetHandle: th, label: etiqueta, type: 'smoothstep',
    style: { stroke: '#94a3b8', strokeWidth: 1.2, strokeDasharray: '3 4' },
    labelStyle: { fill: '#5b6b7c', fontSize: 10 }, labelBgStyle: { fill: '#f8fafc' },
  });

  const aristas = [
    relacion('r-cinu', 'at03', 'Tipo_Actividad-s', 'cinu', 'Codigo_CINU-t', 'N : 1'),
    relacion('r-sb21', 'at03', 'Facilidad_Crediticia-s', 'sb21', 'Codigo-t', 'N : 1'),
    relacion('r-bancos', 'at03', 'Codigo_Banco-s', 'bancos', 'Codigo_Banco-t', 'N : 1'),
    { ...flujo('f-at03', 'at03', 'ingesta', 'salida', 'izq'), type: 'smoothstep' },
    flujo('f-1', 'ingesta', 'e1'), flujo('f-2', 'e1', 'e2'), flujo('f-3', 'e2', 'e3'), flujo('f-4', 'e3', 'e4'), flujo('f-5', 'e4', 'universo'),
    flujo('f-6', 'universo', 'clasif', 'der', 'izq'),
    flujo('f-7', 'clasif', 'agreg'), flujo('f-8', 'agreg', 'rankings'), flujo('f-9', 'rankings', 'movs'),
    uso('u-cinu-e4', 'cinu', 'e4', 'izq', 'valida'),
    uso('u-sb21', 'sb21', 'clasif', 'izq', 'reclasifica'),
    uso('u-bancos', 'bancos', 'rankings', 'izq', '12 siempre'),
  ];
  return { nodos, aristas };
}

export default function Metodologia() {
  const { meta, fecha } = useApp();
  const [elegido, setElegido] = useState('universo');
  const estado = useDatos(() => (fecha ? api.calidad(fecha).catch(() => null) : null), [fecha]);
  const calidad = estado.datos;
  const { nodos, aristas } = useMemo(() => construirDiagrama(calidad, elegido), [calidad, elegido]);
  const detalle = DETALLES[elegido];

  return (
    <>
      <EncabezadoPagina
        titulo="Metodología y datos"
        subtitulo="Cómo se pasa del archivo AT03 a los rankings: entidades, llaves y cada regla aplicada. Toca cualquier caja."
      />
      <div className="rejilla-diagrama">
        <Tarjeta className="tarjeta-diagrama" id="diagrama">
          <div className="leyenda-diagrama" aria-hidden="true">
            <span><i className="muestra muestra-entidad" />Tabla de datos</span>
            <span><i className="muestra muestra-proceso" />Proceso</span>
            <span><i className="muestra muestra-filtro" />Exclusión</span>
            <span><i className="muestra muestra-resultado" />Resultado</span>
            <span><i className="muestra muestra-relacion" />Relación (llave)</span>
          </div>
          <div className="lienzo-diagrama" role="img" aria-label="Diagrama interactivo: las tablas AT03, CINU, SB21 y Bancos se relacionan por sus llaves; los datos pasan por los filtros E1 a E4, el universo local válido, la clasificación, la agregación, los rankings y los movimientos.">
            <ReactFlow
              nodes={nodos} edges={aristas} nodeTypes={TIPOS_NODO}
              fitView fitViewOptions={{ padding: 0.08 }} minZoom={0.3} maxZoom={1.8}
              nodesDraggable={false} nodesConnectable={false} elementsSelectable
              onNodeClick={(_, nodo) => setElegido(nodo.id)}
              panOnScroll={false} zoomOnScroll={false} preventScrolling={false}
              colorMode="light" proOptions={{ hideAttribution: true }}
            >
              <Background gap={22} color="#dfe5ee" />
              <ControlesDiagrama />
            </ReactFlow>
          </div>
        </Tarjeta>

        <Tarjeta className="tarjeta-detalle-nodo" titulo={detalle.titulo} subtitulo={fecha ? `Números de ${etiquetaPeriodo(fecha, meta)}` : null} id="detalle-nodo">
          <p>{detalle.texto}</p>
          <div className="regla-exacta">
            <span>Regla exacta</span>
            <p>{detalle.regla}</p>
          </div>
          <dl className="numeros-nodo">
            {detalle.numeros(calidad, meta).map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>
            ))}
          </dl>
          <div className="atajos-nodos">
            {Object.keys(DETALLES).map((id) => (
              <button key={id} type="button" className={`chip ${elegido === id ? 'activo' : ''}`} onClick={() => setElegido(id)}>
                {DETALLES[id].titulo.split(' · ')[0]}
              </button>
            ))}
          </div>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Reglas implementadas, en palabras simples" id="reglas">
        <ol className="reglas">
          <li><strong>Leemos los archivos tal como vienen.</strong> Los códigos se tratan como texto para no perder ceros (07 no es 7). El mes de cada fila sale del campo Fecha.</li>
          <li><strong>Quitamos lo que no corresponde, en orden (E1 → E4):</strong> préstamos repetidos en el mes (se queda el primero), operaciones en el extranjero, saldos en cero o negativos y actividades que no están en el catálogo. Cada fila quitada cuenta una sola vez y queda registrada con su motivo.</li>
          <li><strong>Clasificamos solo con los catálogos oficiales.</strong> Nunca con nombres ni datos del cliente. El código de actividad decide el ranking y la subactividad.</li>
          <li><strong>Consumo tiene una regla especial (SB21):</strong> un «crédito personal» pagado con tarjeta de crédito (facilidad 07) se cuenta como Tarjeta. Solo cambia el reparto dentro de Consumo, nunca el total.</li>
          <li><strong>Sumamos al centavo.</strong> Trabajamos con centavos enteros, así que no hay errores de redondeo. La ponderación usa como denominador toda la cartera válida del banco y se redondea a 4 decimales.</li>
          <li><strong>Ordenamos y comparamos.</strong> Mayor saldo = 1.er lugar; si dos bancos empatan, va primero el código menor. Al cargar un mes nuevo, se recalcula todo y se señalan los movimientos que cumplen la regla configurada.</li>
          <li><strong>Comprobamos que todo cuadre.</strong> Filas leídas = exclusiones + universo; subactividades = actividad; actividades = cartera total del banco; bancos = universo.</li>
          <li><strong>Si un mismo mes viene en varios archivos, se reúnen.</strong> Los cálculos son por Fecha y no por archivo. Cuando el administrador carga un archivo de un mes que ya existe, ese mes se reemplaza y el sistema avisa cuántas filas había y cuántas hay ahora; la fecha debe existir en el calendario.</li>
          <li><strong>La IA explica, no calcula.</strong> El asistente solo lee resultados ya calculados por el motor, que es determinista: los mismos archivos dan siempre los mismos números.</li>
        </ol>
      </Tarjeta>

      <Tarjeta titulo="Indicadores adicionales y reglas de análisis" id="indicadores">
        <ol className="reglas">
          <li>
            <strong>Cartera morosa y vencida (norma de la SBP, no del reto).</strong> El instructivo del reto no las define, así que seguimos el
            {' '}<a href="https://www.superbancos.gob.pa/documentos/leyes_y_regulaciones/acuerdos/2013/Compilado_Acuerdo_4-2013.pdf" target="_blank" rel="noreferrer">Acuerdo 4-2013 de la Superintendencia de Bancos de Panamá</a>
            {' '}(art. 2, numerales 13 y 14): una facilidad es <em>morosa</em> si tiene importes impagos de más de 30 y hasta 90 días, y <em>vencida</em> si supera los 90 días.
            Los sobregiros (SB21: 04 y 05) pasan a vencidos al superar los 30 días. La regla clasifica la facilidad completa, por eso se mide sobre todo su saldo.
            Un atraso de 1 a 30 días no se cuenta como mora.
          </li>
          <li>
            <strong>Movimiento significativo.</strong> El reto deja la regla a cada equipo y pide que sea configurable. Un banco se marca si sube o baja las posiciones indicadas,
            si cambia el líder (con saldo real: un 0.00 que lidera por desempate no cuenta) o si su saldo varía el porcentaje indicado o más. Entrar a un sector (de 0 a algún saldo) o salir de él
            se marca siempre, porque un porcentaje sobre una base cero no existe. El umbral de saldo se compara con la distribución real de variaciones (mediana y percentil 90, en Comparar):
            si marca a demasiados bancos, deja de ser «significativo».
          </li>
          <li>
            <strong>Frente al sector.</strong> Además del porcentaje, se muestra cuántos puntos porcentuales crece el banco por encima o por debajo del conjunto de bancos en ese ranking:
            un banco que crece 9 % cuando todo el sector crece 9 % no hizo nada especial.
          </li>
        </ol>
      </Tarjeta>
    </>
  );
}

// Botones de zoom con nombre (más claros que los íconos de la librería)
function ControlesDiagrama() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="top-right" className="controles-diagrama">
      <button type="button" className="boton boton-secundario boton-chico" onClick={() => zoomIn({ duration: 200 })}>＋ Acercar</button>
      <button type="button" className="boton boton-secundario boton-chico" onClick={() => zoomOut({ duration: 200 })}>－ Alejar</button>
      <button type="button" className="boton boton-secundario boton-chico" onClick={() => fitView({ padding: 0.08, duration: 300 })}>⤢ Ver todo</button>
    </Panel>
  );
}
