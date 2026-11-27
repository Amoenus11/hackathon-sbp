import { api, tokenDelEnlace } from './comun.js';
const token = tokenDelEnlace();
const $ = (id) => document.getElementById(id);
const obvias = ['syntropy', 'sbp', 'fisc', 'utp', 'hackat', 'panama', 'password', 'contras', 'qwerty', 'asdf', '1234', 'abcd', 'admin'];
const normal = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
function revisar() {
  const c = $('clave').value, c2 = $('clave2').value;
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(c)).length;
  const ok = {
    largo: c.length >= 14,
    tipos: tipos >= 3 || c.length >= 20,
    obvias: c.length > 0 && !obvias.some((p) => normal(c).includes(p)),
    repite: c.length > 0 && !/(.)\1\1\1/.test(c),
    iguales: c.length > 0 && c === c2,
  };
  document.querySelectorAll('#reglas li').forEach((li) => li.classList.toggle('cumple', ok[li.dataset.r]));
  return Object.values(ok).every(Boolean);
}
$('clave').addEventListener('input', revisar);
$('clave2').addEventListener('input', revisar);
$('ver').addEventListener('click', () => {
  const t = $('clave').type === 'password' ? 'text' : 'password';
  $('clave').type = t; $('clave2').type = t;
  $('ver').textContent = t === 'password' ? 'Mostrar' : 'Ocultar';
});
$('sugerir').addEventListener('click', () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%+=?';
  const v = new Uint32Array(20); crypto.getRandomValues(v);
  let s = Array.from(v, (n) => a[n % a.length]).join('');
  s = s.slice(0, 5) + '-' + s.slice(5, 10) + '-' + s.slice(10, 15) + '-' + s.slice(15) + '7Q';
  $('clave').value = s; $('clave2').value = s;
  $('clave').type = 'text'; $('clave2').type = 'text'; $('ver').textContent = 'Ocultar';
  revisar();
});
if (!token) { $('error').textContent = 'Falta el código del enlace. Abre el enlace completo que te enviaron.'; $('boton').disabled = true; }
$('formulario').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('error').textContent = '';
  if (!revisar()) { $('error').textContent = 'Revisa las reglas marcadas en gris.'; return; }
  $('boton').disabled = true;
  try {
    const r = await api('/api/activar', { method: 'POST', json: { token, clave: $('clave').value } });
    $('usuario-oculto').value = r.usuario;
    $('formulario').classList.add('oculto');
    const l = $('listo');
    l.textContent = `Listo. Tu usuario es «${r.usuario}». Ya puedes entrar.`;
    l.classList.remove('oculto');
    setTimeout(() => { location.href = '/entrar'; }, 2500);
  } catch (x) {
    $('error').textContent = x.datos && x.datos.fallas ? x.datos.fallas.join(' ') : x.message;
    $('boton').disabled = false;
  }
});
