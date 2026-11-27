import { Link } from 'react-router-dom';

export default function NoEncontrada() {
  return (
    <section className="estado">
      <div className="estado-icono" aria-hidden="true">?</div>
      <h1>Esta página no existe</h1>
      <p>Revisa la dirección o vuelve al panel principal.</p>
      <Link to="/" className="boton boton-primario">Ir al panel</Link>
    </section>
  );
}
