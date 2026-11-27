// Franja obligatoria (lámina 9): datos ficticios, fuente y período, visible en todas las pantallas.
import { useApp } from '../contexto.jsx';
import { etiquetaPeriodo, fechaCorte } from '../formato.js';

export default function FranjaAviso() {
  const { meta, fecha } = useApp();
  return (
    <div className="franja-aviso" role="note" aria-label="Aviso sobre los datos">
      <span className="franja-etiqueta">Datos ficticios</span>
      <span className="franja-texto">
        <strong>Fuente:</strong> {meta?.fuente || 'Paquete Hackathon SBP 2026 · AT03 sintético'}
        <span className="separador" aria-hidden="true">·</span>
        <strong>Período:</strong> {fecha ? `${etiquetaPeriodo(fecha, meta)} (corte ${fechaCorte(fecha)})` : 'sin períodos cargados'}
      </span>
      <span className="franja-aviso-largo">
        {meta?.aviso || 'Datos 100 % ficticios con fines de demostración. No representan al sistema bancario panameño ni constituyen opinión formal de la SBP.'}
      </span>
    </div>
  );
}
