# Syntropy · Observatorio de Crédito Bancario

**Hackathon SBP 2026 · Reto: reconstrucción automatizada de rankings de crédito y análisis bancario**
Equipo **Syntropy** — *Del caos de datos al orden de las decisiones.*

> ⚠️ **Datos 100 % ficticios** (paquete AT03 sintético de la SBP). No representan al sistema bancario panameño
> ni constituyen opinión formal de la Superintendencia de Bancos de Panamá.

**En vivo: https://syntropy.com.pa** (Público sin usuario; Analista y Administrador con usuario).

Hoy las estadísticas se consultan en Excel y PDF: comparar bancos y meses es lento y poco transparente.
El Observatorio transforma los registros AT03 en **rankings de crédito por banco y actividad económica**:
reproducibles, verificables al centavo, comparables entre períodos y explicados en lenguaje claro para cada
tipo de usuario.

---

## 1. Inicio rápido (ejecución local)

Requisitos: **Node.js 20.19 o superior** (probado con Node 24) y Git. No necesita internet ni base de datos.

```bash
git clone https://github.com/Amoenus11/hackathon-sbp.git
cd hackathon-sbp
npm install
npm run configurar     # crea .env con los usuarios de prueba y muestra sus contraseñas UNA vez
npm start              # compila la web y abre el servidor
```

Abre **http://localhost:3000**. Al arrancar, el sistema calcula los 3 períodos del paquete en ~2 segundos.

| Comando | Qué hace |
| --- | --- |
| `npm start` | Compila la web (React) y arranca el servidor (Node) en el puerto 3000 |
| `npm test` | Ejecuta las 17 pruebas automáticas (motor, API y sesiones) |
| `npm run exportar` | Recalcula todo desde `datos/reto/` y escribe las 5 exportaciones en `exportaciones/` |
| `npm run configurar -- agregar <usuario> <analista\|administrador>` | Agrega un usuario |
| `npm run dev:api` + `npm run dev:web` | Modo desarrollo (recarga en caliente; web en :5173) |

Para demostrar la **carga automática** de un período: en `.env` pon `CARGA_INICIAL=julio-agosto`, borra la
carpeta `datos-locales/` y arranca; luego, como Administrador, carga `datos/reto/AT03_sintetico_202609.csv`.
(También puedes quitar septiembre desde *Cargar período* y volver a cargarlo.)

## 2. Perfiles (lámina 6)

| Perfil | Acceso | Opciones |
| --- | --- | --- |
| **Público** | Sin usuario | Panel, Rankings (filtros, gráficos, tablas ordenables), Metodología con diagrama de datos, descarga de rankings y desglose |
| **Analista** | Usuario y contraseña | + Comparar entidades y períodos, movimientos y sus explicaciones, Calidad de datos (filas excluidas), Reportes personalizados, Asistente IA, todas las exportaciones |
| **Administrador** | Usuario y contraseña | + Cargar o actualizar períodos, Parámetros (regla de movimiento significativo), Catálogos, Perfiles y permisos, Registro de operaciones |

Los permisos se validan **en el servidor** (no solo se ocultan botones): `servidor/sesion.js`.
Las contraseñas solo existen como huella **scrypt** dentro de `.env`, que **no** se sube al repositorio (R5).

## 3. Arquitectura (lámina 7)

```
 Navegador ──► React 19 (Vite) ──HTTP/JSON──► Node.js + Express ──► Motor de rankings (JavaScript puro)
               web/src/                        servidor/                motor/
               ECharts · React Flow            perfiles · API ·         CSV como texto · centavos BigInt ·
                                               carga · exportación      cascada E1–E4 · SB21 · rankings
                                                     │
                       datos/reto/ (paquete oficial) + datos-locales/ (cargas, parámetros, registro)
                                                     │
                                 Asistente IA: Claude Code local (opcional, solo explica)
```

- **Frontend:** React + Vite, gráficos interactivos con ECharts, diagrama interactivo con React Flow.
- **Backend:** Node.js (Express 5). Contrato completo de la API en [`docs/api.md`](docs/api.md).
- **Motor:** `motor/motor.js`, sin dependencias, determinista. Lo usan el servidor, la línea de comandos y las pruebas.
- **Persistencia:** archivos en `datos-locales/` (no hace falta base de datos). Al arrancar **todo se recalcula**
  desde los CSV originales: ningún saldo, porcentaje ni posición se guarda ni se escribe a mano (R2).

## 4. Reglas implementadas (Secciones 4 a 8 de las indicaciones)

Por cada período (campo `Fecha`, nunca el nombre del archivo):

1. **Lectura como texto** (`motor/csv.js`): los códigos conservan sus ceros (`07`, `001`, `0701`).
2. **Esquema y fechas** (`validarEsquema`, `fechaValida`): 61 columnas con los nombres y el orden del diccionario, y cada
   `Fecha` debe existir en el calendario (mes 13, mes 00 o 30 de febrero se rechazan). Un archivo inválido se rechaza con un
   mensaje que nombra el archivo y la fila, sin tocar los datos cargados. Los catálogos también se validan (un código CINU
   repetido o una columna faltante se rechazan en vez de clasificar mal en silencio). **Montos:** un saldo con espacios alrededor o sin
   2 decimales (`" 500.00"`, `500`) se normaliza sin cambiar su valor y queda una alerta `saldo_normalizado`; uno ambiguo (`1e3`, `NA`,
   `1,000.00`) se excluye en E3 como «saldo ilegible» con alerta. Los **códigos** nunca se normalizan: `" L"` no es `L`.
3. **Exclusiones en cascada** (`procesarPeriodo`): cada fila cuenta **una sola vez**, en el primer filtro que incumple:
   - **E1** `Numero_Prestamo` repetido en el período → se conserva la primera aparición según el orden del archivo.
   - **E2** `Destino` distinto de exactamente `L`.
   - **E3** `Saldo <= 0`.
   - **E4** `Tipo_Actividad` que no está en `Catalogo_CINU_SB109_reto.Codigo_CINU`.
   Se verifica `filas leídas = E1 + E2 + E3 + E4 + universo local válido`. Los conteos independientes de cada regla
   se muestran aparte y rotulados como tales. **Si un mismo período (`Fecha`) viene repartido en varios archivos, las
   filas se reúnen** (los cálculos son por `Fecha`, no por archivo) y el duplicado entre archivos cuenta como E1. En la
   plataforma, cargar un archivo de un mes que ya existe **lo reemplaza** y avisa cuántas filas había y cuántas hay ahora.
4. **Clasificación solo por catálogo** (`AT03.Tipo_Actividad = CINU.Codigo_CINU`; nunca nombres ni datos del cliente)
   y **regla de CONSUMO con SB21**: Crédito personal con facilidad `07` se reclasifica a *Tarjeta* (el total de
   CONSUMO no cambia). Tarjeta sin `07` o Automóvil sin `03` generan alerta y conservan su subactividad.
5. **Agregación en centavos enteros (BigInt)**: `Saldo_Subactividad`, `Saldo_Actividad_Banco` y
   `Total_Cartera_Local_Valida_Banco` (sobre todo el universo del banco, antes de cualquier filtro de la vista).
6. **Ponderación** = saldo de la actividad / total de cartera × 100, con 4 decimales y redondeo aritmético exacto.
7. **Ranking**: saldo descendente; empate → `Codigo_Banco` ascendente; siempre los 12 bancos (0.00 si no tienen saldo).
8. **Controles**: integridad referencial (alertas), unicidad de préstamos y reconciliaciones **I, R1, R2, R3, U y C al centavo**.
   R1, R2, I y U documentan que el desglose cuadra con los totales (se suman en el mismo recorrido); R3 compara contra el
   catálogo de bancos y detecta un banco no registrado; C recalcula CONSUMO *sin* la regla SB21 desde el catálogo y lo compara con
   el resultado *con* la regla. La garantía fuerte es la doble implementación independiente (sección 6). `Cuadra` en `calidad.csv`
   es `SI` solo si cuadran la identidad de filas **y** todas las reconciliaciones; las alertas se exportan en `alertas.csv`.
9. **Movimientos** entre períodos consecutivos: `Cambio_Posicion = anterior − actual` (positivo = sube),
   `Var_Saldo` y `Var_Saldo_Pct`.

### Movimiento significativo (regla configurable)
Un movimiento es significativo si cumple **cualquiera** de estas condiciones (valores iniciales):
- `|Cambio_Posicion| >= 2`;
- hay **cambio de líder** (un banco llega al 1.er lugar o lo pierde);
- `|Var_Saldo_Pct| >= 15 %`.

Además: un banco que **entra** a un sector (saldo anterior 0) o **sale** de él se marca siempre, porque un porcentaje sobre una base 0
no existe (`Var_Saldo_Pct = NA`); un banco con 0 en ambos meses no se mueve (sus puestos solo reflejan el desempate por código); y el
liderazgo exige saldo mayor que 0. También se informa cuántos puntos porcentuales crece cada banco **frente al sector** (variación del
banco − variación de todo el ranking).

El Administrador cambia estos umbrales en **Parámetros**, sin tocar el código; el cambio queda en el registro.

#### ¿De dónde sale el 15 %?
El reto deja la regla a cada equipo, así que el umbral se calibró con los datos: las 144 variaciones de saldo entre meses seguidos tienen
mediana 8,9 %, el 75 % varía menos de 11,7 % y el **90 % varía menos de 14,7 %** (máximo 24,2 %). Con 15 % se marca cerca del 10 % más
extremo (14 de 144). Con 10 % se marcaría más de un tercio (51) y con 20 % casi nada (2): dejaría de ser «significativo». La pantalla
*Comparar* recalcula la mediana y el percentil 90 de la comparación elegida. Entre meses no consecutivos (por ejemplo julio → septiembre) la
variación acumula varios meses y se marcan muchos más bancos; la plataforma lo avisa.

### Morosidad (norma de la SBP; el reto no la define)
Se sigue el [Acuerdo 4-2013 de la Superintendencia de Bancos de Panamá](https://www.superbancos.gob.pa/documentos/leyes_y_regulaciones/acuerdos/2013/Compilado_Acuerdo_4-2013.pdf),
artículo 2, numerales 13 y 14: una facilidad es **morosa** con importes impagos de **más de 30 y hasta 90 días**, y **vencida** con **más de 90 días**;
los **sobregiros** (SB21 `04` y `05`) pasan a vencidos al superar **30 días**. Se aplica a todo el saldo de la facilidad usando `Dias_Mora`.
(Las «operaciones de un solo pago al vencimiento», que la norma trata como los sobregiros, no se identifican con los campos del AT03 y no se aplican.)
Son indicadores adicionales: no intervienen en los rankings.
### Anatomía del cambio (innovación)
Como un mismo `Numero_Prestamo` aparece mientras está vigente, explicamos **por qué** cambió el saldo de cada
banco en cada actividad, exacto al centavo: `saldo anterior + préstamos nuevos − préstamos que terminaron +
variación de los que siguen = saldo actual` (`anatomiaDelCambio` en `motor/motor.js`; prueba en `pruebas/`).
Se ve como un gráfico de cascada al tocar un banco en *Rankings*, alimenta las explicaciones automáticas y se
exporta en `anatomia.csv`.

### Automatizaciones (lámina 8): las 6
1. Al cargar un período se calculan calidad, rankings, desglose y reconciliaciones automáticamente.
2. Se identifican los movimientos significativos con la regla configurable.
3. Se comparan dos períodos cualesquiera sin preparación manual.
4. Se **explica automáticamente** cada movimiento (texto determinista: quién sube, a quién supera y por qué).
5. Se señalan las variaciones definidas por reglas (posiciones, liderazgo, saldo).
6. Se prepara un **reporte descargable** (CSV y reporte imprimible / PDF).

## 5. Exportaciones (Sección 10)

Desde la app (*Rankings*, *Calidad*, *Comparar*, *Reportes*) o con `npm run exportar`:

| Archivo | Columnas |
| --- | --- |
| `rankings.csv` | Fecha, Ranking, Posicion, Codigo_Banco, Banco, Saldo_Actividad, Total_Cartera_Local_Valida, Ponderacion_Pct, Operaciones_Validas |
| `desglose.csv` | Fecha, Ranking, Subactividad, Codigo_Banco, Saldo |
| `calidad.csv` | Fecha, Filas_Leidas, E1–E4, Universo_Local_Valido, Saldo_Universo_Local_Valido, Cuadra |
| `movimientos.csv` | Fecha_Anterior, Fecha_Actual, Ranking, Codigo_Banco, Banco, posiciones, Cambio_Posicion, saldos, Var_Saldo, Var_Saldo_Pct, Significativo, Motivo |
| `excluidas.csv` | Fecha, Fila, Numero_Prestamo, Codigo_Banco, Filtro, Motivo (lista trazable de cada exclusión; en E1 indica qué fila y archivo se conservó) |
| `alertas.csv` | *(complemento, no es uno de los 5 oficiales)* Fecha, Tipo, Severidad, Cantidad, Descripcion, Reconciliaciones_Con_Diferencias |

## 6. Pruebas y verificación (evidencia)

- **`npm test`** — 36 pruebas (`pruebas/`; `revision.test.js` cubre los casos límite: fecha imposible, un mes en dos archivos, banco desconocido con R3 que falla, morosidad, saldo 0 en comparaciones, rechazos en la API): cascada con casos hechos a mano (una fila extranjera y negativa cuenta
  solo en E2; `l` minúscula no es `L`; el duplicado se decide por orden de archivo), regla SB21, desempate,
  denominador único, ponderaciones ≈ 100, reconciliaciones, archivos inválidos, perfiles y permisos, carga de un
  período nuevo y comparación automática, columnas exactas de las exportaciones.
- **Doble implementación independiente** — `verificacion/referencia.py` calcula todo con otra implementación
  (Python, solo biblioteca estándar) y `verificacion/comparar.py` compara las 5 exportaciones celda por celda:

  ```bash
  npm run exportar
  python3 verificacion/referencia.py datos/reto /tmp/referencia
  python3 verificacion/comparar.py exportaciones /tmp/referencia     # → IDÉNTICOS
  ```

## 7. Asistente IA (innovación)

La IA **explica**; **nunca calcula** los rankings (Sección 9). Recibe resultados ya calculados (rankings,
movimientos y calidad del período) y responde en lenguaje claro, citando las cifras oficiales.

- **Local:** usa **Claude Code instalado en el equipo** con la sesión de quien ejecuta la app (sin claves en el código).
- **En internet (syntropy.com.pa):** un Claude Code **aislado y de solo lectura** (`nube/asistente/explicador.py`):
  solo puede leer las exportaciones oficiales y el paquete del reto (herramientas Read, Glob y Grep: no ejecuta
  órdenes ni escribe), no tiene internet ni credencial; un intermediario (`nube/salida/`) añade la credencial y
  solo deja pasar la API de Anthropic.

Si no está disponible, todo lo demás (incluidas las explicaciones automáticas) funciona igual.

## 7.1 Pensado para presentar
- **Presentación guiada** (botón «▶ Presentación guiada» en la cabecera): recorre la app en el orden del pitch,
  con una frase por pantalla; se avanza con las flechas del teclado.
- **Metodología en 5 pasos** con las cifras en vivo: leer → excluir (E1–E4) → clasificar (CINU + SB21) → sumar al
  centavo → ordenar y comparar; y un diagrama simple de cómo se relacionan los archivos.
- **Equipo Syntropy**: quiénes somos, misión, valores, el pitch en 5 minutos y las preguntas que los tres sabemos
  responder.

## 8. Decisiones técnicas

| Decisión | Por qué |
| --- | --- |
| Centavos enteros (BigInt) | Sumar miles de saldos en punto flotante puede desviarse ±0.01; la clave oficial no tolera eso. |
| Lector CSV propio, todo como texto | Evita que `07` se convierta en `7` (Sección 2.1) y quita dependencias. |
| Motor separado de la web | El mismo código calcula en la app, en la línea de comandos y en las pruebas: un solo origen de verdad. |
| Sin base de datos | 82 500 filas se procesan en ~2 s; recalcular siempre desde los archivos garantiza reproducibilidad. |
| Permisos en el servidor | Un perfil no puede saltarse sus límites escribiendo la URL. |
| Explicaciones deterministas + IA opcional | Las explicaciones automáticas no dependen de la IA; la IA solo aporta conversación. |

## 9. Estructura

```
motor/          motor de rankings (JS puro): csv.js, dinero.js, motor.js, exportar.js, cargar.js, cli.js
servidor/       API Express: app.js, estado.js, sesion.js, ia.js, configurar.js, index.js
web/            interfaz React (Vite)
pruebas/        pruebas automáticas (node --test)
verificacion/   implementación de referencia en Python + comparador
datos/reto/     paquete oficial del reto (AT03 sintético y catálogos)
docs/           indicaciones del reto, presentación y contrato de la API
nube/           versión en internet: asistente de solo lectura (Claude Code aislado) e intermediario
Dockerfile      imagen de la versión en internet (no se publica si una prueba falla)
```

---
Equipo **Syntropy** · Hackathon SBP 2026. *Uso informativo; no constituye opinión formal de la SBP.*
