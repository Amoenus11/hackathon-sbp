// Asistente de IA (opcional): EXPLICA resultados ya calculados por el motor. Nunca calcula rankings.
//
// - Usa la API de Claude con el SDK oficial. La credencial sale del entorno (ANTHROPIC_API_KEY en .env,
//   que no se sube al repositorio, o un perfil de `ant auth login`). Sin credencial, responde
//   { disponible: false } y el resto de la plataforma funciona igual.
// - Solo recibe un resumen de resultados (rankings, movimientos, calidad); nada de datos de clientes.
// - Fallbacks del lado del servidor activados: si el modelo declina por política, la API reintenta
//   con el modelo de respaldo que corresponda dentro de la misma llamada.
import Anthropic from '@anthropic-ai/sdk';
import { panel, rankings, movimientos, calidad, AVISO } from './vistas.js';

const MODELO = process.env.IA_MODELO || 'claude-opus-5-5';

const INSTRUCCIONES = `Eres el asistente de una plataforma de rankings de crédito bancario (Hackathon SBP 2026).
Respondes en español claro y breve (máximo unos 180 palabras), para un público no técnico.
Reglas:
- Usa SOLO los datos del bloque <resultados>. Son cifras ya calculadas por un motor determinista; no recalcules posiciones, saldos ni porcentajes, y no inventes cifras que no estén ahí.
- Si la pregunta pide algo que no está en los resultados, dilo y sugiere qué pantalla de la plataforma consultar.
- Los datos son ficticios: ${AVISO}
- No des recomendaciones de inversión ni opiniones sobre bancos reales.
- Escribe en texto plano, sin tablas ni HTML; puedes usar guiones para listas cortas.`;

let cliente = null;
const obtenerCliente = () => (cliente ??= new Anthropic());

/** Resumen compacto de resultados del período para dar contexto a la IA. */
function contexto(estado, fecha) {
  const pan = panel(estado, fecha);
  const datos = {
    periodo: pan.fecha, etiqueta: pan.etiqueta, periodo_anterior: pan.fecha_anterior,
    kpis: pan.kpis, indicadores: pan.indicadores,
    rankings: Object.fromEntries(estado.cat.rankings.map((r) => [r.nombre, rankings(estado, pan.fecha, r.nombre).filas.map((f) => ({
      pos: f.posicion, banco: f.banco, saldo: f.saldo_actividad, ponderacion_pct: f.ponderacion_pct, cuota_pct: f.participacion_pct, cambio: f.cambio,
    }))])),
    calidad: (({ cascada, universo, cuadra, alertas }) => ({ cascada, universo, cuadra, alertas: alertas.map((a) => a.texto) }))(calidad(estado, pan.fecha)),
  };
  if (pan.fecha_anterior) {
    const mov = movimientos(estado, pan.fecha_anterior, pan.fecha);
    datos.movimientos = { regla: mov.regla, explicaciones: mov.explicaciones.slice(0, 15) };
  }
  return JSON.stringify(datos);
}

export async function preguntar(estado, { pregunta, fecha }) {
  const texto = String(pregunta ?? '').trim();
  if (!texto) throw Object.assign(new Error('Escriba una pregunta.'), { estado: 400 });
  if (texto.length > 1000) throw Object.assign(new Error('La pregunta es demasiado larga (máximo 1000 caracteres).'), { estado: 400 });
  if (process.env.IA_DESACTIVADA === '1') return { disponible: false, respuesta: 'El asistente de IA está desactivado en esta instalación.' };

  const inicio = performance.now();
  try {
    const respuesta = await obtenerCliente().beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: INSTRUCCIONES,
      messages: [{ role: 'user', content: `<resultados>\n${contexto(estado, fecha)}\n</resultados>\n\nPregunta: ${texto}` }],
    });
    const segundos = Math.round((performance.now() - inicio) / 100) / 10;
    if (respuesta.stop_reason === 'refusal') {
      return { disponible: true, respuesta: 'El asistente no puede responder esa pregunta. Pruebe a reformularla sobre los rankings o los movimientos.', segundos };
    }
    const salida = respuesta.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return { disponible: true, respuesta: salida || 'El asistente no devolvió texto.', segundos };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError || /api key|credential|auth/i.test(e?.message ?? '')) {
      return { disponible: false, respuesta: 'El asistente de IA no está configurado: agregue ANTHROPIC_API_KEY al archivo .env (o inicie sesión con `ant auth login`) y reinicie el servidor.' };
    }
    if (e instanceof Anthropic.RateLimitError) return { disponible: true, respuesta: 'El asistente está saturado en este momento. Intente de nuevo en unos segundos.' };
    if (e instanceof Anthropic.APIConnectionError) return { disponible: false, respuesta: 'No hay conexión con el servicio de IA. El resto de la plataforma funciona sin conexión.' };
    if (e instanceof Anthropic.APIError) return { disponible: true, respuesta: `El servicio de IA respondió con un error (${e.status}). Intente más tarde.` };
    throw e;
  }
}
