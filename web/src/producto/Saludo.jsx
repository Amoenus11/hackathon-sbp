// Uso diario (modo producto): saludo, último corte y acceso directo para cargar el siguiente.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../contexto.jsx';
import { puede } from '../permisos.js';
import { etiquetaPeriodo, fechaHora } from '../formato.js';
import './producto.css';

function saludoSegunHora() {
  const h = Number(new Intl.DateTimeFormat('es-PA', { hour: 'numeric', hour12: false, timeZone: 'America/Panama' }).format(new Date()));
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function mesSiguiente(aaaammdd) {
  const a = Number(aaaammdd.slice(0, 4));
  const m = Number(aaaammdd.slice(4, 6));
  const sig = m === 12 ? `${a + 1}0101` : `${a}${String(m + 1).padStart(2, '0')}01`;
  return etiquetaPeriodo(sig).split(' ')[0];
}

export default function Saludo() {
  const { meta, sesion } = useApp();
  const [nombre, setNombre] = useState(null);
  useEffect(() => {
    api.cuentas().then((c) => setNombre(c.find((x) => x.usuario === sesion.usuario)?.nombre || null)).catch(() => {});
  }, [sesion.usuario]);
  const ultimo = meta?.periodos?.at(-1);
  if (!ultimo) return null;
  return (
    <section className="pr-saludo pr-aparece" aria-label="Resumen del día">
      <div>
        <h2>{saludoSegunHora()}, {(nombre || sesion.usuario || '').split(' ')[0]}.</h2>
        <p>Último corte: <strong>{ultimo.etiqueta}</strong> · cargado {fechaHora(ultimo.cargado)}</p>
      </div>
      {puede(sesion.perfil, 'administrador') && (
        <Link to="/admin/cargar" className="boton boton-primario">Cargar el corte de {mesSiguiente(ultimo.fecha)}</Link>
      )}
    </section>
  );
}
