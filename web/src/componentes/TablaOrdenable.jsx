// Tabla que se ordena al hacer clic en los encabezados (requisito: «tablas ordenables»).
// columnas: [{ clave, titulo, valor: fila => número|texto (para ordenar), render: fila => nodo, numerica }]
import { useMemo, useState } from 'react';

export default function TablaOrdenable({
  columnas, filas, ordenInicial, claveFila, alClicFila, filaResaltada, filaAtenuada, etiqueta, vacio = 'Sin datos.',
}) {
  const [orden, setOrden] = useState(ordenInicial || { clave: columnas[0].clave, asc: true });

  const ordenadas = useMemo(() => {
    const col = columnas.find((c) => c.clave === orden.clave);
    if (!col) return filas;
    const valor = col.valor || ((f) => f[col.clave]);
    return [...filas].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1; // vacíos siempre al final
      if (vb === null || vb === undefined) return -1;
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
      return orden.asc ? r : -r;
    });
  }, [filas, columnas, orden]);

  function ordenarPor(clave) {
    setOrden((o) => (o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: true }));
  }

  return (
    <div className="tabla-envoltura">
      <table className="tabla" aria-label={etiqueta}>
        <thead>
          <tr>
            {columnas.map((c) => {
              const activa = orden.clave === c.clave;
              return (
                <th
                  key={c.clave} scope="col" className={c.numerica ? 'numerica' : ''}
                  aria-sort={activa ? (orden.asc ? 'ascending' : 'descending') : 'none'}
                >
                  {c.ordenable === false ? c.titulo : (
                    <button type="button" className={`orden ${activa ? 'activa' : ''}`} onClick={() => ordenarPor(c.clave)}>
                      {c.titulo}
                      <span className="flecha-orden" aria-hidden="true">{activa ? (orden.asc ? '▲' : '▼') : '↕'}</span>
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.length === 0 && (
            <tr><td colSpan={columnas.length} className="celda-vacia">{vacio}</td></tr>
          )}
          {ordenadas.map((f, i) => {
            const clase = [
              alClicFila ? 'clicable' : '',
              filaResaltada?.(f) ? 'resaltada' : '',
              filaAtenuada?.(f) ? 'atenuada' : '',
            ].join(' ');
            return (
              <tr
                key={claveFila ? claveFila(f) : i} className={clase}
                onClick={alClicFila ? () => alClicFila(f) : undefined}
                onKeyDown={alClicFila ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alClicFila(f); } } : undefined}
                tabIndex={alClicFila ? 0 : undefined}
              >
                {columnas.map((c) => (
                  <td key={c.clave} className={c.numerica ? 'numerica num' : ''}>
                    {c.render ? c.render(f) : f[c.clave]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
