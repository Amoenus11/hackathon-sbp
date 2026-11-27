// Perfiles y permisos: qué puede hacer cada perfil (lámina 6). El servidor aplica la misma matriz.
import { CAPACIDADES, PERFILES, puede } from '../../permisos.js';
import { EncabezadoPagina, Tarjeta } from '../../componentes/Comunes.jsx';

const IDS = ['publico', 'analista', 'administrador'];

export default function Perfiles() {
  return (
    <>
      <EncabezadoPagina titulo="Perfiles y permisos" subtitulo="Cada perfil ve opciones distintas; el servidor rechaza lo que el perfil no permite" />
      <Tarjeta titulo="Matriz de permisos" id="matriz-permisos">
        <div className="tabla-envoltura">
          <table className="tabla tabla-permisos">
            <thead>
              <tr>
                <th scope="col">Capacidad</th>
                {IDS.map((id) => (
                  <th key={id} scope="col" className="centrada">
                    {PERFILES[id].nombre}<br /><span className="nota">{PERFILES[id].descripcion}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPACIDADES.map((c) => (
                <tr key={c.texto}>
                  <th scope="row">{c.texto}</th>
                  {IDS.map((id) => (
                    <td key={id} className="centrada">
                      {puede(id, c.minimo)
                        ? <span className="si" aria-label="Sí">✓</span>
                        : <span className="no" aria-label="No">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Cuentas" id="cuentas">
        <ul className="lista-simple">
          <li><strong>Público</strong>: no necesita cuenta; es lo que ve cualquier persona.</li>
          <li><strong>Analista</strong> y <strong>Administrador</strong>: usuario y contraseña creados al instalar con <code>npm run configurar</code> (se guardan en <code>.env</code>, que no se sube al repositorio).</li>
          <li>La sesión usa una cookie protegida (HttpOnly) y cada cambio queda en el registro de operaciones.</li>
        </ul>
      </Tarjeta>
    </>
  );
}
