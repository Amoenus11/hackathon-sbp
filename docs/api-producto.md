# Modo producto (demo.syntropy.com.pa): contrato adicional

La misma app corre en **modo producto** (`MODO=producto`): empieza **vacía**, cada persona crea su cuenta,
configura la verificación en 2 pasos (simulada: es una demo) y carga sus propios archivos (CSV o Excel).
En `GET /api/meta` llega `modo: "demo" | "producto"`. En modo `demo` (syntropy.com.pa) nada de esto cambia.

## Cuentas y acceso (solo modo producto)
- `GET /api/cuentas` → `[{ usuario, nombre, perfil, dos_pasos: true|false }]` (para «elige tu usuario»; sin datos sensibles)
- `POST /api/cuentas` `{ usuario, nombre, clave }` → `{ usuario, nombre, perfil }`. El **primer** usuario es `administrador`; los
  siguientes, `analista`. Reglas: usuario 3–24 letras/números/guion; clave ≥ 12 caracteres con letras y números.
  Errores 400 con `{ error }` claro.
- `POST /api/sesion` `{ usuario, clave }`:
  - si la cuenta **no** tiene 2 pasos: inicia sesión y responde `{ perfil, usuario, configurar_dos_pasos: true }`;
  - si **sí** tiene: NO inicia sesión aún y responde `{ paso: "dos_pasos", desafio: "<id>", codigo_demo: "123456" }`.
- `POST /api/sesion/dos-pasos` `{ desafio, codigo }` → `{ perfil, usuario }` (pone la cookie). Código de 6 dígitos, vence en 5 min.
- `POST /api/dos-pasos/configurar` (con sesión) → `{ codigo_demo: "123456" }`. En una versión real sería una app autenticadora
  (TOTP); en la demo se muestra el código en pantalla.
- `POST /api/dos-pasos/confirmar` `{ codigo }` → `{ ok: true }`.
- `POST /api/dos-pasos/omitir` → `{ ok: true }` (se puede dejar para después; se recuerda en la próxima sesión).

## Cargas con bitácora de conversión (ambos modos)
- `POST /api/periodos` acepta `.csv` y `.xlsx`. La respuesta agrega:
  `conversion: { formato: "csv"|"xlsx", hoja: "Hoja1"|null, codificacion: "utf-8"|"latin-1", separador: ","|";",
  filas: 30000, correcciones: [{ tipo, columna, cantidad, descripcion, ejemplos: [{ fila, antes, despues }] }],
  advertencias: [{ tipo, columna, cantidad, descripcion, ejemplos: [...] }] }`
  - `tipo` de corrección: `encabezado` (nombre de columna con tildes, espacios o mayúsculas distintas), `ceros_izquierda`
    (07 → 7 por Excel), `fecha_excel` (número o fecha de Excel → AAAAMMDD), `fecha_texto` (31/07/2026 → 20260731),
    `decimal` (1.234,56 → 1234.56).
  - `advertencias`: celdas vacías, valores con espacios al inicio o al final (no se cambian), filas en blanco ignoradas.
- Un archivo inválido → 400 `{ error, detalle: { faltan: [...], sobran: [...], sugerencias: { "Num_Prestamo": "Numero_Prestamo" } } }`.
- `GET /api/cargas` (analista+) → historial `[{ cuando, usuario, archivo, formato, fechas, filas, milisegundos, ok, error, conversion }]`
  (también las cargas fallidas, con su error).

## Descarga a tu medida (ambos modos; pedido del stakeholder)
«Hoy descargo todo y luego veo cómo lo proceso»: aquí el usuario elige qué quiere, sin saber programar.
- `GET /api/extraccion/opciones` → `{ cortes: [{fecha, etiqueta}], bancos: [{codigo, nombre}], actividades: [{ranking, titulo, subactividades: [..]}],
  clasificaciones: [{codigo, nombre}], campos: [{campo, titulo, grupo, defecto: bool}], agrupaciones: [{clave, titulo}] }`
  Los campos personales (ID_Cliente, Nombre_Cliente) NO se ofrecen nunca.
- `POST /api/extraccion` `{ cortes: [...], bancos: [...] (vacío = todos), actividades: [...rankings], subactividades: [...] (vacío = todas),
  clasificaciones: [...] (vacío = todas), campos: [...], nivel: "detalle" | "resumen", agrupar: ["corte","banco","actividad","subactividad","clasificacion"],
  incluir_excluidas: bool, formato: "json" | "csv" | "xlsx" }`
  - `formato: "json"` → vista previa `{ total_filas, columnas: [...], filas: [[...] x 20], saldo_total, nota }`.
  - `csv` / `xlsx` → el archivo (Content-Disposition con nombre `syntropy_extraccion_<cortes>.csv`).
  - Nivel `detalle`: una fila por préstamo del universo local válido (+ las excluidas con su filtro si `incluir_excluidas`).
  - Nivel `resumen`: una fila por combinación de `agrupar`, con `Operaciones`, `Saldo`, `Saldo_en_mora` (Dias_Mora > 0) y `Pct_mora`.
