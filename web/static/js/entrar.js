import { api } from './comun.js';
const f = document.getElementById('formulario');
const err = document.getElementById('error');
const boton = document.getElementById('boton');
f.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.textContent = '';
  boton.disabled = true;
  try {
    await api('/api/entrar', { method: 'POST', json: {
      usuario: document.getElementById('usuario').value, clave: document.getElementById('clave').value } });
    location.href = '/';
  } catch (x) {
    err.textContent = x.message;
    boton.disabled = false;
  }
});
