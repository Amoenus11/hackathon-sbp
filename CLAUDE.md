# Syntropy · Observatorio de Crédito Bancario (Hackathon SBP 2026)

Contexto para cualquier sesión de Claude Code que trabaje en este repositorio (Gui, Nathalia, Aníbal o el
Claude del servidor). Responde siempre en **español**, claro y breve.

## El reto (léelo antes de proponer cambios)
- Indicaciones oficiales: `docs/INDICACIONES_RETO_RANKING_CREDITO.md` (prevalecen sobre todo) y la rúbrica de
  100 puntos en su Sección 11. Contrato web ↔ servidor: `docs/api.md`.
- Requisitos que restan puntos si se rompen:
  - **R2:** nunca escribir a mano saldos, porcentajes ni posiciones en el código; todo se calcula desde `datos/reto/`.
  - **R3:** clasificar solo con los catálogos (nunca con nombres ni datos del cliente).
  - **R5:** nada de contraseñas, tokens ni llaves en el repositorio (`.env` y `datos-locales/` están en `.gitignore`).
  - **R6:** los tres integrantes deben poder explicar el código: escribe código simple y comentado en español.
- La IA **solo explica** resultados ya calculados; **nunca** calcula rankings (Sección 9).

## Estructura
- `motor/`: el cálculo (JavaScript puro, sin dependencias, centavos en BigInt). Es lo que vale 25 puntos.
- `servidor/`: la API Express (perfiles, carga de períodos, exportaciones, registro, asistente IA).
- `web/`: React + Vite. Las páginas están en `web/src/paginas/`, los estilos globales en `web/src/estilos.css` y
  los permisos de cada perfil en `web/src/permisos.js` (el servidor aplica los mismos en `servidor/sesion.js`).
- `pruebas/`: `npm test` (node --test). `verificacion/`: la implementación de referencia en Python.
- `nube/`: lo que corre solo en internet (asistente aislado de solo lectura e intermediario).

## Antes de subir un cambio
1. `npm test` en verde (si tocas `motor/`, corre también la verificación de la Sección 6 del README:
   las 5 exportaciones deben salir **IDÉNTICAS** contra la referencia en Python).
2. `npm run build` sin errores.
3. Commits pequeños en español; `git pull --rebase` antes de `git push`; nunca `push --force`.
4. La versión en internet (https://syntropy.com.pa) la publica el Claude del servidor: avisa en el chat del equipo.

## Marca y diseño
Esencia Apple: mucho aire, tipografía grande y limpia, tarjetas blancas suaves, fondo `#f6f7fb`, tinta
`#0f172a`, acento turquesa `#0e7c86` → violeta `#5b4bdb` en degradado. Siempre visible: «DATOS FICTICIOS»,
la fuente y el período (lámina 9). Todo en español y comprensible para el perfil Público.
