// Estados comunes: cargando (esqueleto), vacío y error, con mensajes claros.

export function Esqueleto({ filas = 4, alto }) {
  return (
    <div className="esqueleto" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="esqueleto-linea" style={alto ? { height: alto } : undefined} />
      ))}
    </div>
  );
}

export function EstadoError({ error, alReintentar, titulo = 'No se pudieron cargar los datos' }) {
  return (
    <div className="estado estado-error" role="alert">
      <div className="estado-icono" aria-hidden="true">!</div>
      <h2>{titulo}</h2>
      <p>{error?.message || String(error || 'Error desconocido')}</p>
      {alReintentar && (
        <button type="button" className="boton boton-secundario" onClick={alReintentar}>Reintentar</button>
      )}
    </div>
  );
}

export function EstadoVacio({ titulo, children }) {
  return (
    <div className="estado estado-vacio">
      <div className="estado-icono" aria-hidden="true">○</div>
      <h2>{titulo}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

// Envuelve una carga: muestra esqueleto, error o el contenido
export function Carga({ estado, filas = 4, children }) {
  if (estado.cargando && !estado.datos) return <Esqueleto filas={filas} />;
  if (estado.error) return <EstadoError error={estado.error} alReintentar={estado.recargar} />;
  if (!estado.datos) return <Esqueleto filas={filas} />;
  return children(estado.datos);
}
