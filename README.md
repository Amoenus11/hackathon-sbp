# Syntropy · Hackatón SBP–FISC 2026

**Del caos de datos al orden de las decisiones.** Analista de datos con IA para stakeholders:
subes datos → la IA arma un panel ejecutivo → preguntas en lenguaje natural → cada cifra trae su evidencia
(SQL/Python) → informe ejecutivo en un clic.

En vivo: https://hackathon.syntropy.com.pa (con usuario y contraseña).

## Piezas

| Carpeta | Qué es |
| --- | --- |
| `web/` | FastAPI + páginas (HTML/JS sin frameworks, ECharts 6.1). Sesiones, usuarios, auditoría, subida de datos, panel, informe. |
| `asistente/` | **Claude Code sin pantalla** (Opus 5.5, esfuerzo bajo) en un contenedor aislado: sin internet, sin clave, sin root, datos en solo lectura. Analiza con Python, pandas y DuckDB. |
| `salida/` | Intermediario (Caddy): única salida del asistente; solo deja pasar la API de Anthropic y le añade la clave. |

Datos: PostgreSQL para operar (usuarios, sesiones, auditoría, paneles); Parquet + DuckDB para analizar.

## Seguridad

- Contraseñas con scrypt; Admin y SBP con contraseña aleatoria de ~143 bits que se entrega con un enlace de un solo uso;
  el equipo crea la suya (14+ caracteres, 3 tipos, sin palabras obvias). Bloqueo tras 5 fallos; límite por IP.
- Cookie `__Host-` HttpOnly, Secure, SameSite=Strict + cabecera anti-CSRF. CSP estricta (sin scripts en línea).
- Lo que escribe la IA se dibuja como texto, nunca como HTML.
- Cada acción queda en la auditoría (página Admin).

El despliegue vive en el repositorio de la plataforma (`apps/hackathon-sbp/compose.yml`).
