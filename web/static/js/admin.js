import { api, el, salir } from './comun.js';
const $ = (id) => document.getElementById(id);
$('salir').addEventListener('click', salir);
const hora = (s) => s ? new Date(s).toLocaleString('es-PA', { timeZone: 'America/Panama', hour: '2-digit', minute: '2-digit', second: '2-digit', day: 'numeric', month: 'short' }) : '—';
function fila(celdas, tag = 'td') { const tr = el('tr'); celdas.forEach((c) => tr.append(c instanceof Node ? (() => { const t = el(tag); t.append(c); return t; })() : el(tag, null, c))); return tr; }

async function usuarios() {
  const us = await api('/api/admin/usuarios');
  const t = $('usuarios');
  t.replaceChildren(fila(['Usuario', 'Rol', 'Estado', 'Último acceso', ''], 'th'));
  for (const u of us) {
    const estado = el('span', u.activo ? 'estado-ok' : 'estado-no', u.bloqueado ? 'Bloqueado 15 min' : u.activo ? 'Activo' : (u.enlaces ? 'Enlace pendiente' : 'Sin contraseña'));
    const b = el('button', 'boton secundario chico', 'Nuevo enlace');
    b.type = 'button';
    b.addEventListener('click', async () => {
      if (!confirm(`¿Generar un enlace nuevo para ${u.nombre}? Su contraseña actual dejará de servir.`)) return;
      const r = await api('/api/admin/enlace', { method: 'POST', json: { usuario: u.usuario } });
      const caja = $('enlace');
      caja.replaceChildren(el('strong', null, `Enlace para ${u.nombre} (un solo uso, 24 h): `), el('code', null, r.enlace));
      const c = el('button', 'boton chico', 'Copiar'); c.type = 'button';
      c.addEventListener('click', () => navigator.clipboard.writeText(r.enlace).then(() => { c.textContent = 'Copiado ✓'; }));
      caja.append(' ', c);
      caja.classList.remove('oculto');
      usuarios();
    });
    t.append(fila([u.nombre, u.rol, estado, hora(u.ultimo_acceso), b]));
  }
}
async function auditoria() {
  const a = await api('/api/admin/auditoria');
  const t = $('auditoria');
  t.replaceChildren(fila(['Cuándo', 'Usuario', 'Acción', 'Detalle', 'IP'], 'th'));
  for (const x of a) t.append(fila([hora(x.cuando), x.usuario || '—', x.accion, el('span', 'detalle', JSON.stringify(x.detalle)), x.ip || '']));
}
usuarios(); auditoria();
setInterval(auditoria, 20000);
