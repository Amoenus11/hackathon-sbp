"""Contraseñas, enlaces de un solo uso y sesiones.

- Las contraseñas se guardan con scrypt (biblioteca estándar), nunca en claro.
- Los enlaces y las sesiones se guardan como huella SHA-256: si alguien leyera la base
  de datos, no podría usarlos.
- Las contraseñas aleatorias (Admin y SBP) se entregan con un enlace que las muestra
  UNA sola vez; en la base solo queda una versión cifrada con una llave que viaja en
  el propio enlace.
"""
import base64
import hashlib
import hmac
import os
import re
import secrets
import unicodedata

N, R, P = 2**15, 8, 1
MAXMEM = 64 * 1024 * 1024

# Sin caracteres que se confundan (0/O, 1/l/I)
ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_clave(clave: str) -> str:
    sal = os.urandom(16)
    dk = hashlib.scrypt(clave.encode(), salt=sal, n=N, r=R, p=P, maxmem=MAXMEM, dklen=32)
    return f"scrypt${N}${R}${P}${_b64(sal)}${_b64(dk)}"


# Para que un usuario inexistente tarde lo mismo que uno real
_HASH_FALSO = hash_clave(secrets.token_urlsafe(16))


def verificar_clave(clave: str, guardado: str | None) -> bool:
    objetivo = guardado or _HASH_FALSO
    try:
        _, n, r, p, sal, dk = objetivo.split("$")
        calc = hashlib.scrypt(clave.encode(), salt=_unb64(sal), n=int(n), r=int(r), p=int(p),
                              maxmem=MAXMEM, dklen=32)
        return hmac.compare_digest(calc, _unb64(dk)) and guardado is not None
    except Exception:
        return False


def nuevo_token() -> str:
    return secrets.token_urlsafe(32)


def huella(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def clave_aleatoria() -> str:
    """25 caracteres en 5 grupos (~143 bits): imposible de adivinar, fácil de copiar."""
    while True:
        c = "".join(secrets.choice(ALFABETO) for _ in range(25))
        if re.search(r"[a-z]", c) and re.search(r"[A-Z]", c) and re.search(r"\d", c):
            return "-".join(c[i:i + 5] for i in range(0, 25, 5))


def _flujo(token: str, largo: int) -> bytes:
    return hashlib.shake_256(b"revelar:" + token.encode()).digest(largo)


def cifrar_para_enlace(token: str, texto: str) -> bytes:
    datos = texto.encode()
    return bytes(a ^ b for a, b in zip(datos, _flujo(token, len(datos))))


def descifrar_de_enlace(token: str, cifrado: bytes) -> str:
    return bytes(a ^ b for a, b in zip(cifrado, _flujo(token, len(cifrado)))).decode()


COMUNES = {
    "password", "contrasena", "contraseña", "qwerty", "123456", "1234567", "12345678",
    "abc123", "111111", "iloveyou", "admin", "letmein", "welcome", "monkey", "dragon",
    "football", "panama", "superintendencia", "banco", "bancos", "hackaton", "hackathon",
}
PROHIBIDAS = ["syntropy", "sbp", "fisc", "utp", "hackat", "panama", "password", "contras",
              "qwerty", "asdf", "1234", "abcd", "admin"]


def _normal(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def revisar_politica(clave: str, usuario: str) -> list[str]:
    """Devuelve la lista de reglas que NO se cumplen (vacía = aceptada)."""
    fallas = []
    clases = sum(bool(re.search(p, clave)) for p in (r"[a-z]", r"[A-Z]", r"\d", r"[^A-Za-z0-9]"))
    if len(clave) < 14:
        fallas.append("Al menos 14 caracteres.")
    if len(clave) > 128:
        fallas.append("Máximo 128 caracteres.")
    if clases < 3 and len(clave) < 20:
        fallas.append("Mezcla al menos 3 tipos: minúsculas, mayúsculas, números y símbolos (o usa una frase de 20+ caracteres).")
    n = _normal(clave)
    if _normal(usuario) in n:
        fallas.append("No puede contener tu nombre de usuario.")
    if any(p in n for p in PROHIBIDAS) or n in COMUNES:
        fallas.append("Evita palabras obvias (syntropy, sbp, panamá, 1234, qwerty…).")
    if re.search(r"(.)\1\1\1", clave):
        fallas.append("No repitas el mismo carácter 4 veces seguidas.")
    if len(set(clave)) < 8:
        fallas.append("Usa al menos 8 caracteres distintos.")
    return fallas
