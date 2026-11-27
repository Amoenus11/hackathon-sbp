import { useApp } from '../contexto.jsx';

export default function Pie() {
  const { meta } = useApp();
  return (
    <footer className="pie">
      <p>
        <strong>Uso informativo; no constituye opinión formal de la SBP.</strong> Datos 100 % ficticios
        {meta?.fuente ? ` · Fuente: ${meta.fuente}` : ''}.
      </p>
      <p className="pie-equipo">
        Syntropy · Hackathon SBP 2026 · «Del caos de datos al orden de las decisiones»
        {meta?.version_motor ? ` · Motor de cálculo v${meta.version_motor}` : ''}
        {' · '}<a href="https://github.com/Amoenus11/hackathon-sbp" target="_blank" rel="noopener noreferrer">Código fuente en GitHub ↗</a>
      </p>
    </footer>
  );
}
