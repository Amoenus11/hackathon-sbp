import { api, tokenDelEnlace } from './comun.js';
const token = tokenDelEnlace();
const $ = (id) => document.getElementById(id);
if (!token) { $('error').textContent = 'Falta el código del enlace.'; $('mostrar').disabled = true; }
$('mostrar').addEventListener('click', async () => {
  $('mostrar').disabled = true;
  try {
    const r = await api('/api/revelar', { method: 'POST', json: { token } });
    $('usuario').textContent = r.usuario;
    $('clave').textContent = r.clave;
    $('antes').classList.add('oculto');
    $('despues').classList.remove('oculto');
  } catch (x) {
    $('error').textContent = x.message;
  }
});
$('copiar').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('clave').textContent); $('copiar').textContent = 'Copiada ✓'; }
  catch { $('copiar').textContent = 'Selecciónala y cópiala'; }
});
