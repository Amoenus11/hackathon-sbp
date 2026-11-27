// Arranque: node servidor/index.js  (o npm start, que antes compila la web).
import { leerEntorno } from './entorno.js';
import { crearApp } from './app.js';
import { usuariosDesdeEntorno } from './sesion.js';

const entorno = leerEntorno();
const puerto = Number(entorno.PUERTO || 3000);
const anfitrion = entorno.ANFITRION || '127.0.0.1';
const inicio = Date.now();
const { app, estado } = crearApp({ entorno });

function fallo(e) {
  console.error(e.code === 'EADDRINUSE'
    ? `\n  No se pudo iniciar: el puerto ${puerto} ya está en uso. Cierra el otro programa o define PUERTO con otro número.\n`
    : `\n  No se pudo iniciar el servidor: ${e.message}\n`);
  process.exit(1);
}

// Con Express 5 los errores de arranque llegan al callback (y al evento «error»): sin esto, un puerto ocupado
// imprimiría «listo» y terminaría en silencio.
const servidor = app.listen(puerto, anfitrion, (e) => {
  if (e) return fallo(e);
  const periodos = estado.lista().map((p) => `${p.fecha} (${p.universo} válidas de ${p.filas_leidas})`).join(', ');
  console.log(`\n  Syntropy · Observatorio de Crédito Bancario`);
  console.log(`  Períodos calculados en ${Date.now() - inicio} ms: ${periodos}`);
  if (!usuariosDesdeEntorno(entorno).size && !entorno.CUENTAS) console.log('  Aviso: no hay usuarios de analista ni administrador. Ejecuta «npm run configurar».');
  console.log(`  Abre http://localhost:${puerto}\n`);
});

servidor.on('error', fallo);
