"""Analista aislado de Syntropy.

Recibe preguntas de hackathon-web y las resuelve con Claude Code sin pantalla (`claude -p`).
Corre dentro del contenedor hackathon-asistente:
  - sin internet: solo ve a hackathon-salida, que añade la clave y reenvía a api.anthropic.com;
  - sin clave: aquí la clave es falsa («sin-clave»);
  - con los datos montados en solo lectura en /datos;
  - sin root y con el disco de solo lectura (solo /tmp se puede escribir).

Contrato (POST /preguntar) → application/x-ndjson, un JSON por línea:
  {"tipo":"inicio","id":...}
  {"tipo":"paso","texto":...,"detalle":...}      (0 o más)
  {"tipo":"respuesta","datos":{...esquema_respuesta.json...}}   o   {"tipo":"error","texto":...}
  {"tipo":"fin","segundos":...,"costo_usd":...,"turnos":...}
"""

import asyncio
import json
import os
import re
import shutil
import signal
import time
import uuid
from pathlib import Path
from typing import Literal

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

AQUI = Path(__file__).resolve().parent
INSTRUCCIONES = (AQUI / "instrucciones.md").read_text(encoding="utf-8")
ESQUEMA_TEXTO = json.dumps(
    json.loads((AQUI / "esquema_respuesta.json").read_text(encoding="utf-8")),
    ensure_ascii=False,
    separators=(",", ":"),
)


def _buscar_claude() -> str:
    """El binario de Claude Code viene dentro del paquete claude-agent-sdk."""
    if os.environ.get("CLAUDE_BIN"):
        return os.environ["CLAUDE_BIN"]
    if shutil.which("claude"):
        return shutil.which("claude")
    try:
        import claude_agent_sdk

        ruta = Path(claude_agent_sdk.__file__).parent / "_bundled" / "claude"
        if ruta.exists():
            return str(ruta)
    except Exception:
        pass
    return "claude"


CLAUDE = _buscar_claude()
MODELO = os.environ.get("MODELO", "claude-opus-5-5")
ESFUERZO = os.environ.get("ESFUERZO", "low")
DATOS = Path(os.environ.get("DATOS", "/datos"))
URL_SALIDA = os.environ.get("ANTHROPIC_BASE_URL", "http://hackathon-salida:8080")
TRABAJO = Path(os.environ.get("TRABAJO", "/tmp/trabajo"))  # una carpeta por ejecución (cwd del agente)
CASAS = Path(os.environ.get("CASAS", "/tmp/casas"))  # un HOME por ejecución (configuración de Claude Code)
SIMULTANEAS = int(os.environ.get("SIMULTANEAS", "2"))
LIMITES = {
    "pregunta": {"segundos": 300, "usd": "1.5"},
    "panel": {"segundos": 480, "usd": "2.5"},
}
HERRAMIENTAS = "Bash,Read,Write,Edit,Glob,Grep"
LIMITE_LINEA = 32 * 1024 * 1024  # stream-json puede traer líneas grandes (resultados de herramientas)

# Solo estas variables pasan al proceso de Claude Code (y a todo lo que él ejecute).
VARIABLES_FIJAS = {
    "DISABLE_AUTOUPDATER": "1",
    "DISABLE_TELEMETRY": "1",
    "DISABLE_ERROR_REPORTING": "1",
    "DISABLE_BUG_COMMAND": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
}

MENSAJES_ERROR = {
    "error_max_budget_usd": "Se alcanzó el límite de gasto de esta pregunta. Prueba con una pregunta más concreta.",
    "error_max_turns": "El análisis necesitó demasiados pasos. Prueba con una pregunta más concreta.",
    "error_max_structured_output_retries": "El analista no logró dar la respuesta en el formato pedido. Intenta de nuevo.",
    "error_during_execution": "Hubo un error durante el análisis. Intenta de nuevo.",
}

for carpeta in (TRABAJO, CASAS):
    carpeta.mkdir(parents=True, exist_ok=True, mode=0o700)

semaforo = asyncio.Semaphore(SIMULTANEAS)
app = FastAPI(title="Analista aislado de Syntropy", docs_url=None, redoc_url=None, openapi_url=None)


class Turno(BaseModel):
    pregunta: str = Field("", max_length=8000)
    resumen: str = Field("", max_length=8000)


class Peticion(BaseModel):
    pregunta: str = Field("", max_length=4000)
    modo: Literal["pregunta", "panel"] = "pregunta"
    historial: list[Turno] = Field(default_factory=list, max_length=6)
    usuario: str = Field("anónimo", max_length=40)


# ---------------------------------------------------------------- utilidades


def recortar(texto, n: int) -> str:
    texto = "" if texto is None else str(texto)
    return texto if len(texto) <= n else texto[: n - 1] + "…"


def evento(tipo: str, **campos) -> bytes:
    return (json.dumps({"tipo": tipo, **campos}, ensure_ascii=False) + "\n").encode("utf-8")


def registrar(**campos) -> None:
    print(json.dumps({"evento": "ejecucion", **campos}, ensure_ascii=False), flush=True)


def entorno_hijo(casa: Path) -> dict:
    return {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": str(casa),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "ANTHROPIC_BASE_URL": URL_SALIDA,
        # Falsa a propósito: la clave real solo la tiene hackathon-salida.
        "ANTHROPIC_API_KEY": "sin-clave",
        **VARIABLES_FIJAS,
    }


def orden(modo: str, prompt: str) -> list[str]:
    return [
        CLAUDE,
        "-p",
        prompt,  # siempre empieza por «Modo:», nunca por «-»
        "--model", MODELO,
        "--effort", ESFUERZO,
        "--output-format", "stream-json",
        "--verbose",
        "--bare",
        "--no-session-persistence",
        "--strict-mcp-config",
        "--permission-mode", "bypassPermissions",
        "--tools", HERRAMIENTAS,
        "--add-dir", str(DATOS),
        "--append-system-prompt", INSTRUCCIONES,
        "--json-schema", ESQUEMA_TEXTO,
        "--max-budget-usd", LIMITES[modo]["usd"],
    ]


def armar_prompt(p: Peticion) -> str:
    partes = [f"Modo: {p.modo}"]
    if p.historial:
        partes.append("Conversación previa (resúmenes, del más antiguo al más reciente):")
        for i, t in enumerate(p.historial[-6:], 1):
            partes.append(f"{i}. Pregunta: {recortar(t.pregunta, 1000)}\n   Respuesta: {recortar(t.resumen, 1000)}")
    if p.modo == "panel":
        partes.append(
            "Tarea: construye el panel ejecutivo completo con los datos disponibles en /datos, "
            "para los stakeholders."
        )
        if p.pregunta.strip():
            partes.append(f"Indicaciones del usuario para el panel: {p.pregunta.strip()}")
    else:
        partes.append(f"Pregunta del usuario: {p.pregunta.strip()}")
    partes.append("Devuelve la respuesta final en el formato estructurado del esquema.")
    return "\n\n".join(partes)


def hay_datos() -> bool:
    try:
        catalogo = json.loads((DATOS / "catalogo.json").read_text(encoding="utf-8"))
        return bool(catalogo.get("conjuntos"))
    except Exception:
        return False


def describir_herramienta(nombre: str, entrada) -> tuple[str, str]:
    """Convierte una llamada a herramienta en una frase en español para la página."""
    entrada = entrada if isinstance(entrada, dict) else {}
    nombre = str(nombre or "")
    if "structured" in nombre.lower():
        return "Redactando la respuesta final", ""
    if nombre == "Bash":
        cmd = str(entrada.get("command", ""))
        if re.search(r"\b(duckdb|select)\b", cmd, re.IGNORECASE):
            return "Consultando los datos con SQL", cmd
        if "python" in cmd:
            return "Ejecutando Python", cmd
        return "Ejecutando una orden", cmd
    if nombre == "Read":
        ruta = str(entrada.get("file_path", ""))
        if ruta.endswith("catalogo.json"):
            return "Leyendo el catálogo de datos", ruta
        return f"Leyendo {Path(ruta).name or 'un archivo'}", ruta
    if nombre == "Write":
        ruta = str(entrada.get("file_path", ""))
        return f"Escribiendo {Path(ruta).name or 'un archivo'}", str(entrada.get("content", ""))
    if nombre == "Edit":
        ruta = str(entrada.get("file_path", ""))
        return f"Corrigiendo {Path(ruta).name or 'un archivo'}", str(entrada.get("new_string", ""))
    if nombre == "Glob":
        return "Buscando archivos", str(entrada.get("pattern", ""))
    if nombre == "Grep":
        return "Buscando en los archivos", str(entrada.get("pattern", ""))
    return f"Usando {nombre or 'una herramienta'}", ""


# ------------------------------------------------- limpieza de la respuesta

_FUNCION = re.compile(r"^\s*(function\b|\(?[\w\s,]*\)?\s*=>)")


def limpiar_opcion(valor, profundidad: int = 0):
    """Deja la opción de ECharts como JSON inofensivo: sin funciones, sin HTML, sin javascript:."""
    if profundidad > 40:
        return None
    if isinstance(valor, dict):
        limpio = {}
        for clave, v in valor.items():
            if isinstance(v, str) and (_FUNCION.match(v) or (clave == "formatter" and "<" in v)):
                continue
            v = limpiar_opcion(v, profundidad + 1)
            if v is not None:
                limpio[str(clave)] = v
        return limpio
    if isinstance(valor, list):
        return [x for x in (limpiar_opcion(v, profundidad + 1) for v in valor) if x is not None]
    if isinstance(valor, str):
        if "javascript:" in valor.lower() or "<script" in valor.lower():
            return ""
        return valor
    if isinstance(valor, (int, float, bool)) or valor is None:
        return valor
    return str(valor)


def _lista(v) -> list:
    return v if isinstance(v, list) else []


def normalizar(d: dict) -> dict:
    graficos = []
    for g in _lista(d.get("graficos"))[:8]:
        if not isinstance(g, dict):
            continue
        opcion = g.get("echarts")
        if isinstance(opcion, str):
            try:
                opcion = json.loads(opcion)
            except ValueError:
                opcion = None
        if not isinstance(opcion, dict):
            continue
        opcion = limpiar_opcion(opcion)
        if len(json.dumps(opcion, ensure_ascii=False)) > 300_000:
            continue
        graficos.append(
            {"titulo": recortar(g.get("titulo"), 200), "explicacion": recortar(g.get("explicacion"), 800), "echarts": opcion}
        )
    return {
        "titulo": recortar(d.get("titulo"), 200) or "Análisis",
        "resumen": recortar(d.get("resumen"), 4000),
        "kpis": [
            {
                "nombre": recortar(k.get("nombre"), 120),
                "valor": recortar(k.get("valor"), 80),
                "detalle": recortar(k.get("detalle"), 300),
                "tendencia": k.get("tendencia") if k.get("tendencia") in ("sube", "baja", "estable", "n/a") else "n/a",
            }
            for k in _lista(d.get("kpis"))[:8]
            if isinstance(k, dict)
        ],
        "graficos": graficos,
        "hallazgos": [
            {"texto": recortar(h.get("texto"), 800), "evidencia": recortar(h.get("evidencia"), 800)}
            for h in _lista(d.get("hallazgos"))[:10]
            if isinstance(h, dict)
        ],
        "alertas": [
            {
                "nivel": a.get("nivel") if a.get("nivel") in ("alta", "media", "baja") else "media",
                "texto": recortar(a.get("texto"), 800),
            }
            for a in _lista(d.get("alertas"))[:10]
            if isinstance(a, dict)
        ],
        "recomendaciones": [recortar(r, 600) for r in _lista(d.get("recomendaciones"))[:8] if r],
        "consultas": [
            {"descripcion": recortar(c.get("descripcion"), 300), "codigo": recortar(c.get("codigo"), 6000)}
            for c in _lista(d.get("consultas"))[:12]
            if isinstance(c, dict)
        ],
        "limitaciones": [recortar(x, 600) for x in _lista(d.get("limitaciones"))[:8] if x],
    }


def intentar_json(texto):
    if not isinstance(texto, str) or not texto.strip():
        return None
    t = texto.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    try:
        return json.loads(t)
    except ValueError:
        inicio, fin = t.find("{"), t.rfind("}")
        if 0 <= inicio < fin:
            try:
                return json.loads(t[inicio : fin + 1])
            except ValueError:
                return None
    return None


def construir_respuesta(resultado, carpeta: Path) -> tuple[dict | None, str | None]:
    if not resultado:
        return None, "El analista terminó sin dar una respuesta. Intenta de nuevo."
    subtipo = resultado.get("subtype")
    if resultado.get("is_error") or subtipo != "success":
        estado_api = resultado.get("api_error_status")
        if estado_api == 429:
            return None, "Se alcanzó el límite de uso del servicio de IA. Espera un minuto e intenta de nuevo."
        if estado_api in (500, 502, 503, 529):
            return None, "El servicio de IA está saturado en este momento. Intenta de nuevo en un momento."
        if estado_api in (401, 403):
            return None, "El servicio de IA no está disponible ahora mismo (configuración)."
        return None, MENSAJES_ERROR.get(subtipo, "El analista no pudo terminar el análisis. Intenta de nuevo.")
    datos = resultado.get("structured_output")
    if not isinstance(datos, dict):
        datos = intentar_json(resultado.get("result"))
    if not isinstance(datos, dict):
        archivo = carpeta / "respuesta.json"
        if archivo.is_file():
            try:
                datos = intentar_json(archivo.read_text(encoding="utf-8", errors="replace"))
            except OSError:
                datos = None
    if not isinstance(datos, dict):
        texto = str(resultado.get("result") or "").strip()
        if texto:
            datos = {
                "titulo": "Respuesta del analista",
                "resumen": texto,
                "limitaciones": ["La respuesta no llegó en el formato estructurado."],
            }
    if not isinstance(datos, dict):
        return None, "La respuesta del analista no se pudo leer. Intenta de nuevo."
    return normalizar(datos), None


# ------------------------------------------------------------- ejecución


def matar(proceso) -> None:
    if proceso is not None and proceso.returncode is None:
        try:
            os.killpg(proceso.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass


async def leer_salida(proceso, cola: asyncio.Queue, estado: dict) -> None:
    """Lee el stream-json de Claude Code: pasos a la cola; el evento final a estado['resultado']."""
    try:
        async for linea in proceso.stdout:
            try:
                ev = json.loads(linea)
            except ValueError:
                continue
            if not isinstance(ev, dict):
                continue
            tipo = ev.get("type")
            if tipo == "assistant":
                for bloque in (ev.get("message") or {}).get("content") or []:
                    if isinstance(bloque, dict) and bloque.get("type") == "tool_use":
                        texto, detalle = describir_herramienta(bloque.get("name"), bloque.get("input"))
                        estado["herramientas"] += 1
                        cola.put_nowait(evento("paso", texto=texto, detalle=recortar(detalle, 600)))
            elif tipo == "result":
                estado["resultado"] = ev
    except Exception as e:  # p. ej. una línea más larga que LIMITE_LINEA
        estado["fallo_lectura"] = f"{type(e).__name__}: {e}"
        matar(proceso)
    finally:
        cola.put_nowait(None)


async def leer_errores(proceso, estado: dict) -> None:
    """Vacía stderr (para que el proceso no se bloquee) y guarda solo el final, para el registro."""
    try:
        while True:
            trozo = await proceso.stderr.read(65536)
            if not trozo:
                break
            estado["stderr"] = (estado["stderr"] + trozo.decode("utf-8", "replace"))[-2000:]
    except Exception:
        pass


async def ejecutar(p: Peticion):
    ident = uuid.uuid4().hex[:12]
    inicio = time.monotonic()
    limite = LIMITES[p.modo]
    estado = {"resultado": None, "herramientas": 0, "stderr": "", "fallo_lectura": None}
    resultado_registro = "error"
    yield evento("inicio", id=ident)

    if p.modo == "pregunta" and not p.pregunta.strip():
        yield evento("error", texto="Escribe una pregunta.")
        yield evento("fin", segundos=0.0, costo_usd=None, turnos=0)
        return
    if not hay_datos():
        yield evento("error", texto="Todavía no hay datos cargados. Sube un archivo primero.")
        yield evento("fin", segundos=0.0, costo_usd=None, turnos=0)
        return
    if semaforo.locked():
        registrar(id=ident, usuario=p.usuario, modo=p.modo, estado="ocupado")
        yield evento("error", texto="El analista está ocupado, intenta en un minuto.")
        yield evento("fin", segundos=0.0, costo_usd=None, turnos=0)
        return

    await semaforo.acquire()  # no espera: se comprobó justo antes, sin pausas entre medio
    carpeta = TRABAJO / ident
    casa = CASAS / ident
    proceso = None
    tareas: list[asyncio.Task] = []
    try:
        carpeta.mkdir(mode=0o700)
        casa.mkdir(mode=0o700)
        cola: asyncio.Queue = asyncio.Queue()
        proceso = await asyncio.create_subprocess_exec(
            *orden(p.modo, armar_prompt(p)),
            cwd=str(carpeta),
            env=entorno_hijo(casa),
            stdin=asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            start_new_session=True,  # para matar también lo que el agente lance
            limit=LIMITE_LINEA,
        )
        tareas = [
            asyncio.create_task(leer_salida(proceso, cola, estado)),
            asyncio.create_task(leer_errores(proceso, estado)),
        ]
        hora_limite = inicio + limite["segundos"]
        try:
            while True:
                restante = hora_limite - time.monotonic()
                if restante <= 0:
                    raise TimeoutError
                item = await asyncio.wait_for(cola.get(), restante)
                if item is None:
                    break
                yield item
            restante = max(1.0, hora_limite - time.monotonic())
            await asyncio.wait_for(proceso.wait(), restante)
        except TimeoutError:
            matar(proceso)
            resultado_registro = "tiempo"
            yield evento("error", texto="El análisis tardó demasiado y se detuvo. Prueba con una pregunta más concreta.")
        else:
            datos, error = construir_respuesta(estado["resultado"], carpeta)
            if datos is not None:
                resultado_registro = "ok"
                yield evento("respuesta", datos=datos)
            else:
                yield evento("error", texto=error)
    except (GeneratorExit, asyncio.CancelledError):
        resultado_registro = "cancelado"  # la página se desconectó a mitad del análisis
        raise
    finally:
        # Sin pausas aquí: si la página se desconecta, esto corre durante una cancelación.
        matar(proceso)
        for t in tareas:
            t.cancel()
        shutil.rmtree(carpeta, ignore_errors=True)
        shutil.rmtree(casa, ignore_errors=True)
        semaforo.release()
        res = estado["resultado"] or {}
        registrar(
            id=ident,
            usuario=p.usuario,
            modo=p.modo,
            estado=resultado_registro,
            segundos=round(time.monotonic() - inicio, 1),
            costo_usd=res.get("total_cost_usd"),
            turnos=res.get("num_turns"),
            herramientas=estado["herramientas"],
            subtipo=res.get("subtype"),
            api=res.get("api_error_status"),
            fallo_lectura=estado["fallo_lectura"],
            stderr=recortar(estado["stderr"], 500) if resultado_registro != "ok" else None,
        )

    res = estado["resultado"] or {}
    yield evento(
        "fin",
        segundos=round(time.monotonic() - inicio, 1),
        costo_usd=res.get("total_cost_usd"),
        turnos=res.get("num_turns"),
    )


# ------------------------------------------------------------------ rutas


@app.get("/salud")
async def salud():
    return {"ok": True}


@app.post("/preguntar")
async def preguntar(p: Peticion):
    return StreamingResponse(
        ejecutar(p),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
