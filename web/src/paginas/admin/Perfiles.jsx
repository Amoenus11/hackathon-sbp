// Perfiles y permisos: qué puede hacer cada perfil (lámina 6). El servidor aplica la misma matriz.
import { CAPACIDADES, PERFILES, puede } from '../../permisos.js';
import { useState } from 'react';
import { EncabezadoPagina, Tarjeta } from '../../componentes/Comunes.jsx';
import { api } from '../../api.js';
import { useDatos } from '../../contexto.jsx';

// Usuarios y roles: el administrador cambia el perfil de cada cuenta (queda en el registro)
function UsuariosRoles() {
  const [version, setVersion] = useState(0);
  const estado = useDatos(() => api.usuarios(), [version]);
  const [mensaje, setMensaje] = useState(null);
  async function cambiar(u, perfil) {
    if (!window.confirm(`¿Cambiar a ${u.nombre} al perfil ${PERFILES[perfil].nombre}?`)) return;
    try { await api.cambiarPerfil(u.usuario, perfil); setMensaje({ ok: true, texto: `${u.nombre} ahora es ${PERFILES[perfil].nombre}. Queda en el registro de operaciones.` }); setVersion((v) => v + 1); }
    catch (e) { setMensaje({ ok: false, texto: e.message }); }
  }
  const lista = estado.datos || [];
  return (
    <Tarjeta titulo="Usuarios y roles" subtitulo="Cambia el perfil de cada cuenta. Siempre debe quedar al menos un administrador." id="usuarios-roles">
      {mensaje && <p className={mensaje.ok ? 'mensaje-exito' : 'mensaje-error'}>{mensaje.texto}</p>}
      {estado.error && <p className="mensaje-error">{estado.error.message}</p>}
      <table className="tabla tabla-compacta">
        <thead><tr><th scope="col">Usuario</th><th scope="col">Perfil</th></tr></thead>
        <tbody>
          {lista.map((u) => (
            <tr key={u.usuario}>
              <td><strong>{u.nombre}</strong> <span className="nota">{u.usuario}{u.soy_yo ? ' · tú' : ''}</span></td>
              <td>
                <select value={u.perfil} onChange={(e) => cambiar(u, e.target.value)} aria-label={`Perfil de ${u.nombre}`}>
                  <option value="analista">Analista</option>
                  <option value="administrador">Administrador</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  );
}

const IDS = ['publico', 'analista', 'administrador'];

export default function Perfiles() {
  return (
    <>
      <EncabezadoPagina titulo="Perfiles y permisos" subtitulo="Quién tiene qué perfil y qué puede hacer cada uno; el servidor rechaza lo que el perfil no permite" />
      <UsuariosRoles />
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
