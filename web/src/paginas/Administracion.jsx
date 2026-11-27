// Administración (perfil administrador): cargar períodos, parámetros, catálogos, perfiles y registro.
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../contexto.jsx';
import { api, useApi } from '../api.js';
import { Aviso, Cargando, Tabla, Tarjeta } from '../componentes/Comunes.jsx';
import { fechaHora, mes, numero } from '../formato.js';

const PESTANAS = [
  { id: 'cargar', texto: 'Cargar período' },
  { id: 'parametros', texto: 'Parámetros' },
  { id: 'catalogos', texto: 'Catálogos' },
  { id: 'perfiles', texto: 'Perfiles y permisos' },
  { id: 'registro', texto: 'Registro de operaciones' },
];

export default function Administracion() {
  const [pestana, setPestana] = useState('cargar');
  return (
    <>
      <div className="titulo-pagina">
        <h1>Administración</h1>
        <p>Cargue o actualice períodos, ajuste parámetros y consulte catálogos y el registro de operaciones. Cada cambio queda registrado.</p>
      </div>
      <div className="pestanas" role="tablist" aria-label="Administración">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} className={pestana === p.id ? 'activa' : ''} onClick={() => setPestana(p.id)}>{p.texto}</button>
        ))}
      </div>
      {pestana === 'cargar' && <Cargar />}
      {pestana === 'parametros' && <Parametros />}
      {pestana === 'catalogos' && <Catalogos />}
      {pestana === 'perfiles' && <Perfiles />}
      {pestana === 'registro' && <Registro />}
    </>
  );
}

function Cargar() {
  const { meta, cargarMeta, setFecha } = useApp();
  const [archivo, setArchivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [arrastre, setArrastre] = useState(false);
  const input = useRef(null);

  const procesar = async () => {
    if (!archivo) return;
    setEnviando(true); setError(null); setResultado(null);
    const form = new FormData();
    form.append('archivo', archivo);
    try {
      const r = await api('/periodos', { metodo: 'POST', form });
      setResultado(r);
      await cargarMeta();
      setFecha(r.procesados.at(-1)?.fecha);
      setArchivo(null);
      if (input.current) input.current.value = '';
    } catch (e) {
      setError(e);
    } finally {
      setEnviando(false);
    }
  };

  const quitar = async (fecha) => {
    if (!window.confirm(`¿Quitar el período ${mes(fecha)} de la plataforma? Podrá volver a cargarlo con su archivo AT03.`)) return;
    try {
      await api(`/periodos/${fecha}`, { metodo: 'DELETE' });
      setResultado(null);
      await cargarMeta();
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="dos-columnas">
      <Tarjeta titulo="Cargar un nuevo período" subtitulo="Archivo AT03 en CSV (UTF-8, 61 columnas). El sistema lo valida, aplica las reglas, recalcula los rankings y compara con el mes anterior sin editar código.">
        <div
          className={`zona-archivo ${arrastre ? 'arrastrando' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setArrastre(true); }}
          onDragLeave={() => setArrastre(false)}
          onDrop={(e) => { e.preventDefault(); setArrastre(false); setArchivo(e.dataTransfer.files[0] ?? null); }}
        >
          <p>Arrastre aquí el archivo o</p>
          <label className="boton secundario">
            Elegir archivo…
            <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => setArchivo(e.target.files[0] ?? null)} />
          </label>
          {archivo && <p><b>{archivo.name}</b> · {(archivo.size / 1e6).toFixed(1)} MB</p>}
        </div>
        <div className="fila-botones">
          <button type="button" className="boton" onClick={procesar} disabled={!archivo || enviando}>{enviando ? 'Procesando…' : 'Procesar y publicar'}</button>
        </div>
        <Aviso error={error} />
        {resultado && (
          <div className="alerta exito" role="status">
            <p><b>✔ Período{resultado.procesados.length > 1 ? 's' : ''} {resultado.reemplazo ? 'actualizado' : 'cargado'}:</b> {resultado.procesados.map((p) => `${mes(p.fecha)} (${numero(p.filas_leidas)} filas leídas, ${numero(p.universo)} válidas${p.cuadra ? ', cuadra' : ''})`).join(' · ')}</p>
            <p>Movimientos significativos detectados frente al mes anterior: <b>{resultado.movimientos_significativos}</b></p>
            {resultado.explicaciones.length > 0 && <ul>{resultado.explicaciones.map((e) => <li key={e}>{e}</li>)}</ul>}
          </div>
        )}
      </Tarjeta>
      <Tarjeta titulo="Períodos publicados" subtitulo="Quitar un período sirve para repetir la demostración de carga. Los archivos originales no se borran.">
        <Tabla compacta claveFila={(f) => f.fecha} columnas={[
          { clave: 'fecha', titulo: 'Período', render: (f) => mes(f.fecha) },
          { clave: 'archivo', titulo: 'Archivo' },
          { clave: 'filas_leidas', titulo: 'Filas', num: true, render: (f) => numero(f.filas_leidas) },
          { clave: 'cargado', titulo: 'Procesado', render: (f) => fechaHora(f.cargado) },
          { clave: 'accion', titulo: '', render: (f) => <button type="button" className="boton peligro chico" onClick={() => quitar(f.fecha)}>Quitar</button> },
        ]} filas={meta.periodos} vacia="No hay períodos publicados." />
      </Tarjeta>
    </div>
  );
}

function Parametros() {
  const { cargarMeta } = useApp();
  const actual = useApi('/parametros');
  const [form, setForm] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { if (actual.datos) setForm(actual.datos); }, [actual.datos]);
  if (actual.error) return <Aviso error={actual.error} />;
  if (!form) return <Cargando />;
  const guardar = async (e) => {
    e.preventDefault();
    setError(null); setMensaje(null);
    try {
      const p = await api('/parametros', { metodo: 'PUT', cuerpo: form });
      setForm(p);
      setMensaje('Parámetros guardados. Los movimientos se recalcularon con la nueva regla.');
      cargarMeta();
    } catch (err) {
      setError(err);
    }
  };
  return (
    <Tarjeta titulo="Regla de movimiento significativo" subtitulo="Un movimiento es significativo si cumple al menos una condición. Se aplica a comparaciones, explicaciones, panel y exportaciones.">
      <form className="formulario angosto" onSubmit={guardar}>
        <label className="campo" htmlFor="p-pos"><span>Cambio mínimo de posiciones (|Cambio_Posicion| ≥)</span>
          <input id="p-pos" type="number" min={1} max={11} value={form.mov_min_posiciones} onChange={(e) => setForm({ ...form, mov_min_posiciones: Number(e.target.value) })} />
        </label>
        <label className="campo" htmlFor="p-pct"><span>Variación mínima de saldo (%)</span>
          <input id="p-pct" type="text" inputMode="decimal" value={form.mov_var_saldo_pct} onChange={(e) => setForm({ ...form, mov_var_saldo_pct: e.target.value })} />
        </label>
        <label className="interruptor"><input type="checkbox" checked={form.mov_cambio_lider} onChange={(e) => setForm({ ...form, mov_cambio_lider: e.target.checked })} /> Un cambio de líder siempre es significativo</label>
        <div className="fila-botones"><button type="submit" className="boton">Guardar</button></div>
        <Aviso error={error} />
        {mensaje && <Aviso tipo="exito">{mensaje}</Aviso>}
      </form>
    </Tarjeta>
  );
}

function Catalogos() {
  const cat = useApi('/catalogos');
  if (cat.error) return <Aviso error={cat.error} />;
  if (!cat.datos) return <Cargando />;
  return (
    <>
      <Aviso tipo="info">El catálogo CINU/SB109 del reto está congelado: es la única versión válida y no se edita desde la plataforma.</Aviso>
      <Tarjeta titulo={`Catálogo CINU/SB109 (${cat.datos.cinu.length} actividades)`}>
        <Tabla compacta claveFila={(f) => f.codigo} columnas={[
          { clave: 'codigo', titulo: 'Código CINU' }, { clave: 'descripcion', titulo: 'Descripción' },
          { clave: 'macroactividad', titulo: 'Macroactividad' }, { clave: 'subactividad', titulo: 'Subactividad' }, { clave: 'sb08', titulo: 'SB08 (referencia)' },
        ]} filas={cat.datos.cinu} />
      </Tarjeta>
      <div className="dos-columnas">
        <Tarjeta titulo="Tabla SB21 (facilidades)">
          <Tabla compacta claveFila={(f) => f.codigo} columnas={[{ clave: 'codigo', titulo: 'Código' }, { clave: 'descripcion', titulo: 'Descripción' }, { clave: 'uso', titulo: 'Uso en el reto' }]} filas={cat.datos.sb21} />
        </Tarjeta>
        <Tarjeta titulo="Bancos (ficticios)">
          <Tabla compacta claveFila={(f) => f.codigo} columnas={[{ clave: 'codigo', titulo: 'Código' }, { clave: 'nombre', titulo: 'Nombre' }, { clave: 'licencia', titulo: 'Licencia' }]} filas={cat.datos.bancos} />
        </Tarjeta>
      </div>
    </>
  );
}

const MODULOS = ['panel', 'rankings', 'metodologia', 'descargas', 'comparar', 'calidad', 'reportes', 'asistente', 'cargar', 'parametros', 'catalogos', 'perfiles', 'registro'];

function Perfiles() {
  const u = useApi('/usuarios');
  if (u.error) return <Aviso error={u.error} />;
  if (!u.datos) return <Cargando />;
  const perfiles = Object.keys(u.datos.permisos);
  return (
    <div className="dos-columnas">
      <Tarjeta titulo="Permisos por perfil" subtitulo="Cada perfil ve solo sus opciones. El servidor también exige el perfil en cada ruta.">
        <Tabla compacta claveFila={(f) => f.modulo} columnas={[
          { clave: 'modulo', titulo: 'Módulo' },
          ...perfiles.map((p) => ({ clave: p, titulo: p, render: (f) => (f[p] ? '✔' : '—') })),
        ]} filas={MODULOS.map((m) => ({ modulo: m, ...Object.fromEntries(perfiles.map((p) => [p, u.datos.permisos[p].includes(m)])) }))} />
      </Tarjeta>
      <Tarjeta titulo="Usuarios" subtitulo="Se crean al instalar con `npm run configurar` (contraseñas fuera del repositorio, guardadas como huella scrypt). El perfil público no necesita usuario.">
        <Tabla compacta claveFila={(f) => f.usuario} columnas={[{ clave: 'usuario', titulo: 'Usuario' }, { clave: 'perfil', titulo: 'Perfil' }]} filas={u.datos.usuarios} />
      </Tarjeta>
    </div>
  );
}

function Registro() {
  const r = useApi('/registro');
  if (r.error) return <Aviso error={r.error} />;
  if (!r.datos) return <Cargando />;
  return (
    <Tarjeta titulo="Registro de operaciones" subtitulo="Cargas, cambios de parámetros, descargas, inicios de sesión y consultas a la IA (las más recientes primero)." acciones={<button type="button" className="boton secundario chico" onClick={r.recargar}>Actualizar</button>}>
      <Tabla compacta claveFila={(f) => `${f.cuando}-${f.accion}-${f.detalle}`} columnas={[
        { clave: 'cuando', titulo: 'Cuándo', render: (f) => fechaHora(f.cuando) },
        { clave: 'usuario', titulo: 'Usuario', render: (f) => f.usuario ?? 'público' },
        { clave: 'perfil', titulo: 'Perfil' },
        { clave: 'accion', titulo: 'Acción' },
        { clave: 'detalle', titulo: 'Detalle' },
      ]} filas={r.datos} vacia="Todavía no hay operaciones registradas." />
    </Tarjeta>
  );
}
