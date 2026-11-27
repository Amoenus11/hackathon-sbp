// Seis casillas para escribir un código de verificación (se puede pegar el código completo).
import { useRef } from 'react';

export default function CodigoSeis({ valor, alCambiar, deshabilitado }) {
  const casillas = useRef([]);
  const digitos = valor.padEnd(6, ' ').slice(0, 6).split('');

  function escribir(i, texto) {
    const limpio = texto.replace(/\D/g, '');
    if (!limpio) return;
    const nuevo = (valor.slice(0, i) + limpio).slice(0, 6);
    alCambiar(nuevo);
    casillas.current[Math.min(nuevo.length, 5)]?.focus();
  }

  function tecla(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const hasta = valor.length > i ? i : Math.max(0, i - 1);
      alCambiar(valor.slice(0, hasta));
      casillas.current[hasta]?.focus();
    }
  }

  return (
    <div className="pr-codigo" role="group" aria-label="Código de 6 dígitos">
      {digitos.map((d, i) => (
        <input
          key={i} ref={(el) => { casillas.current[i] = el; }}
          className="pr-codigo-casilla" inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={d.trim()} disabled={deshabilitado} aria-label={`Dígito ${i + 1}`}
          onChange={(e) => escribir(i, e.target.value)} onKeyDown={(e) => tecla(i, e)}
          onPaste={(e) => { e.preventDefault(); escribir(0, e.clipboardData.getData('text')); }}
          onFocus={(e) => e.target.select()} maxLength={6}
        />
      ))}
    </div>
  );
}

// Aviso de demostración: en la versión real el código llegaría a la app autenticadora.
export function AvisoCodigoDemo({ codigo }) {
  if (!codigo) return null;
  return (
    <p className="pr-aviso-demo">
      <strong>Modo demostración:</strong> tu código es <span className="pr-codigo-demo">{codigo}</span>
      <br /><span>En la versión real llegaría a tu app autenticadora (Google Authenticator, Microsoft Authenticator…).</span>
    </p>
  );
}
