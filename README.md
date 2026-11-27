# Plataforma de rankings de crédito · Hackathon SBP 2026

Aplicación web local que transforma los archivos sintéticos **AT03** (Átomo 03) en **rankings de crédito por banco y actividad económica**, con reporte de calidad de datos, desglose por subactividad, comparación entre meses y tres perfiles de usuario.

> **Datos 100 % ficticios** con fines de demostración. No representan al sistema bancario panameño ni constituyen opinión formal de la SBP.

Esta es una **versión paralela** construida sobre el mismo contrato de API que el repositorio del equipo (`docs/api.md`), para comparar ambas y poder intercambiar piezas (por ejemplo, esta web con el otro servidor).

## Requisitos

- Node.js 20.19 o más reciente (probado con Node 25).
- No necesita base de datos ni conexión a Internet (salvo el asistente de IA, que es opcional).

## Instalación y ejecución

```bash
npm install
cp .env.example .env        # en Windows: copy .env.example .env
npm run configurar          # crea los usuarios de prueba (ver «Perfiles»)
npm start                   # compila la web y abre http://localhost:3000
```

Otros comandos:

| Comando | Qué hace |
| --- | --- |
| `npm test` | Pruebas del motor, de los datos del reto y de la API (28 pruebas) |
| `npm run exportar` | Calcula todo desde `datos/reto/` y escribe las 5 exportaciones en `exportaciones/` |
| `npm run dev:api` + `npm run dev:web` | Desarrollo: servidor en 3000 y web con recarga en 5173 |

## Arquitectura

```
datos/reto/             Paquete del reto (AT03 de 3 meses + 4 catálogos). Solo lectura.
docs/                   Indicaciones del reto, presentación y contrato de API (docs/api.md)
motor/                  Cálculo determinista, sin dependencias (JavaScript puro)
  csv.js                Lector/escritor CSV: todo como texto (los códigos conservan sus ceros)
  dinero.js             Montos en centavos enteros; porcentajes con BigInt y redondeo aritmético
  catalogos.js          Catálogos CINU/SB109, SB21, bancos y diccionario
  periodo.js            Validación, exclusiones E1→E4, clasificación, regla SB21, agregación, ranking, reconciliaciones
  comparacion.js        Movimientos entre períodos y explicaciones automáticas (sin IA)
  exportar.js / cli.js  Las 5 exportaciones oficiales
servidor/               Node.js + Express 5: implementa docs/api.md
  estado.js             Períodos cargados, parámetros, registro de operaciones (datos-locales/)
  acceso.js             Perfiles, permisos, sesiones, contraseñas con scrypt
  vistas.js             Respuestas JSON del contrato
  reporte.js            Reporte ejecutivo HTML descargable
  ia.js                 Asistente opcional (API de Claude): explica resultados, nunca calcula
web/                    React 19 + Vite + ECharts (renderizador SVG)
pruebas/                node:test — motor, datos reales y API
datos-locales/          (no se versiona) usuarios, períodos cargados desde la web, parámetros, registro

Del repositorio del equipo, sin cambios en esta rama:
verificacion/           Implementación independiente en Python y comparador celda por celda
nube/, equipo/,         Infraestructura de la versión en internet, página del equipo y su Dockerfile
Dockerfile              (esta versión lo respeta: escucha en ANFITRION y lee datos/reto; no se probó en Docker)
```

Al arrancar, el servidor procesa todos los `AT03*.csv` de `datos/reto/` más los que el administrador haya cargado desde la web. Todo se recalcula desde los archivos: no hay saldos, porcentajes ni posiciones escritos a mano.

## Reglas implementadas

Se aplican a **cada período por separado**; el período sale del campo `Fecha`, no del nombre del archivo.

1. **Lectura.** Todos los campos se leen como texto (`07` sigue siendo `07`). Se quita el BOM UTF-8 de los catálogos.
2. **Esquema.** 61 columnas con los nombres y el orden del diccionario; `Fecha` válida en formato AAAAMMDD. Si no cumple, el archivo se rechaza con un mensaje que dice exactamente qué falla.
3. **Exclusiones en cascada.** Cada fila cuenta una sola vez, en el primer filtro que incumple:
   - **E1:** `Numero_Prestamo` repetido en el período (se conserva la primera aparición según el orden del archivo).
   - **E2:** `Destino` distinto de `L` (comparación exacta).
   - **E3:** `Saldo` menor o igual a 0 (o ilegible).
   - **E4:** `Tipo_Actividad` que no está en el catálogo CINU/SB109.

   Se verifica `filas leídas = E1 + E2 + E3 + E4 + universo local válido`. También se calcula el conteo independiente de cada regla, rotulado aparte.
4. **Clasificación.** `Tipo_Actividad = Codigo_CINU` (nunca por `Codigo_SB08_Referencia`) da la macroactividad (el ranking) y la subactividad.
5. **Regla SB21 de CONSUMO.** Una operación con CINU de Crédito personal y facilidad `07` pasa a la subactividad **Tarjeta**. Solo mueve saldo dentro de CONSUMO. Tarjeta sin `07` o Automóvil sin `03` generan una alerta y conservan la subactividad del catálogo.
6. **Agregación exacta.** Sumas en centavos enteros: `Saldo_Subactividad`, `Saldo_Actividad_Banco` y `Total_Cartera_Local_Valida_Banco`. Este último se calcula sobre **todo** el universo válido del banco, nunca después de filtrar.
7. **Ponderación.** `Saldo_Actividad_Banco / Total_Cartera_Local_Valida_Banco × 100`, con 4 decimales y redondeo aritmético (la mitad hacia arriba), calculada con enteros.
8. **Ranking.** Saldo descendente; un empate exacto se resuelve por `Codigo_Banco` ascendente. Siempre aparecen los 12 bancos (con `0.00` si no tienen saldo).
9. **Reconciliaciones al centavo:**
   - **R1:** las subactividades suman la actividad.
   - **R2:** las 6 actividades suman el total del banco.
   - **R3:** los 12 totales suman el universo.
   - **U:** cada préstamo es único en el universo.
   - **C:** el total de CONSUMO no cambia con la regla SB21.
10. **Integridad referencial.** Un banco que no está en el catálogo o una facilidad que no está en la SB21 generan una alerta, pero no excluyen la fila.

### Movimiento significativo (configurable)

`Cambio_Posicion = Posicion_anterior − Posicion_actual` (un valor positivo significa que el banco sube). Un movimiento es **significativo** si cumple al menos una de estas condiciones:

- `|Cambio_Posicion| ≥ mov_min_posiciones` (por defecto **2**);
- hay un cambio de líder (`mov_cambio_lider`, activado por defecto);
- `|Var_Saldo_Pct| ≥ mov_var_saldo_pct` (por defecto **15 %**).

El administrador cambia estos valores desde **Administración → Parámetros**, sin tocar el código. Las explicaciones de cada movimiento se redactan con plantillas deterministas, sin IA.

## Perfiles

| Perfil | Cómo entra | Qué ve |
| --- | --- | --- |
| Público | Sin sesión | Panel, Rankings (filtros, gráficos y tablas), Metodología, Descargas de rankings y desglose |
| Analista | Usuario y contraseña | Lo anterior + Comparar, Calidad de datos, Reportes personalizados, Asistente IA, todas las exportaciones |
| Administrador | Usuario y contraseña | Lo anterior + Cargar o quitar períodos, Parámetros, Catálogos, Perfiles y permisos, Registro de operaciones |

**No hay contraseñas en el repositorio.** `npm run configurar` toma usuario y contraseña de `.env` (que está en `.gitignore`); si una contraseña está vacía, genera una al azar y la muestra una sola vez. Solo se guarda su huella scrypt en `datos-locales/usuarios.json`. El servidor exige el perfil en cada ruta. Las escrituras requieren la cabecera `X-Syntropy: 1` y una cookie HttpOnly con SameSite=Strict, y la cuenta se bloquea tras 5 intentos fallidos.

## Exportaciones

| Archivo | Columnas |
| --- | --- |
| `rankings.csv` | Fecha, Ranking, Posicion, Codigo_Banco, Banco, Saldo_Actividad, Total_Cartera_Local_Valida, Ponderacion_Pct, Operaciones_Validas |
| `desglose.csv` | Fecha, Ranking, Subactividad, Codigo_Banco, Saldo |
| `calidad.csv` | Fecha, Filas_Leidas, E1_Duplicados, E2_Destino_Extranjero, E3_Saldo_No_Positivo, E4_Actividad_No_Catalogada, Universo_Local_Valido, Saldo_Universo_Local_Valido, Cuadra |
| `movimientos.csv` | Fecha_Anterior, Fecha_Actual, Ranking, Codigo_Banco, Banco, Posicion_Anterior, Posicion_Actual, Cambio_Posicion, Saldo_Anterior, Saldo_Actual, Var_Saldo, Var_Saldo_Pct, Significativo, Motivo |
| `excluidas.csv` | Fecha, Fila (fila de datos; 1 = primera después del encabezado), Numero_Prestamo, Codigo_Banco, Filtro, Motivo |

Se descargan desde la web (con filtros por período, ranking, banco y filtro de exclusión) o con `npm run exportar`. **Reportes → Reporte ejecutivo** genera además un HTML listo para imprimir o guardar como PDF.

## Evidencia de exactitud y pruebas

- `npm test` corre 28 pruebas:
  - casos hechos a mano para cada regla: cascada, ceros a la izquierda, SB21, desempate, denominador, redondeo, esquema y movimientos;
  - invariantes de la lista de autoverificación sobre los 3 cortes reales;
  - la API: el perfil público no puede cargar un período, el administrador quita septiembre y lo vuelve a cargar, un archivo inválido se rechaza y los parámetros son configurables.
- **Verificación cruzada con el equipo.** Las 5 exportaciones de esta versión son **idénticas celda por celda** a las de la implementación independiente en Python del repositorio del equipo (`verificacion/`). Solo difieren en la redacción del motivo. Para repetirlo (en Windows hace falta `-X utf8`):

  ```bash
  python -I -X utf8 verificacion/referencia.py datos/reto salida-referencia
  npm run exportar
  python -I -X utf8 verificacion/comparar.py salida-referencia exportaciones
  ```

| Período | Filas | E1 | E2 | E3 | E4 | Universo válido | Saldo del universo | SB21 → Tarjeta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 20260731 | 25,000 | 20 | 886 | 48 | 42 | 24,004 | 4,342,391,663.85 | 295 |
| 20260831 | 27,500 | 25 | 967 | 52 | 46 | 26,410 | 4,733,510,382.80 | 325 |
| 20260930 | 30,000 | 30 | 1,058 | 58 | 52 | 28,802 | 5,152,103,850.27 | 362 |

## Automatizaciones

1. **Cargar un período nuevo** (Administración → Cargar período). El archivo se valida, se procesa, se recalculan todos los rankings y se compara con el mes anterior, sin editar código. Para la demostración: quitar septiembre y volver a cargar `AT03_sintetico_202609.csv`.
2. **Detección de movimientos significativos** con una regla configurable.
3. **Comparación de dos períodos cualesquiera**, sin preparación manual.
4. **Explicación automática** de los principales movimientos (nuevo líder, a quién supera, variación de saldo).
5. **Reporte ejecutivo descargable** generado automáticamente.

## Indicadores adicionales (no intervienen en los rankings)

- **Morosidad:** saldo con días de mora y con más de 90 días.
- **Cuota de mercado** de cada banco en cada ranking.
- **Concentración (HHI)** y cuota de los 3 mayores.
- **Mapa de especialización** banco × actividad.
- **Trayectoria de posiciones** a lo largo de los meses.
- **Asistente de IA (opcional):** recibe solo resultados ya calculados y los explica en lenguaje natural. Se activa con `ANTHROPIC_API_KEY` en `.env`; sin clave, el resto de la plataforma funciona igual.

## Restricciones respetadas

- La clasificación usa solo los catálogos suministrados, nunca el nombre ni los datos del cliente.
- No hay valores finales escritos a mano. Las cifras de control de `pruebas/control-equipo.json` las usan solo las pruebas, nunca la aplicación.
- No hay contraseñas, tokens ni llaves en el repositorio.
- La IA no calcula rankings.
