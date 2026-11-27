"""Asistente del Observatorio en internet (syntropy.com.pa): Claude Code de SOLO LECTURA.

- Herramientas: únicamente Read, Glob y Grep (no puede ejecutar órdenes, escribir ni editar).
- Solo ve /resultados (exportaciones ya calculadas por el motor) y /datos-reto (paquete del reto), ambos en
  solo lectura. Su carpeta de trabajo es temporal y vacía.
- No tiene internet ni credenciales: habla con hackathon-salida, que añade la credencial y solo deja pasar
  las llamadas a la API de Anthropic.
- Nunca calcula rankings: explica los resultados oficiales del motor (Sección 9 del reto).
"""
import asyncio
import json
import os
import shutil
import signal
import time
import uuid
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel, Field

AQUI = Path(__file__).resolve().parent
INSTRUCCIONES = (AQUI / "instrucciones_observatorio.md").read_text(encoding="utf-8")


def _buscar_claude() -> str:
    if shutil.which("claude"):
        return shutil.which("claude")
    import claude_agent_sdk

    return str(Path(claude_agent_sdk.__file__).parent / "_bundled" / "claude")


CLAUDE = _buscar_claude()
MODELO = os.environ.get("MODELO", "claude-opus-5-5")
ESFUERZO = os.environ.get("ESFUERZO", "low")
RESULTADOS = os.environ.get("RESULTADOS", "/resultados")
DATOS_RETO = os.environ.get("DATOS_RETO", "/datos-reto")
LIMITE_S = int(os.environ.get("LIMITE_SEGUNDOS", "150"))
HERRAMIENTAS = "Read,Glob,Grep"

semaforo = asyncio.Semaphore(int(os.environ.get("SIMULTANEAS", "2")))
app = FastAPI(title="Asistente de solo lectura", docs_url=None, redoc_url=None, openapi_url=None)


class Peticion(BaseModel):
    pregunta: str = Field(..., min_length=1, max_length=2000)
    contexto: str = Field("", max_length=80000)
    perfil: str = Field("publico", max_length=20)


def entorno(casa: Path) -> dict:
    """Solo estas variables llegan a Claude Code. La credencial es falsa a propósito."""
    base = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": str(casa),
        "LANG": "C.UTF-8",
        "ANTHROPIC_BASE_URL": os.environ.get("ANTHROPIC_BASE_URL", "http://hackathon-salida:8080"),
        "DISABLE_AUTOUPDATER": "1",
        "DISABLE_TELEMETRY": "1",
        "DISABLE_ERROR_REPORTING": "1",
        "DISABLE_BUG_COMMAND": "1",
        "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    }
    if os.environ.get("AUTENTICACION", "oauth") == "oauth":
        base["CLAUDE_CODE_OAUTH_TOKEN"] = "sin-credencial"  # la real la pone hackathon-salida
    else:
        base["ANTHROPIC_API_KEY"] = "sin-credencial"
    return base


@app.get("/salud")
async def salud():
    return {"ok": True}


@app.post("/explicar")
async def explicar(p: Peticion):
    if semaforo.locked():
        return {"disponible": True, "respuesta": "El asistente está atendiendo otras preguntas. Intenta en unos segundos."}
    async with semaforo:
        ident = uuid.uuid4().hex[:12]
        casa = Path(f"/tmp/casas/{ident}")
        trabajo = Path(f"/tmp/trabajo/{ident}")
        casa.mkdir(parents=True, mode=0o700)
        trabajo.mkdir(parents=True, mode=0o700)
        inicio = time.monotonic()
        orden = [
            CLAUDE, "-p",
            "--model", MODELO, "--effort", ESFUERZO,
            "--output-format", "json", "--no-session-persistence", "--strict-mcp-config",
            "--append-system-prompt", INSTRUCCIONES,
        ]
        # Solo analistas y administradores pueden hacer que lea archivos (los resultados incluyen las filas
        # excluidas y los meses en borrador). Al Público le responde únicamente con el RESUMEN, sin herramientas.
        if p.perfil in ("analista", "administrador"):
            orden += ["--tools", HERRAMIENTAS, "--allowedTools", HERRAMIENTAS, "--add-dir", RESULTADOS, "--add-dir", DATOS_RETO]
        else:
            orden += ["--tools", ""]
        prompt = f"RESUMEN DEL PERÍODO CONSULTADO (ya calculado por el motor):\n{p.contexto}\n\nPREGUNTA DEL USUARIO:\n{p.pregunta}"
        proceso = await asyncio.create_subprocess_exec(
            *orden, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            cwd=str(trabajo), env=entorno(casa), start_new_session=True,
        )
        try:
            salida, errores = await asyncio.wait_for(proceso.communicate(prompt.encode()), timeout=LIMITE_S)
        except asyncio.TimeoutError:
            try:
                os.killpg(proceso.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            return {"disponible": True, "respuesta": "La consulta tardó demasiado. Prueba con una pregunta más concreta."}
        finally:
            shutil.rmtree(casa, ignore_errors=True)
            shutil.rmtree(trabajo, ignore_errors=True)
        segundos = round(time.monotonic() - inicio, 1)
        try:
            datos = json.loads(salida.decode() or "{}")
        except ValueError:
            datos = {}
        print(json.dumps({"evento": "explicar", "id": ident, "segundos": segundos, "ok": not datos.get("is_error", True),
                          "error": errores.decode()[-300:] if not datos else ""}, ensure_ascii=False), flush=True)
        if not datos or datos.get("is_error"):
            return {"disponible": False, "respuesta": "El asistente no pudo responder ahora. Todo lo demás funciona con normalidad."}
        return {"disponible": True, "respuesta": str(datos.get("result", "")).strip(), "segundos": segundos}
