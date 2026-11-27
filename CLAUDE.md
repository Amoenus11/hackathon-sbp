# Hackathon SBP 2026 — Rankings de crédito y análisis bancario

Fuentes de verdad: `docs/INDICACIONES_RETO_RANKING_CREDITO.md` (manda sobre todo) y `docs/Hackathon_SBP_2026.pptx` (13 láminas: producto, módulos, perfiles, arquitectura, evaluación). Si difieren, **prevalece el .md**.

## Objetivo
App web local (React + Node.js, JavaScript; los organizadores confirmaron el 2026-11-27 que el stack sugerido **no es obligatorio**, aunque el criterio 5 del .md lo menciona) que lee los CSV AT03 sintéticos y calcula, de forma determinista y reproducible, rankings de 12 bancos por macroactividad, con calidad de datos, desglose por subactividad, comparación entre meses y 3 perfiles (Público / Analista / Administrador).

## Esta versión (paralela a la del equipo)
- Repo del equipo: `Amoenus11/hackathon-sbp` (motor JS + verificación Python). Esta carpeta es una versión propia sobre el **mismo contrato** `docs/api.md`, para comparar e intercambiar piezas.
- `motor/` (JS puro, centavos enteros), `servidor/` (Express 5), `web/` (React 19 + Vite + ECharts), `pruebas/` (node:test).
- Comandos: `npm test` (28 pruebas), `npm run exportar`, `npm run configurar` (usuarios desde `.env`), `npm start` (http://localhost:3000).
- Las 5 exportaciones coinciden celda por celda con `verificacion/comparar.py` del equipo (correrlo con `python -I -X utf8` en Windows).
- `datos-locales/` (usuarios, cargas, parámetros, registro) y `.env` no se versionan.

## Datos (`datos/reto/`)
- `AT03_sintetico_2026{07,08,09}.csv`: 25,000 / 27,500 / 30,000 filas, 61 columnas, sin BOM. Período = campo `Fecha` (20260731, 20260831, 20260930), no el nombre del archivo.
- Catálogos: `Bancos_ficticios.csv` (101–112), `Catalogo_CINU_SB109_reto.csv` (22 CINU → 6 macro / 22 sub), `Tabla_SB21_simplificada.csv` (facilidades 01,02,03,04,05,07), `Diccionario_datos_AT03_reto.csv`.
- **Ojo:** los 4 CSV de catálogo **traen BOM UTF-8** (aunque el .md dice "sin BOM"): leer con `utf-8-sig`/quitar `﻿` o la primera columna no cruza.
- Todos los códigos son **texto** con ceros a la izquierda (`07`, `001`, `0701`). Nunca inferir tipos numéricos. `NA` = no aplica.

## Reglas de cálculo (por período)
1. Cascada de exclusión, cada fila cuenta una sola vez en el primer filtro que incumple:
   - E1 duplicado `Numero_Prestamo` (se queda la 1.ª ocurrencia por orden de archivo)
   - E2 `Destino != 'L'` · E3 `Saldo <= 0` · E4 `Tipo_Actividad` no está en el catálogo CINU
   - Debe cumplirse `filas = E1+E2+E3+E4+universo válido`.
2. Cruzar `Tipo_Actividad = Codigo_CINU` (nunca por `Codigo_SB08_Referencia`, `2103` está repetido).
3. Regla CONSUMO/SB21: CINU Crédito personal (`K.64.649.6492.64921`) + facilidad `07` → subactividad **Tarjeta**. Solo mueve saldo dentro de CONSUMO. Tarjeta sin `07` o Automóvil sin `03` → alerta, se mantiene CINU.
4. `Saldo_Subactividad`, `Saldo_Actividad_Banco`, `Total_Cartera_Local_Valida_Banco` (sobre TODO el universo válido del banco, nunca tras filtrar), `Ponderacion_Pct` redondeado a 4 decimales.
5. Ranking por saldo desc, desempate `Codigo_Banco` asc; siempre 12 bancos (0.00 si no tiene).
6. Sumas exactas en **centavos enteros** (o decimal), nunca float. Reconciliaciones 1, 2 y 3 deben cuadrar al centavo.
7. Movimientos: `Cambio_Posicion = Pos_anterior − Pos_actual`; `Var_Saldo`, `Var_Saldo_Pct`; umbral de "movimiento significativo" **configurable**.

Rankings: obligatorios HIPOTECARIO, CONSTRUCCION, INDUSTRIA, AGROPECUARIO; recomendado COMERCIO; bonus CONSUMO.

Conteos preliminares de la cascada (verificar con el motor definitivo):
| Período | Filas | E1 | E2 | E3 | E4 | Válido |
|---|---|---|---|---|---|---|
| 20260731 | 25,000 | 20 | 886 | 48 | 42 | 24,004 |
| 20260831 | 27,500 | 25 | 967 | 52 | 46 | 26,410 |
| 20260930 | 30,000 | 30 | 1,058 | 58 | 52 | 28,802 |

## Restricciones (penalizan)
- Nada de saldos/posiciones/porcentajes fijados a mano (R2: criterio 1 queda en 0).
- Clasificar solo con catálogos, nunca con nombre/ID del cliente (R3).
- Sin contraseñas, tokens ni llaves en el repo (R5): usuarios de prueba vía `.env` no versionado.
- README con arquitectura, instalación, ejecución y reglas (R4).
- IA solo para consultar/explicar/explorar, nunca para calcular rankings.
- La UI debe mostrar siempre fuente, período y aviso de **datos ficticios**.

## Entregables
Exportaciones CSV: rankings (`Fecha, Ranking, Posicion, Codigo_Banco, Banco, Saldo_Actividad, Total_Cartera_Local_Valida, Ponderacion_Pct` + `Operaciones_Validas`), desglose por subactividad, reporte de calidad E1–E4, reporte de movimientos. 5 módulos (panel, consulta de rankings, filtros, visualización, reportes) y 3 perfiles; el Administrador carga un nuevo período sin tocar código y ve un log de operaciones. Evidencia de pruebas.
