// Catálogos de referencia (solo lectura: el catálogo del reto está congelado).
import { useMemo, useState } from 'react';
import { api } from '../../api.js';
import { useDatos } from '../../contexto.jsx';
import { Carga } from '../../componentes/Estados.jsx';
import { EncabezadoPagina, Insignia, Pestanas, Tarjeta } from '../../componentes/Comunes.jsx';
import TablaOrdenable from '../../componentes/TablaOrdenable.jsx';

const TABLAS = {
  cinu: {
    titulo: 'Catálogo CINU / SB109', nota: '22 actividades → 6 macroactividades (rankings) y 22 subactividades. La llave es Codigo_CINU.',
    columnas: [
      { clave: 'codigo', titulo: 'Código CINU', render: (f) => <span className="mono">{f.codigo}</span> },
      { clave: 'descripcion', titulo: 'Descripción' },
      { clave: 'macroactividad', titulo: 'Macroactividad (ranking)' },
      { clave: 'subactividad', titulo: 'Subactividad' },
      { clave: 'sb08', titulo: 'SB08 (solo referencia)', render: (f) => <span className="mono">{f.sb08}</span> },
    ],
  },
  sb21: {
    titulo: 'Tabla SB21 · Facilidades crediticias', nota: 'Solo interviene en la regla especial de Consumo (07 = tarjeta de crédito, 03 = préstamo de auto).',
    columnas: [
      { clave: 'codigo', titulo: 'Código', render: (f) => <span className="mono">{f.codigo}</span> },
      { clave: 'descripcion', titulo: 'Descripción' },
      { clave: 'uso', titulo: 'Uso en el reto' },
    ],
  },
  bancos: {
    titulo: 'Bancos ficticios', nota: '12 bancos de licencia general. Cada ranking los incluye siempre a todos.',
    columnas: [
      { clave: 'codigo', titulo: 'Código', render: (f) => <span className="mono">{f.codigo}</span> },
      { clave: 'nombre', titulo: 'Nombre' },
      { clave: 'licencia', titulo: 'Licencia' },
    ],
  },
};

export default function Catalogos() {
  const [tabla, setTabla] = useState('cinu');
  const [busqueda, setBusqueda] = useState('');
  const estado = useDatos(() => api.catalogos(), []);
  const def = TABLAS[tabla];

  return (
    <>
      <EncabezadoPagina titulo="Catálogos" subtitulo="Referencias oficiales del reto usadas para validar y clasificar" />
      <Pestanas
        etiqueta="Catálogo" valor={tabla} alCambiar={(v) => { setTabla(v); setBusqueda(''); }}
        opciones={Object.entries(TABLAS).map(([k, t]) => ({ valor: k, texto: t.titulo }))}
      />
      <Carga estado={estado} filas={8}>
        {(cat) => (
          <TablaCatalogo filas={cat[tabla] || []} def={def} busqueda={busqueda} setBusqueda={setBusqueda} />
        )}
      </Carga>
    </>
  );
}

function TablaCatalogo({ filas, def, busqueda, setBusqueda }) {
  const visibles = useMemo(() => {
    const b = busqueda.trim().toLowerCase();
    if (!b) return filas;
    return filas.filter((f) => Object.values(f).some((v) => String(v).toLowerCase().includes(b)));
  }, [filas, busqueda]);
  return (
    <Tarjeta
      titulo={def.titulo} subtitulo={def.nota} id="tabla-catalogo"
      acciones={<><Insignia tono="info">Congelado · versión del reto</Insignia><input className="buscador" type="search" placeholder="Buscar…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar en el catálogo" /></>}
    >
      <TablaOrdenable etiqueta={def.titulo} columnas={def.columnas} filas={visibles} claveFila={(f) => f.codigo} />
      <p className="nota">{visibles.length} de {filas.length} registros. Para cambiar un catálogo se reemplaza el archivo en datos/ y se reinicia; la app nunca lo modifica.</p>
    </Tarjeta>
  );
}
