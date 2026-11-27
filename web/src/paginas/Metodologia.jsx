// Metodología: de dónde salen los números, en lenguaje claro, y glosario.
import { useApp } from '../contexto.jsx';
import { Tarjeta } from '../componentes/Comunes.jsx';

const PASOS = [
  { t: 'Archivos AT03', d: 'Un archivo por mes, una fila por préstamo, 61 columnas. Todo se lee como texto (los códigos conservan sus ceros).' },
  { t: 'Validación', d: '61 columnas con los nombres y el orden del diccionario; fecha AAAAMMDD; bancos y facilidades contra sus catálogos (alerta).' },
  { t: 'E1 Duplicados', d: 'Mismo Numero_Prestamo en el período: queda la primera aparición.' },
  { t: 'E2 Extranjero', d: 'Destino distinto de «L».' },
  { t: 'E3 Saldo ≤ 0', d: 'Saldo cero o negativo.' },
  { t: 'E4 Sin catálogo', d: 'Tipo_Actividad fuera del catálogo CINU/SB109.' },
  { t: 'Clasificación', d: 'Tipo_Actividad → Macroactividad y Subactividad del catálogo. Regla SB21: crédito personal con facilidad 07 → Tarjeta.' },
  { t: 'Agregación exacta', d: 'Sumas en centavos enteros por banco, actividad y subactividad. Reconciliaciones al centavo.' },
  { t: 'Ranking', d: 'Saldo de mayor a menor (empate: código de banco). Ponderación = saldo de la actividad ÷ cartera válida del banco × 100, 4 decimales.' },
  { t: 'Comparación', d: 'Cambio de posición y de saldo contra el mes anterior; regla configurable de movimiento significativo.' },
];

const GLOSARIO = [
  ['AT03 (Átomo 03)', 'Reporte regulatorio que cada banco envía a la Superintendencia con el detalle de cada operación de crédito al cierre del mes. Aquí es sintético.'],
  ['CINU', 'Clasificación Industrial Internacional Uniforme (ISIC, de la ONU): códigos jerárquicos de actividad económica. Ej.: K.64.649.6492.64921 = finanzas → crédito → crédito personal.'],
  ['Catálogo CINU/SB109', 'Las 22 actividades del reto, cada una asignada a una de 6 macroactividades (los rankings) y a una subactividad. Es la única fuente para clasificar.'],
  ['Tabla SB21', 'Tipo de facilidad crediticia: 01 préstamo a plazo, 02 línea de crédito, 03 préstamo de auto, 04 sobregiro contractual (pactado con límite), 05 sobregiro ocasional (no pactado), 07 tarjeta de crédito.'],
  ['Saldo', 'Capital que el cliente todavía debe a la fecha de corte. No incluye intereses ni provisiones, y no es el monto original (Valor_Inicial).'],
  ['Cartera local válida', 'Lo que los bancos prestaron a clientes en Panamá y todavía les deben, después de los filtros de calidad. No es dinero disponible ni depósitos.'],
  ['Operación válida', 'Un préstamo (o tarjeta, línea o sobregiro) que superó los filtros. No es una transacción ni un pago: cada fila del AT03 es una operación.'],
  ['Posición en un ranking', '¿Quién tiene más saldo prestado en ese sector? El sector es el del destino del crédito, no el del banco. No mide ganancias: los datos no traen utilidades.'],
  ['Universo local válido', 'Los préstamos que superan los 4 filtros. Sobre ellos se calculan todos los rankings.'],
  ['Ponderación', 'Qué parte de la cartera de un banco está en una actividad. Es el porcentaje oficial del reto.'],
  ['Cuota', 'Qué parte de una actividad (todo el sistema) tiene un banco. Indicador adicional.'],
  ['Morosidad', 'Saldo de préstamos con días de mora sobre el saldo total. Indicador adicional, no interviene en los rankings.'],
  ['HHI', 'Índice Herfindahl-Hirschman: suma de los cuadrados de las cuotas. Mide qué tan concentrado está un mercado.'],
];

export default function Metodologia() {
  const { meta } = useApp();
  const p = meta.parametros;
  return (
    <>
      <div className="titulo-pagina">
        <h1>Metodología</h1>
        <p>Cómo se calcula cada cifra. El cálculo es determinista y reproducible: los mismos archivos producen siempre los mismos resultados. La IA no interviene en él.</p>
      </div>

      <Tarjeta titulo="Del archivo al ranking" subtitulo="Se aplica a cada período por separado (el período sale del campo Fecha, no del nombre del archivo).">
        <ol className="flujo">
          {PASOS.map((x, i) => (
            <li key={x.t} className={x.t.startsWith('E') ? 'filtro' : ''}>
              <span className="flujo-num">{i + 1}</span>
              <strong>{x.t}</strong>
              <span>{x.d}</span>
            </li>
          ))}
        </ol>
      </Tarjeta>

      <div className="dos-columnas">
        <Tarjeta titulo="Rankings y subactividades">
          <dl className="definiciones">
            {meta.rankings.map((r) => (
              <div key={r.nombre}><dt>{r.titulo} <span className="tenue chico">({r.tipo})</span></dt><dd>{r.subactividades.join(' · ')}</dd></div>
            ))}
          </dl>
        </Tarjeta>
        <Tarjeta titulo="Movimiento significativo (regla vigente)">
          <p>Un cambio entre dos períodos se marca como significativo si cumple al menos una condición:</p>
          <ul>
            <li>el banco sube o baja <b>{p.mov_min_posiciones}</b> o más posiciones;</li>
            {p.mov_cambio_lider && <li>hay un nuevo líder (o el líder pierde el primer lugar);</li>}
            <li>su saldo en la actividad varía <b>{p.mov_var_saldo_pct} %</b> o más.</li>
          </ul>
          <p className="nota">El administrador puede cambiar estos valores sin tocar el código; las explicaciones se generan solas con plantillas, sin IA.</p>
        </Tarjeta>
      </div>

      <Tarjeta titulo="Glosario">
        <dl className="definiciones glosario">
          {GLOSARIO.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
        </dl>
        <p className="nota">{meta.aviso}</p>
      </Tarjeta>
    </>
  );
}
