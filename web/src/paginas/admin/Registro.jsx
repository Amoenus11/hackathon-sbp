// Registro básico de operaciones: quién hizo qué y cuándo (cargas, parámetros, sesiones).
import { api } from '../../api.js';
import { useDatos } from '../../contexto.jsx';
import { Carga } from '../../componentes/Estados.jsx';
import { EncabezadoPagina, Tarjeta } from '../../componentes/Comunes.jsx';
import TablaOrdenable from '../../componentes/TablaOrdenable.jsx';
import { PERFILES } from '../../permisos.js';
import { fechaHora } from '../../formato.js';

const ACCIONES = {
  cargar_periodo: 'Cargó un período',
  quitar_periodo: 'Quitó un período',
  parametros: 'Cambió parámetros',
  iniciar_sesion: 'Inició sesión',
  cerrar_sesion: 'Cerró sesión',
  sesion_fallida: 'Intento de sesión fallido',
  exportar: 'Descargó un CSV',
  inicio: 'Arranque del sistema',
  actualizar_periodo: 'Actualizó un período',
  carga_rechazada: 'Intento de carga rechazado',
  consulta_ia: 'Consultó al asistente IA',
  revelar_contrasena: 'Recibió su contraseña (enlace de un solo uso)',
};

export default function Registro() {
  const estado = useDatos(() => api.registro(), []);
  return (
    <>
      <EncabezadoPagina titulo="Registro de operaciones" subtitulo="Qué archivo se cargó y cuándo, cambios de parámetros y sesiones">
        <button type="button" className="boton boton-secundario boton-chico" onClick={estado.recargar}>Actualizar</button>
      </EncabezadoPagina>
      <Carga estado={estado} filas={8}>
        {(filas) => (
          <Tarjeta titulo={`${filas.length} operaciones`} id="registro">
            <TablaOrdenable
              etiqueta="Registro de operaciones" filas={filas.map((f, i) => ({ ...f, n: i }))} claveFila={(f) => f.n}
              ordenInicial={{ clave: 'cuando', asc: false }}
              columnas={[
                { clave: 'cuando', titulo: 'Cuándo (hora de Panamá)', valor: (f) => f.cuando, render: (f) => fechaHora(f.cuando) },
                { clave: 'usuario', titulo: 'Usuario', render: (f) => f.usuario || '—' },
                { clave: 'perfil', titulo: 'Perfil', render: (f) => PERFILES[f.perfil]?.nombre || f.perfil || '—' },
                { clave: 'accion', titulo: 'Acción', render: (f) => ACCIONES[f.accion] || f.accion },
                { clave: 'detalle', titulo: 'Detalle' },
              ]}
            />
          </Tarjeta>
        )}
      </Carga>
    </>
  );
}
