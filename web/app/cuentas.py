"""Cuentas de la página: crear usuarios y generar enlaces de un solo uso.

Uso dentro del contenedor:
  python -m app.cuentas iniciar          crea los 5 usuarios y muestra sus enlaces
  python -m app.cuentas enlace <usuario> genera un enlace nuevo (anula la contraseña anterior)

- Admin y SBP: contraseña aleatoria muy fuerte; el enlace la muestra UNA vez.
- Gui, Nath y Ani: el enlace les deja crear su propia contraseña (con reglas estrictas).
"""
import os
import sys

from . import bd, seguridad

USUARIOS = [
    ("admin", "Admin", "admin"),
    ("gui", "Gui", "equipo"),
    ("nath", "Nath", "equipo"),
    ("ani", "Ani", "equipo"),
    ("sbp", "SBP", "sbp"),
]
URL = os.environ.get("URL_PUBLICA", "https://hackathon.syntropy.com.pa").rstrip("/")


def crear_enlace(usuario: str) -> str:
    """Anula la contraseña y las sesiones del usuario y devuelve su nuevo enlace."""
    token = seguridad.nuevo_token()
    with bd.conexion() as c:
        fila = c.execute("SELECT rol FROM usuarios WHERE usuario = %s", (usuario,)).fetchone()
        if not fila:
            raise KeyError(usuario)
        c.execute("DELETE FROM enlaces WHERE usuario = %s", (usuario,))
        c.execute("DELETE FROM sesiones WHERE usuario = %s", (usuario,))
        if fila["rol"] in ("admin", "sbp"):
            clave = seguridad.clave_aleatoria()
            c.execute("UPDATE usuarios SET clave_hash = %s, fallos = 0, bloqueado_hasta = NULL WHERE usuario = %s",
                      (seguridad.hash_clave(clave), usuario))
            c.execute("INSERT INTO enlaces (token_hash, usuario, tipo, cifrado, caduca) "
                      "VALUES (%s, %s, 'revelar', %s, now() + interval '24 hours')",
                      (seguridad.huella(token), usuario, seguridad.cifrar_para_enlace(token, clave)))
            return f"{URL}/revelar#{token}"
        c.execute("UPDATE usuarios SET clave_hash = NULL, fallos = 0, bloqueado_hasta = NULL WHERE usuario = %s",
                  (usuario,))
        c.execute("INSERT INTO enlaces (token_hash, usuario, tipo, caduca) "
                  "VALUES (%s, %s, 'activar', now() + interval '24 hours')",
                  (seguridad.huella(token), usuario))
        return f"{URL}/activar#{token}"


def iniciar() -> None:
    bd.iniciar()
    with bd.conexion() as c:
        existentes = {f["usuario"] for f in c.execute("SELECT usuario FROM usuarios").fetchall()}
        for usuario, nombre, rol in USUARIOS:
            if usuario not in existentes:
                c.execute("INSERT INTO usuarios (usuario, nombre, rol) VALUES (%s, %s, %s)", (usuario, nombre, rol))
    for usuario, nombre, _ in USUARIOS:
        if usuario not in existentes:
            print(f"{nombre:6} {crear_enlace(usuario)}")
    if existentes:
        print("Ya existían:", ", ".join(sorted(existentes)), "(usa «enlace <usuario>» para darles uno nuevo)")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "iniciar":
        iniciar()
    elif len(sys.argv) == 3 and sys.argv[1] == "enlace":
        print(crear_enlace(sys.argv[2].lower()))
    else:
        print(__doc__)
        sys.exit(1)
