# Contrato entre la web (React) y el servidor (Node.js)

Todas las rutas empiezan con `/api`, responden JSON (salvo las exportaciones CSV) y usan la cookie
de sesión `syntropy_sesion` (HttpOnly, SameSite=Strict). Las escrituras (POST/PUT/DELETE) exigen la
cabecera `X-Syntropy: 1`.

**Montos:** siempre texto con 2 decimales exactos (`"1234567.89"`), calculados en centavos enteros.
La web los convierte con `Number()` solo para dibujar y los muestra con `Intl.NumberFormat('es-PA')`.
**Porcentajes:** texto con 4 decimales (`"12.3456"`). **Fechas de corte:** texto `AAAAMMDD`.

## Perfiles

| Perfil | Cómo entra | Ve |
| --- | --- | --- |
| `publico` | Sin iniciar sesión | Panel, Rankings (con filtros, gráficos, tablas), Metodología (diagrama de datos), Descargas autorizadas (rankings y desglose) |
| `analista` | Usuario y contraseña | Lo anterior + Comparar (entidades y períodos, movimientos), Calidad de datos, Reportes personalizados, Asistente IA |
| `administrador` | Usuario y contraseña | Lo anterior + Cargar período, Parámetros, Catálogos, Perfiles y permisos, Registro de operaciones |

Errores: `{ "error": "mensaje claro en español" }` con 400/401/403/404/413/500.

## Sesión
- `GET /api/sesion` → `{ "perfil": "publico", "usuario": null }`
- `POST /api/sesion` `{usuario, clave}` → `{ "perfil": "analista", "usuario": "nath" }`
- `DELETE /api/sesion` → `{ "perfil": "publico", "usuario": null }`

## Metadatos
`GET /api/meta` →
```json
{
  "periodos": [{ "fecha": "20260731", "etiqueta": "julio 2026", "corta": "jul 2026", "archivo": "AT03_sintetico_202607.csv", "cargado": "2026-11-27T14:00:00.000Z", "filas_leidas": 25000 }],
  "ultimo": "20260930",
  "rankings": [{ "nombre": "HIPOTECARIO", "titulo": "Hipotecario", "tipo": "obligatorio", "subactividades": ["Vivienda propia", "Local comercial"] }],
  "bancos": [{ "codigo": "101", "nombre": "Banco Istmo" }],
  "fuente": "Paquete Hackathon SBP 2026 · Átomo 03 (AT03) sintético",
  "aviso": "Datos 100 % ficticios con fines de demostración. No representan al sistema bancario panameño ni constituyen opinión formal de la SBP.",
  "parametros": { "mov_min_posiciones": 2, "mov_cambio_lider": true, "mov_var_saldo_pct": "15.00" },
  "permisos": { "publico": ["panel", "rankings", "metodologia", "descargas"], "analista": ["…"], "administrador": ["…"] }
}
```
`tipo`: `obligatorio` (HIPOTECARIO, CONSTRUCCION, INDUSTRIA, AGROPECUARIO), `recomendado` (COMERCIO), `bonus` (CONSUMO). Orden fijo: ese.

## Panel principal
`GET /api/panel?fecha=20260930` →
```json
{
  "fecha": "20260930", "etiqueta": "septiembre 2026", "fecha_anterior": "20260831",
  "kpis": { "cartera_total": "123456789.01", "cartera_total_anterior": "120000000.00", "var_cartera_pct": "2.8805",
            "operaciones": 28000, "bancos": 12, "filas_leidas": 30000, "excluidas": 2000, "pct_excluidas": "6.6667" },
  "lideres": [{ "ranking": "HIPOTECARIO", "codigo_banco": "105", "banco": "Banco Metropolitano", "saldo": "…", "ponderacion_pct": "…",
                "participacion_pct": "18.1234", "lider_anterior": { "codigo_banco": "101", "banco": "Banco Istmo" } }],
  "composicion": [{ "ranking": "HIPOTECARIO", "saldo": "…", "pct": "34.1234" }],
  "destacados": [{ "tipo": "lider|sube|baja|saldo", "ranking": "CONSTRUCCION", "codigo_banco": "107", "texto": "Banco Union pasa del 5.º al 2.º lugar en Construcción (+3) con un saldo 22,4 % mayor." }],
  "indicadores": {
    "morosa_pct": "0.5704", "vencida_pct": "2.9761", "atraso_pct": "12.7811",
    "concentracion": [{ "ranking": "HIPOTECARIO", "hhi": 1234, "nivel": "baja|moderada|alta", "top3_pct": "45.1234" }]
  }
}
```
`morosa_pct` / `vencida_pct`: Acuerdo 4-2013 de la SBP (morosa = más de 30 y hasta 90 días; vencida = más de 90 días, y los sobregiros desde 30). `atraso_pct` = cualquier día de atraso (informativo). `meses_desde_anterior` (junto a `fecha_anterior`) indica a cuántos meses está el período anterior; si no es 1, faltan meses.

`participacion_pct` = saldo del banco / saldo del ranking en el sistema (cuota de mercado). `ponderacion_pct` = la oficial del reto (saldo / total de cartera del banco).

## Rankings
`GET /api/rankings?fecha=&ranking=` →
```json
{ "fecha": "20260930", "ranking": "HIPOTECARIO", "fecha_anterior": "20260831", "total_ranking": "…",
  "filas": [{ "posicion": 1, "codigo_banco": "105", "banco": "Banco Metropolitano", "saldo_actividad": "…",
              "total_cartera": "…", "ponderacion_pct": "…", "operaciones": 812, "participacion_pct": "…",
              "posicion_anterior": 2, "cambio": 1, "saldo_anterior": "…", "var_saldo_pct": "4.1234" }] }
```
Siempre 12 filas (bancos sin saldo con `"0.00"`). `posicion_anterior`, `cambio`, `saldo_anterior` y `var_saldo_pct` son `null` en el primer período.

`GET /api/matriz?fecha=` → los 6 rankings juntos, para el mapa de calor banco × actividad:
`{ "fecha": "…", "rankings": ["HIPOTECARIO", …], "bancos": [{ "codigo_banco": "101", "banco": "…", "total_cartera": "…", "celdas": [{ "ranking": "HIPOTECARIO", "saldo": "…", "ponderacion_pct": "…", "posicion": 3 }] }] }`

`GET /api/historia?ranking=` → para el gráfico de posiciones en el tiempo (bump chart):
`{ "ranking": "HIPOTECARIO", "periodos": ["20260731", "20260831", "20260930"], "bancos": [{ "codigo_banco": "101", "banco": "…", "posiciones": [3, 2, 2], "saldos": ["…", "…", "…"] }] }`

## Desglose por subactividad
`GET /api/desglose?fecha=&ranking=&banco=` (banco opcional) →
`{ "fecha": "…", "ranking": "CONSUMO", "filas": [{ "codigo_banco": "101", "banco": "…", "subactividad": "Tarjeta", "saldo": "…", "operaciones": 120, "reclasificadas_sb21": 15 }] }`
`reclasificadas_sb21` solo es mayor que 0 en «Tarjeta» de CONSUMO (operaciones de Crédito personal con facilidad 07).

## Movimientos entre períodos
`GET /api/movimientos?desde=20260831&hasta=20260930&ranking=` (ranking opcional; `desde`/`hasta` por defecto los dos últimos) →
```json
{ "desde": "20260831", "hasta": "20260930", "meses_entre": 1,
  "resumen": { "total": 72, "significativos": 10, "pct_marcados": "13.8889", "var_mediana_pct": "8.5700", "var_p90_pct": "13.1000" },
  "regla": { "mov_min_posiciones": 2, "mov_cambio_lider": true, "mov_var_saldo_pct": "15.00" },
  "filas": [{ "ranking": "…", "codigo_banco": "…", "banco": "…", "posicion_anterior": 5, "posicion_actual": 2, "cambio": 3,
              "saldo_anterior": "…", "saldo_actual": "…", "var_saldo": "…", "var_saldo_pct": "22.4000", "var_vs_sector_pp": "12.4000",
              "significativo": true, "motivos": ["Sube 3 posiciones", "Nuevo líder"] }],
  "explicaciones": ["En Construcción, Banco Union …"] }
```
`cambio = posicion_anterior − posicion_actual` (positivo = sube). `var_saldo_pct` es `null` si el saldo anterior es 0 (entonces el motivo es «Entra al sector»; si el saldo actual es 0, «Sale del sector»). `var_vs_sector_pp` = variación del banco − variación de todo el ranking, en puntos porcentuales.

## Calidad de datos
`GET /api/calidad?fecha=` (analista o administrador) →
```json
{ "fecha": "…", "archivo": "…", "filas_leidas": 30000,
  "cascada": { "E1": 30, "E2": 1050, "E3": 60, "E4": 55 }, "universo": 28805, "saldo_universo": "…", "cuadra": true,
  "independientes": { "E1": 30, "E2": 1060, "E3": 63, "E4": 55 },
  "reconciliaciones": [{ "id": "R1", "nombre": "Subactividades = actividad (por banco y ranking)", "ok": true, "revisados": 72, "diferencias": 0 }],
  "alertas": [{ "tipo": "consumo_incoherente", "severidad": "media", "texto": "…", "cantidad": 3 }],
  "esquema": { "ok": true, "columnas": 61, "problemas": [] } }
```
`GET /api/excluidas?fecha=&filtro=E2&pagina=1` → `{ "total": 1050, "pagina": 1, "por_pagina": 50, "filas": [{ "fila": 17, "numero_prestamo": "…", "codigo_banco": "…", "filtro": "E2", "motivo": "Destino extranjero (E)", "destino": "E", "saldo": "…", "tipo_actividad": "…" }] }`

## Exportaciones (CSV, UTF-8, separador coma)
`GET /api/exportar/{tipo}.csv?fecha=` (sin `fecha` = todos los períodos)
- `rankings`: `Fecha,Ranking,Posicion,Codigo_Banco,Banco,Saldo_Actividad,Total_Cartera_Local_Valida,Ponderacion_Pct,Operaciones_Validas`
- `desglose`: `Fecha,Ranking,Subactividad,Codigo_Banco,Saldo`
- `calidad`: `Fecha,Filas_Leidas,E1_Duplicados,E2_Destino_Extranjero,E3_Saldo_No_Positivo,E4_Actividad_No_Catalogada,Universo_Local_Valido,Saldo_Universo_Local_Valido,Cuadra`
- `movimientos`: `Fecha_Anterior,Fecha_Actual,Ranking,Codigo_Banco,Banco,Posicion_Anterior,Posicion_Actual,Cambio_Posicion,Saldo_Anterior,Saldo_Actual,Var_Saldo,Var_Saldo_Pct,Significativo,Motivo`
- `alertas` (complemento, solo analista y administrador): `Fecha,Tipo,Severidad,Cantidad,Descripcion,Reconciliaciones_Con_Diferencias`
- `excluidas`: `Fecha,Fila,Numero_Prestamo,Codigo_Banco,Filtro,Motivo`
Público puede descargar `rankings` y `desglose`; analista y administrador, todo.

## Administración (solo administrador)
- `POST /api/periodos` (multipart, campo `archivo`, CSV AT03) → `{ "procesados": [{ "fecha": "20260930", "filas_leidas": 30000, "universo": 28805 }], "reemplazo": false, "reemplazados": [], "avisos": [], "movimientos_significativos": 7, "explicaciones": ["…"] }`. Si el archivo trae un período que ya existe, lo **reemplaza** y `reemplazados` dice cuántas filas había y cuántas hay; `avisos` también advierte de meses faltantes o períodos que no cuadran. Archivo inválido (columnas, fecha que no existe en el calendario, etc.) → 400 con un mensaje que nombra el archivo, y el intento queda en el registro como `carga_fallida`.
- `DELETE /api/periodos/:fecha` → `{ "ok": true }` (para repetir la demostración de carga)
- `GET /api/parametros` / `PUT /api/parametros` `{ mov_min_posiciones, mov_cambio_lider, mov_var_saldo_pct }`
- `GET /api/catalogos` → `{ "cinu": [{ "codigo": "…", "descripcion": "…", "macroactividad": "…", "subactividad": "…", "sb08": "…" }], "sb21": [{ "codigo": "07", "descripcion": "…", "uso": "…" }], "bancos": [{ "codigo": "101", "nombre": "…", "licencia": "…" }] }`
- `GET /api/registro` → `[{ "cuando": "ISO", "usuario": "admin", "perfil": "administrador", "accion": "cargar_periodo", "detalle": "AT03_sintetico_202609.csv · 30000 filas" }]`

## Asistente IA (analista y administrador)
`POST /api/ia` `{ "pregunta": "…", "fecha": "20260930" }` → `{ "disponible": true, "respuesta": "texto", "segundos": 12.3 }`.
La IA solo recibe resultados ya calculados (rankings, movimientos, calidad) y explica; **nunca calcula rankings**.
Si Claude Code no está instalado o no ha iniciado sesión: `{ "disponible": false, "respuesta": "…" }`.
