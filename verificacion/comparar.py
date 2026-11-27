#!/usr/bin/env python3
"""Compara dos juegos de exportaciones del reto, celda por celda y sin tolerancia.

Uso:  python3 -I verificacion/comparar.py dirA dirB [--estricto]

- Compara rankings.csv, desglose.csv, calidad.csv, movimientos.csv y excluidas.csv.
- Empareja las filas por su llave (p. ej. Fecha + Ranking + Posicion) y luego compara cada celda.
- Montos, porcentajes y conteos se comparan como Decimal exacto (tolerancia 0): "1.50" == "1.5".
  Los códigos y textos se comparan tal cual (así "07" ≠ "7").
- Cuadra / Significativo aceptan SI/NO, true/false o 1/0. NA, vacío y null son equivalentes.
- Por defecto NO compara las columnas descriptivas que dependen de la redacción o de la regla
  configurable de la app: Motivo (excluidas y movimientos) y Significativo (movimientos).
  Con --estricto también las compara.
Imprime «IDÉNTICOS» si todo coincide; si no, hasta 20 diferencias por archivo y sale con código 1.
"""
import csv
import os
import sys
from decimal import Decimal, InvalidOperation

ARCHIVOS = {
    "rankings.csv": ["Fecha", "Ranking", "Posicion"],
    "desglose.csv": ["Fecha", "Ranking", "Codigo_Banco", "Subactividad"],
    "calidad.csv": ["Fecha"],
    "movimientos.csv": ["Fecha_Anterior", "Fecha_Actual", "Ranking", "Codigo_Banco"],
    "excluidas.csv": ["Fecha", "Fila", "Numero_Prestamo"],
}
NUMERICAS = {
    "Posicion", "Saldo_Actividad", "Total_Cartera_Local_Valida", "Ponderacion_Pct", "Operaciones_Validas",
    "Saldo", "Filas_Leidas", "E1_Duplicados", "E2_Destino_Extranjero", "E3_Saldo_No_Positivo",
    "E4_Actividad_No_Catalogada", "Universo_Local_Valido", "Saldo_Universo_Local_Valido",
    "Posicion_Anterior", "Posicion_Actual", "Cambio_Posicion", "Saldo_Anterior", "Saldo_Actual",
    "Var_Saldo", "Var_Saldo_Pct", "Fila",
}
BOOLEANAS = {"Cuadra", "Significativo"}
DESCRIPTIVAS = {"movimientos.csv": {"Significativo", "Motivo"}, "excluidas.csv": {"Motivo"}}
NULOS = {"", "NA", "N/A", "NULL", "NONE", "NAN"}
VERDADEROS = {"SI", "SÍ", "S", "TRUE", "1", "YES", "VERDADERO"}
FALSOS = {"NO", "N", "FALSE", "0", "FALSO"}
MAX_DIFERENCIAS = 20


def leer(ruta):
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        filas = list(csv.reader(f))
    if not filas:
        return [], []
    return [c.strip() for c in filas[0]], [[c.strip() for c in fila] for fila in filas[1:] if fila]


def normal(columna, valor):
    v = valor.strip()
    if v.upper() in NULOS and columna not in BOOLEANAS:
        return ("nulo",)
    if columna in BOOLEANAS:
        u = v.upper()
        if u in VERDADEROS:
            return ("bool", True)
        if u in FALSOS or u == "":
            return ("bool", False)
        return ("texto", v)
    if columna in NUMERICAS:
        try:
            return ("num", Decimal(v))
        except InvalidOperation:
            return ("texto", v)
    return ("texto", v)


def comparar_archivo(nombre, dir_a, dir_b, estricto):
    """Devuelve (lista de diferencias, n.º de filas, avisos)."""
    ruta_a, ruta_b = os.path.join(dir_a, nombre), os.path.join(dir_b, nombre)
    for ruta in (ruta_a, ruta_b):
        if not os.path.exists(ruta):
            return [f"falta el archivo {ruta}"], 0, []
    enc_a, filas_a = leer(ruta_a)
    enc_b, filas_b = leer(ruta_b)
    difs, avisos = [], []
    if enc_a != enc_b:
        difs.append(f"encabezados distintos:\n      A: {enc_a}\n      B: {enc_b}")
        if set(enc_a) != set(enc_b):
            return difs, len(filas_a), avisos
    llave = ARCHIVOS[nombre]
    faltan_llave = [c for c in llave if c not in enc_a]
    if faltan_llave:
        return difs + [f"no trae las columnas llave {faltan_llave}"], len(filas_a), avisos
    ignorar = set() if estricto else DESCRIPTIVAS.get(nombre, set())
    columnas = [c for c in enc_a if c not in ignorar]

    def indexar(encabezado, filas, etiqueta):
        pos = {c: i for i, c in enumerate(encabezado)}
        indice, orden = {}, []
        for n, fila in enumerate(filas, start=2):
            if len(fila) != len(encabezado):
                difs.append(f"{etiqueta} línea {n}: {len(fila)} columnas en vez de {len(encabezado)}")
                continue
            k = tuple(normal(c, fila[pos[c]]) for c in llave)
            if k in indice:
                difs.append(f"{etiqueta} línea {n}: llave repetida {[fila[pos[c]] for c in llave]}")
                continue
            indice[k] = {c: fila[pos[c]] for c in encabezado}
            orden.append(k)
        return indice, orden

    ia, orden_a = indexar(enc_a, filas_a, "A")
    ib, orden_b = indexar(enc_b, filas_b, "B")
    for k in orden_a:
        if k not in ib:
            difs.append(f"solo en A: {[ia[k][c] for c in llave]}")
    for k in orden_b:
        if k not in ia:
            difs.append(f"solo en B: {[ib[k][c] for c in llave]}")
    for k in orden_a:
        if k not in ib:
            continue
        for c in columnas:
            if normal(c, ia[k][c]) != normal(c, ib[k][c]):
                difs.append(f"{[ia[k][x] for x in llave]} · {c}: A={ia[k][c]!r} B={ib[k][c]!r}")
    comunes_a = [k for k in orden_a if k in ib]
    comunes_b = [k for k in orden_b if k in ia]
    if comunes_a != comunes_b:
        avisos.append("las filas vienen en otro orden (no cuenta como diferencia)")
    return difs, len(filas_a), avisos


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    estricto = "--estricto" in sys.argv
    if len(args) != 2:
        print(__doc__)
        sys.exit(2)
    dir_a, dir_b = args
    total = 0
    for nombre in ARCHIVOS:
        difs, n, avisos = comparar_archivo(nombre, dir_a, dir_b, estricto)
        total += len(difs)
        if difs:
            print(f"✗ {nombre}: {len(difs)} diferencias")
            for d in difs[:MAX_DIFERENCIAS]:
                print("    " + d)
            if len(difs) > MAX_DIFERENCIAS:
                print(f"    … y {len(difs) - MAX_DIFERENCIAS} más")
        else:
            print(f"✓ {nombre}: idéntico ({n} filas)")
        for a in avisos:
            print(f"    aviso: {a}")
    if total:
        print(f"\nHAY DIFERENCIAS ({total})")
        sys.exit(1)
    print("\nIDÉNTICOS" + ("" if estricto else " (sin comparar Motivo ni Significativo; usa --estricto para incluirlos)"))


if __name__ == "__main__":
    main()
