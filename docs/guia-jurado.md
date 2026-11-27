# Guía para la evaluación en vivo (Sección 11.1 y requisitos R1–R6)

El jurado pedirá **un dato de cada punto** y lo comparará con su clave oficial. Cada punto vale ~4 puntos,
**sin crédito parcial**: si no lo mostramos, cuenta como incorrecto. Aquí está **dónde** está cada dato en
https://syntropy.com.pa y un ejemplo para ensayar (todos salen del motor; la referencia en Python da lo mismo).

> Antes de empezar: entra como **administrador** (gui, nath o ani) y deja la app en **septiembre 2026**.
> El selector de período (arriba) cambia TODAS las pantallas. Las tablas se ordenan con un clic en el encabezado.

| # | Qué pedirán | Dónde mostrarlo | Ejemplo para ensayar (sep 2026) |
| --- | --- | --- | --- |
| 1 | Reporte de calidad: E1–E4 y universo local válido por período | **Calidad de datos** (embudo y ecuación) · o **Descargas → calidad.csv** | 30,000 leídas = 30 + 1,058 + 58 + 52 + **28,802** ✓ |
| 2 | Rankings obligatorios: posición y saldo | **Rankings** → pestañas Hipotecario, Construcción, Industria, Agropecuario | Construcción: 1.º Banco Regional (111) con 175,782,732.88 |
| 3 | COMERCIO y CONSUMO | **Rankings** → pestañas Comercio y Consumo | Comercio: 1.º Banco Solidez (112) con 92,783,903.16 |
| 4 | Total de cartera y ponderación (denominador correcto) | **Rankings** → columnas «Cartera total del banco» y «Ponderación»; clic en el banco muestra la fórmula | Banco Solidez, Hipotecario: 98,378,105.44 ÷ 528,292,037.06 × 100 = **18.6219 %** |
| 5 | Desglose por subactividad con la regla SB21 (Tarjeta) | **Rankings** → Consumo → clic en el banco (panel lateral) · o **Descargas → desglose.csv** | Banco Solidez, Consumo: Crédito personal 3,363,998.02 · Automóvil 5,540,604.07 · Tarjeta 3,352,616.76 |
| 6 | Los 3 períodos y las reconciliaciones R1 y R2 | Selector de período (julio, agosto, septiembre) · **Calidad de datos** → Reconciliaciones | R1, R2 y R3 ✓ en los 3 períodos |

## Lo que probarán en vivo
- **Público no puede cargar un período; Administrador sí:** sal de la sesión (Público): no aparece «Cargar período».
  Entra como administrador → **Cargar período** → sube `AT03_sintetico_202609.csv` (está en `datos/reto/` del repositorio).
  Para repetir la demostración: en esa misma pantalla, **Quitar** septiembre y volver a cargarlo.
- **Archivo inválido:** sube cualquier CSV que no sea AT03 → mensaje claro de qué falla; no se rompe nada.
- **Movimientos:** **Comparar** → agosto → septiembre: posiciones, saldos, regla configurable y explicación automática.
  La regla se cambia en **Parámetros** (administrador) y queda en el **Registro de operaciones**.

## Requisitos mínimos (R1–R6)
- **R1 Ejecución local:** `npm install && npm run configurar && npm start` (README, sección 1). También está publicada.
- **R2 Nada fijado a mano:** todo se recalcula desde `datos/reto/` al arrancar y al cargar (`motor/motor.js`).
- **R3 Solo catálogos:** `Tipo_Actividad = Codigo_CINU`; nunca nombres ni datos del cliente.
- **R4 README:** instalación, ejecución, arquitectura y reglas.
- **R5 Sin credenciales en el repositorio:** contraseñas solo como huella scrypt, fuera de git.
- **R6 Los tres explican:** repasen las 4 preguntas de la página **Equipo Syntropy** y estas:

| Pregunta probable | Respuesta corta |
| --- | --- |
| ¿Por qué React + Node? | Es la arquitectura pedida (lámina 7); el motor es JavaScript puro, sin dependencias, y lo usan la app, la línea de comandos y las pruebas. |
| ¿Cómo garantizan el orden de la cascada? | Cada fila pasa por E1→E2→E3→E4 y sale en el primer filtro que incumple; se comprueba que leídas = E1+E2+E3+E4+universo. |
| ¿Por qué un duplicado extranjero cuenta en E1? | E1 se aplica primero sobre TODAS las filas del período: la primera aparición se queda y las siguientes salen en E1. |
| ¿Cómo redondean la ponderación? | Con enteros: round(saldo × 10⁶ / total) / 10⁴, redondeo aritmético; por eso las 6 de un banco suman 100 ± 0.0006. |
| ¿Qué es «movimiento significativo»? | Configurable: |cambio| ≥ 2 posiciones, cambio de líder o |variación de saldo| ≥ 15 %. |
| ¿Qué hace la IA? | Explica resultados ya calculados y responde preguntas; está aislada, solo puede leer y nunca calcula rankings. |
| ¿Qué pasa si llega octubre? | El administrador lo carga: se valida, se calcula, se compara con septiembre y se explica, sin tocar el código. |
