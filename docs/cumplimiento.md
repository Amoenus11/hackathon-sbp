# Cumplimiento de la rúbrica (Sección 11): 100 / 100

Cada criterio con su evidencia en la app (https://syntropy.com.pa) y en el código.

| # | Criterio (puntos) | Cómo lo cumplimos | Dónde verlo |
| --- | --- | --- | --- |
| 1 | **Exactitud (25)** | Cascada E1–E4, 6 rankings × 12 bancos, ponderación con el denominador correcto, desglose con SB21, reconciliaciones R1–R3 (+R4) al centavo en los 3 períodos. Doble implementación independiente: **0 diferencias** en las 5 exportaciones. | *Calidad de datos*, *Rankings* (columna Cartera total y Ponderación; clic en banco = desglose), *Exportaciones oficiales*; `verificacion/`, `docs/guia-jurado.md` |
| 2 | **Funcionalidad (15)** | Los 5 módulos: Panel, Rankings, filtros (período, banco, ranking, subactividad), gráficos interactivos y tablas ordenables, Reportes y exportaciones 2–5. 3 perfiles con opciones distintas, validados en el servidor. | Menú por perfil; *Perfiles y permisos* (matriz + usuarios y roles) |
| 3 | **Automatización (15)** | Las 6 de la lámina 8: cargar un período (CSV o Excel) y recalcular solo (< 2 s), comparar dos períodos, movimientos con regla configurable, explicación automática con el porqué (anatomía del cambio), variaciones por reglas, reporte descargable. | *Cargar período*, *Comparar*, *Parámetros*, *Reportes* |
| 4 | **Usabilidad (15)** | Navegación clara por perfil (menú plegable, presentación guiada), fuente/período/«datos ficticios» siempre visibles, mensajes claros ante archivos inválidos (columnas que faltan y sugerencias), bitácora de conversión de Excel. | Etiqueta «Datos ficticios» en la cabecera; *Cargar período*; demo.syntropy.com.pa |
| 5 | **Calidad técnica (10)** | React + Node.js + JavaScript (lámina 7), ejecución local (`npm start`), código organizado (`motor/`, `servidor/`, `web/`), **36 pruebas automáticas**, control de acceso por perfil, resultados reproducibles, README completo, sin credenciales en el repositorio. | `README.md`, `pruebas/`, `npm test` |
| 6 | **Innovación (10)** | Anatomía del cambio («No prestó menos: le vencieron más»), R4 puente entre meses, Semáforo de publicación con firma, Carta al banco, Descarga a tu medida (pedido del stakeholder), IA aislada que explica según la pantalla, morosidad según el Acuerdo 4-2013, Excel que se repara solo. | *Rankings → banco*, *Preparar publicación*, *Carta al banco*, *Descarga a tu medida*, chat IA |
| 7 | **Presentación (10)** | Pitch de 8 diapositivas en la propia app con cifras en vivo + presentación guiada animada; los 3 integrantes explican el código (R6). | https://syntropy.com.pa/pitch, *Equipo Syntropy* (clic en «SYNTROPY»), `docs/guia-jurado.md` |

## Requisitos mínimos (11.2) — ninguno resta
| Requisito | Estado |
| --- | --- |
| R1 Ejecución local | ✓ `npm install && npm run configurar && npm start` (también publicada) |
| R2 Nada fijado a mano | ✓ todo se recalcula desde `datos/reto/`; las cifras de las pruebas se calculan, no se copian |
| R3 Solo catálogos | ✓ `Tipo_Actividad = Codigo_CINU`; nunca datos del cliente |
| R4 Repositorio y README | ✓ código, README con instalación, ejecución, arquitectura y reglas |
| R5 Sin credenciales | ✓ ni contraseñas ni tokens en git: las cuentas viven en el servidor (huellas scrypt, fuera del repositorio); las pruebas generan claves al azar |
| R6 Los tres explican | ✓ guía de preguntas en `docs/guia-jurado.md` y en la página del equipo |

## Lista final antes de presentar
- [ ] Entrar como administrador y dejar septiembre 2026.
- [ ] Repasar `docs/guia-jurado.md` (dónde mostrar cada dato) y `docs/stakeholders.md`.
- [ ] Ensayar /pitch → «Ver en vivo» → presentación guiada.
- [ ] Repositorio accesible para el jurado (hacerlo público o invitar al jurado).
