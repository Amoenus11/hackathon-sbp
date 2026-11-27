"""Web de Syntropy: sesión, datos, panel y puente hacia el analista aislado (Claude Code)."""
import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import bd, cuentas, datos, seguridad

ESTATICO = Path(__file__).resolve().parent.parent / "static"
COOKIE = "__Host-syntropy"
DURACION = timedelta(hours=12)
ASISTENTE = os.environ.get("ASISTENTE_URL", "http://hackathon-asistente:8100")



@asynccontextmanager
async def _vida(_app):
    for _ in range(30):
        try:
            bd.iniciar()
            break
        except Exception as e:
            print("esperando la base de datos:", type(e).__name__, flush=True)
            await asyncio.sleep(2)
    else:
        raise RuntimeError("No hay base de datos")
    yield


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=_vida)
app.mount("/static", StaticFiles(directory=ESTATICO), name="static")

CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; "
       "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; "
       "frame-ancestors 'none'; form-action 'self'")


@app.middleware("http")
async def cabeceras(request: Request, siguiente):
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api/"):
        # Protección CSRF: un sitio ajeno no puede mandar esta cabecera sin permiso CORS
        if request.headers.get("x-syntropy") != "1":
            return JSONResponse({"error": "Petición no permitida"}, status_code=403)
    r = await siguiente(request)
    r.headers["Content-Security-Policy"] = CSP
    r.headers["X-Content-Type-Options"] = "nosniff"
    r.headers["Referrer-Policy"] = "no-referrer"
    r.headers["X-Frame-Options"] = "DENY"
    r.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    r.headers["Strict-Transport-Security"] = "max-age=31536000"
    if not request.url.path.startswith("/static/"):
        r.headers.setdefault("Cache-Control", "no-store")
    return r


def ip_de(request: Request) -> str:
    return (request.headers.get("cf-connecting-ip")
            or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            or (request.client.host if request.client else "?"))[:64]


def usuario_actual(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE)
    if not token or len(token) > 100:
        return None
    with bd.conexion() as c:
        return c.execute(
            "SELECT u.usuario, u.nombre, u.rol FROM sesiones s JOIN usuarios u USING (usuario) "
            "WHERE s.token_hash = %s AND s.caduca > now()", (seguridad.huella(token),)).fetchone()


def exigir(request: Request, *roles: str) -> dict:
    u = usuario_actual(request)
    if not u:
        raise HTTPException(401, "Inicia sesión")
    if roles and u["rol"] not in roles:
        raise HTTPException(403, "No tienes permiso")
    return u


async def cuerpo_json(request: Request) -> dict:
    try:
        d = await request.json()
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}


# ---------------------------------------------------------------- páginas
def _pagina(nombre: str) -> FileResponse:
    return FileResponse(ESTATICO / nombre, media_type="text/html; charset=utf-8")


@app.get("/entrar")
def p_entrar():
    return _pagina("entrar.html")


@app.get("/activar")
def p_activar():
    return _pagina("activar.html")


@app.get("/revelar")
def p_revelar():
    return _pagina("revelar.html")


def _protegida(request: Request, archivo: str, *roles: str):
    u = usuario_actual(request)
    if not u:
        return RedirectResponse("/entrar", status_code=303)
    if roles and u["rol"] not in roles:
        return RedirectResponse("/", status_code=303)
    return _pagina(archivo)


@app.get("/")
def p_app(request: Request):
    return _protegida(request, "app.html")


@app.get("/informe")
def p_informe(request: Request):
    return _protegida(request, "informe.html")


@app.get("/equipo")
def p_equipo(request: Request):
    return _protegida(request, "equipo.html", "admin", "equipo")


@app.get("/admin")
def p_admin(request: Request):
    return _protegida(request, "admin.html", "admin")


@app.get("/api/salud")
def salud():
    return {"ok": True}


# ---------------------------------------------------------------- sesión
@app.post("/api/entrar")
async def entrar(request: Request):
    d = await cuerpo_json(request)
    usuario = str(d.get("usuario", "")).strip().lower()[:40]
    clave = str(d.get("clave", ""))[:200]
    ip = ip_de(request)
    malo = JSONResponse({"error": "Usuario o contraseña incorrectos."}, status_code=401)
    with bd.conexion() as c:
        n = c.execute("SELECT count(*) AS n FROM auditoria WHERE accion = 'entrar_falla' AND ip = %s "
                      "AND cuando > now() - interval '15 minutes'", (ip,)).fetchone()["n"]
        fila = c.execute("SELECT * FROM usuarios WHERE usuario = %s", (usuario,)).fetchone()
    if n >= 20:
        return JSONResponse({"error": "Demasiados intentos. Espera 15 minutos."}, status_code=429)
    if fila and fila["bloqueado_hasta"] and fila["bloqueado_hasta"] > datetime.now(timezone.utc):
        bd.auditar(usuario, "entrar_falla", {"motivo": "bloqueado"}, ip)
        return JSONResponse({"error": "Cuenta bloqueada 15 minutos por intentos fallidos."}, status_code=429)
    ok = await asyncio.to_thread(seguridad.verificar_clave, clave, fila["clave_hash"] if fila else None)
    if not ok:
        if fila:
            with bd.conexion() as c:
                c.execute("UPDATE usuarios SET fallos = fallos + 1, bloqueado_hasta = CASE WHEN fallos + 1 >= 5 "
                          "THEN now() + interval '15 minutes' END WHERE usuario = %s", (usuario,))
        bd.auditar(usuario or None, "entrar_falla", {}, ip)
        return malo
    token = seguridad.nuevo_token()
    with bd.conexion() as c:
        c.execute("UPDATE usuarios SET fallos = 0, bloqueado_hasta = NULL, ultimo_acceso = now() WHERE usuario = %s",
                  (usuario,))
        c.execute("DELETE FROM sesiones WHERE caduca < now()")
        c.execute("INSERT INTO sesiones (token_hash, usuario, caduca) VALUES (%s, %s, now() + %s)",
                  (seguridad.huella(token), usuario, DURACION))
    bd.auditar(usuario, "entrar_ok", {}, ip)
    r = JSONResponse({"ok": True, "rol": fila["rol"]})
    r.set_cookie(COOKIE, token, max_age=int(DURACION.total_seconds()), httponly=True, secure=True,
                 samesite="strict", path="/")
    return r


@app.post("/api/salir")
def salir(request: Request):
    token = request.cookies.get(COOKIE)
    if token:
        with bd.conexion() as c:
            c.execute("DELETE FROM sesiones WHERE token_hash = %s", (seguridad.huella(token),))
    r = JSONResponse({"ok": True})
    r.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="strict")
    return r


@app.get("/api/yo")
def yo(request: Request):
    return exigir(request)


@app.post("/api/activar")
async def activar(request: Request):
    d = await cuerpo_json(request)
    token, clave = str(d.get("token", ""))[:100], str(d.get("clave", ""))
    with bd.conexion() as c:
        e = c.execute("SELECT usuario FROM enlaces WHERE token_hash = %s AND tipo = 'activar' AND caduca > now()",
                      (seguridad.huella(token),)).fetchone()
    if not e:
        return JSONResponse({"error": "El enlace no es válido o ya se usó."}, status_code=400)
    fallas = seguridad.revisar_politica(clave, e["usuario"])
    if fallas:
        return JSONResponse({"error": "La contraseña no cumple las reglas.", "fallas": fallas}, status_code=400)
    h = await asyncio.to_thread(seguridad.hash_clave, clave)
    with bd.conexion() as c:
        borrado = c.execute("DELETE FROM enlaces WHERE token_hash = %s RETURNING usuario",
                            (seguridad.huella(token),)).fetchone()
        if not borrado:
            return JSONResponse({"error": "El enlace ya se usó."}, status_code=400)
        c.execute("UPDATE usuarios SET clave_hash = %s, fallos = 0, bloqueado_hasta = NULL WHERE usuario = %s",
                  (h, e["usuario"]))
    bd.auditar(e["usuario"], "activar", {}, ip_de(request))
    return {"ok": True, "usuario": e["usuario"]}


@app.post("/api/revelar")
async def revelar(request: Request):
    d = await cuerpo_json(request)
    token = str(d.get("token", ""))[:100]
    with bd.conexion() as c:
        e = c.execute("DELETE FROM enlaces WHERE token_hash = %s AND tipo = 'revelar' AND caduca > now() "
                      "RETURNING usuario, cifrado", (seguridad.huella(token),)).fetchone()
    if not e:
        return JSONResponse({"error": "El enlace no es válido o ya se usó."}, status_code=400)
    bd.auditar(e["usuario"], "revelar", {}, ip_de(request))
    return {"usuario": e["usuario"], "clave": seguridad.descifrar_de_enlace(token, bytes(e["cifrado"]))}


# ---------------------------------------------------------------- datos
@app.get("/api/conjuntos")
def conjuntos(request: Request):
    exigir(request)
    return datos.leer_catalogo()


@app.post("/api/conjuntos")
async def subir(request: Request, archivo: UploadFile = File(...), descripcion: str = Form("")):
    u = exigir(request)
    contenido = await archivo.read(datos.MAX_BYTES + 1)
    try:
        nuevos = await asyncio.to_thread(datos.guardar_subida, archivo.filename or "datos.csv", contenido,
                                         descripcion, u["usuario"])
    except Exception as e:
        return JSONResponse({"error": f"No pude leer el archivo: {str(e)[:200]}"}, status_code=400)
    bd.auditar(u["usuario"], "subir", {"archivo": archivo.filename,
                                       "conjuntos": [(n["nombre"], n["filas"]) for n in nuevos]}, ip_de(request))
    return {"nuevos": nuevos}


@app.get("/api/conjuntos/{nombre}/muestra")
def ver_muestra(nombre: str, request: Request):
    exigir(request)
    try:
        return datos.muestra(nombre)
    except KeyError:
        raise HTTPException(404, "No existe")


@app.delete("/api/conjuntos/{nombre}")
def borrar_conjunto(nombre: str, request: Request):
    u = exigir(request, "admin", "equipo")
    if not datos.borrar(nombre):
        raise HTTPException(404, "No existe")
    bd.auditar(u["usuario"], "borrar_conjunto", {"nombre": nombre}, ip_de(request))
    return {"ok": True}


# ---------------------------------------------------------------- analista (Claude Code aislado)
@app.post("/api/preguntar")
async def preguntar(request: Request):
    u = exigir(request)
    d = await cuerpo_json(request)
    modo = "panel" if d.get("modo") == "panel" else "pregunta"
    pregunta = str(d.get("pregunta", "")).strip()[:4000]
    if modo == "panel" and not pregunta:
        pregunta = "Genera el panel ejecutivo completo con todos los datos disponibles."
    if not pregunta:
        raise HTTPException(400, "Escribe una pregunta")
    if not datos.leer_catalogo()["conjuntos"]:
        raise HTTPException(400, "Primero sube un archivo de datos")
    historial = [{"pregunta": str(h.get("pregunta", ""))[:500], "resumen": str(h.get("resumen", ""))[:800]}
                 for h in (d.get("historial") or [])[-6:] if isinstance(h, dict)]
    ip = ip_de(request)
    bd.auditar(u["usuario"], "pregunta", {"modo": modo, "pregunta": pregunta[:500]}, ip)
    peticion = {"pregunta": pregunta, "modo": modo, "historial": historial, "usuario": u["usuario"]}

    async def flujo():
        cola: asyncio.Queue = asyncio.Queue()

        async def leer():
            try:
                tiempo = httpx.Timeout(connect=5, read=900, write=10, pool=5)
                async with httpx.AsyncClient(timeout=tiempo) as cli:
                    async with cli.stream("POST", f"{ASISTENTE}/preguntar", json=peticion) as r:
                        if r.status_code != 200:
                            await cola.put({"tipo": "error", "texto": "El analista no está disponible ahora."})
                        else:
                            async for linea in r.aiter_lines():
                                if linea.strip():
                                    try:
                                        await cola.put(json.loads(linea))
                                    except ValueError:
                                        pass
            except httpx.HTTPError:
                await cola.put({"tipo": "error", "texto": "No pude hablar con el analista."})
            finally:
                await cola.put(None)

        tarea = asyncio.create_task(leer())
        respuesta, fin = None, {}
        try:
            while True:
                try:
                    ev = await asyncio.wait_for(cola.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield json.dumps({"tipo": "latido"}) + "\n"   # para que Cloudflare no corte
                    continue
                if ev is None:
                    break
                if ev.get("tipo") == "respuesta":
                    respuesta = ev.get("datos")
                elif ev.get("tipo") == "fin":
                    fin = ev
                yield json.dumps(ev, ensure_ascii=False) + "\n"
        finally:
            tarea.cancel()
        if respuesta and modo == "panel":
            with bd.conexion() as c:
                c.execute("INSERT INTO paneles (usuario, datos) VALUES (%s, %s)",
                          (u["usuario"], json.dumps(respuesta, ensure_ascii=False)))
        bd.auditar(u["usuario"], "respuesta", {"modo": modo, "ok": bool(respuesta),
                                               "segundos": fin.get("segundos"), "costo_usd": fin.get("costo_usd")}, ip)

    return StreamingResponse(flujo(), media_type="text/event-stream; charset=utf-8",
                             headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})


@app.get("/api/panel")
def panel(request: Request):
    exigir(request)
    with bd.conexion() as c:
        p = c.execute("SELECT id, creado, usuario, datos FROM paneles ORDER BY id DESC LIMIT 1").fetchone()
        f = c.execute("SELECT id, creado, usuario, datos FROM fijados ORDER BY id").fetchall()
    return {"panel": p, "fijados": f}


@app.post("/api/fijados")
async def fijar(request: Request):
    u = exigir(request)
    d = await cuerpo_json(request)
    g = d.get("grafico")
    if not isinstance(g, dict) or len(json.dumps(g)) > 400_000:
        raise HTTPException(400, "Gráfico no válido")
    with bd.conexion() as c:
        fila = c.execute("INSERT INTO fijados (usuario, datos) VALUES (%s, %s) RETURNING id",
                         (u["usuario"], json.dumps(g, ensure_ascii=False))).fetchone()
    return {"id": fila["id"]}


@app.delete("/api/fijados/{id_}")
def desfijar(id_: int, request: Request):
    exigir(request, "admin", "equipo")
    with bd.conexion() as c:
        c.execute("DELETE FROM fijados WHERE id = %s", (id_,))
    return {"ok": True}


# ---------------------------------------------------------------- administración
@app.get("/api/admin/usuarios")
def admin_usuarios(request: Request):
    exigir(request, "admin")
    with bd.conexion() as c:
        return c.execute(
            "SELECT u.usuario, u.nombre, u.rol, u.clave_hash IS NOT NULL AS activo, u.ultimo_acceso, "
            "u.bloqueado_hasta > now() AS bloqueado, "
            "(SELECT count(*) FROM enlaces e WHERE e.usuario = u.usuario AND e.caduca > now()) AS enlaces "
            "FROM usuarios u ORDER BY u.creado").fetchall()


@app.post("/api/admin/enlace")
async def admin_enlace(request: Request):
    u = exigir(request, "admin")
    d = await cuerpo_json(request)
    objetivo = str(d.get("usuario", "")).lower()
    try:
        enlace = cuentas.crear_enlace(objetivo)
    except KeyError:
        raise HTTPException(404, "No existe")
    bd.auditar(u["usuario"], "nuevo_enlace", {"para": objetivo}, ip_de(request))
    return {"enlace": enlace}


@app.get("/api/admin/auditoria")
def admin_auditoria(request: Request):
    exigir(request, "admin")
    with bd.conexion() as c:
        return c.execute("SELECT cuando, usuario, accion, detalle, ip FROM auditoria ORDER BY id DESC LIMIT 300"
                         ).fetchall()
