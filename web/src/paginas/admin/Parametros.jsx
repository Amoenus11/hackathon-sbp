// Parámetros: la regla configurable de «movimiento significativo» (sección 8 del reto).
import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useApp, useDatos } from '../../contexto.jsx';
import { Carga } from '../../componentes/Estados.jsx';
import { Campo, EncabezadoPagina, Tarjeta } from '../../componentes/Comunes.jsx';

export default function Parametros() {
  const { recargarMeta } = useApp();
  const estado = useDatos(() => api.parametros(), []);
  return (
    <>
      <EncabezadoPagina titulo="Parámetros" subtitulo="Reglas que el administrador puede ajustar sin tocar el código" />
      <Carga estado={estado} filas={4}>
        {(p) => <Formulario inicial={p} alGuardar={recargarMeta} />}
      </Carga>
    </>
  );
}

function Formulario({ inicial, alGuardar }) {
  const [valores, setValores] = useState(inicial);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setValores(inicial), [inicial]);

  async function guardar(e) {
    e.preventDefault();
    setMensaje('');
    setError('');
    const minimo = Number(valores.mov_min_posiciones);
    const variacionPct = Number(valores.mov_var_saldo_pct);
    if (!Number.isInteger(minimo) || minimo < 1 || minimo > 11) { setError('Las posiciones deben ser un número entero entre 1 y 11.'); return; }
    if (!Number.isFinite(variacionPct) || variacionPct < 0) { setError('La variación de saldo debe ser un número mayor o igual a 0.'); return; }
    setGuardando(true);
    try {
      const guardado = await api.guardarParametros({
        mov_min_posiciones: minimo,
        mov_cambio_lider: !!valores.mov_cambio_lider,
        mov_var_saldo_pct: variacionPct.toFixed(2),
      });
      setValores(guardado || valores);
      setMensaje('Guardado. Los movimientos y explicaciones ya usan la nueva regla.');
      alGuardar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rejilla-dos">
      <Tarjeta titulo="Movimiento significativo" subtitulo="Un banco se marca si cumple cualquiera de estas condiciones entre dos períodos" id="regla">
        <form className="formulario" onSubmit={guardar}>
          <Campo etiqueta="Sube o baja al menos (posiciones)">
            <input type="number" min={1} max={11} step={1} value={valores.mov_min_posiciones} onChange={(e) => setValores({ ...valores, mov_min_posiciones: e.target.value })} />
          </Campo>
          <label className="casilla">
            <input type="checkbox" checked={!!valores.mov_cambio_lider} onChange={(e) => setValores({ ...valores, mov_cambio_lider: e.target.checked })} />
            Marcar siempre un cambio de líder (nuevo 1.er lugar)
          </label>
          <Campo etiqueta="Variación de saldo mayor a (%)">
            <input type="number" min={0} step={0.5} value={valores.mov_var_saldo_pct} onChange={(e) => setValores({ ...valores, mov_var_saldo_pct: e.target.value })} />
          </Campo>
          {error && <p className="mensaje-error" role="alert">{error}</p>}
          {mensaje && <p className="mensaje-exito" role="status">{mensaje}</p>}
          <button type="submit" className="boton boton-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar regla'}</button>
        </form>
      </Tarjeta>
      <Tarjeta titulo="Cómo se lee" id="como-se-lee">
        <p>
          Con la regla actual, un banco se considera con <strong>movimiento significativo</strong> si su posición cambia en{' '}
          <strong>{valores.mov_min_posiciones || '…'} o más lugares</strong>
          {valores.mov_cambio_lider ? <>, si <strong>pasa a ser (o deja de ser) el líder</strong></> : ''}, o si su saldo varía más de{' '}
          <strong>{valores.mov_var_saldo_pct || '…'} %</strong> respecto al período anterior.
        </p>
        <p className="nota">
          Cambio de posición = posición anterior − posición actual (positivo = sube). La regla se aplica a los 6 rankings y queda
          registrada en el registro de operaciones cada vez que se cambia.
        </p>
      </Tarjeta>
    </div>
  );
}
