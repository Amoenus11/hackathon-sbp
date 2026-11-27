// Presentación guiada: recorre la app en el orden del pitch (5 minutos), con una frase por pantalla.
// Se abre con «▶ Presentación guiada» en la cabecera. Teclas: → siguiente, ← anterior, Esc salir.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexto.jsx';
import { puede } from '../permisos.js';

export const PASOS = [
  { ruta: '/', titulo: 'El crédito en un vistazo', texto: 'Cartera local válida, los líderes de cada actividad y lo que cambió este mes, explicado solo.', minimo: 'publico' },
  { ruta: '/rankings', titulo: 'Los rankings', texto: '6 actividades × 12 bancos: posición, saldo y ponderación. Toca un banco para ver su desglose (Tarjeta por la regla SB21).', minimo: 'publico' },
  { ruta: '/metodologia', titulo: 'Cómo lo calculamos', texto: '5 pasos, al centavo: quitamos lo que no cuenta (E1–E4), clasificamos con el catálogo oficial y sumamos sin perder un centavo.', minimo: 'publico' },
  { ruta: '/admin/cargar', titulo: 'Un mes nuevo, sin tocar el código', texto: 'El administrador sube el archivo de septiembre: se valida, se recalcula y se compara con agosto automáticamente.', minimo: 'administrador' },
  { ruta: '/comparar', titulo: 'Quién sube y quién baja', texto: 'Los movimientos significativos según una regla configurable, cada uno con su explicación automática.', minimo: 'analista' },
  { ruta: '/calidad', titulo: 'Confianza y trazabilidad', texto: 'Filas leídas = E1 + E2 + E3 + E4 + universo. Reconciliaciones al centavo y cada fila excluida con su motivo.', minimo: 'analista' },
  { ruta: '/reportes', titulo: 'Listo para la junta', texto: 'Un reporte personalizado en PDF y las exportaciones oficiales en CSV.', minimo: 'analista' },
  { ruta: '/asistente', titulo: 'Pregúntale a la IA', texto: 'Responde en lenguaje natural con las cifras oficiales. La IA explica; nunca calcula.', minimo: 'publico' },
  { ruta: '/equipo', titulo: 'Equipo Syntropy', texto: 'Del caos de datos al orden de las decisiones.', minimo: 'publico' },
];

const NOMBRE = { analista: 'Analista', administrador: 'Administrador' };

export default function Recorrido() {
  const { paso, setPaso, sesion, abrirSesion } = useApp();
  const navegar = useNavigate();
  const activo = paso !== null && paso !== undefined;
  const actual = activo ? PASOS[paso] : null;

  useEffect(() => { if (actual) navegar(actual.ruta); }, [paso]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activo) return undefined;
    const alTeclear = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight') setPaso((p) => Math.min(PASOS.length - 1, p + 1));
      if (e.key === 'ArrowLeft') setPaso((p) => Math.max(0, p - 1));
      if (e.key === 'Escape') setPaso(null);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [activo, setPaso]);

  if (!actual) return null;
  const falta = !puede(sesion.perfil, actual.minimo);
  return (
    <div className="recorrido" role="region" aria-label="Presentación guiada">
      <div className="recorrido-progreso" aria-hidden="true">
        {PASOS.map((p, i) => (
          <button key={p.ruta} type="button" className={i === paso ? 'activo' : i < paso ? 'hecho' : ''} onClick={() => setPaso(i)} title={p.titulo} />
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
          <button type="button" className="boton boton-secundario boton-chico" onClick={() => setPaso(Math.max(0, paso - 1))} disabled={paso === 0}>← Anterior</button>
          {paso < PASOS.length - 1 ? (
            <button type="button" className="boton boton-primario boton-chico" onClick={() => setPaso(paso + 1)}>Siguiente →</button>
          ) : (
            <button type="button" className="boton boton-primario boton-chico" onClick={() => setPaso(null)}>Terminar</button>
          )}
          <button type="button" className="boton-cerrar" onClick={() => setPaso(null)} aria-label="Salir de la presentación">×</button>
        </div>
      </div>
    </div>
  );
}
