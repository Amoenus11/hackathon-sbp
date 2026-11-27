#!/usr/bin/env python3
"""Implementación de REFERENCIA del reto «Rankings de crédito» (Hackathon SBP 2026).

Se escribió solo a partir de docs/INDICACIONES_RETO_RANKING_CREDITO.md, sin mirar el motor
JavaScript de la aplicación, para comprobar que las dos implementaciones dan exactamente lo mismo.

- Solo biblioteca estándar de Python 3.12 (csv). Los códigos se leen como texto (conservan
  los ceros a la izquierda: «07», «001»).
- Todos los montos se suman en CENTAVOS ENTEROS (int); nunca se usa punto flotante.
- Cada período sale del campo Fecha de cada fila, no del nombre del archivo.

Uso:  python3 -I verificacion/referencia.py datos/reto salida/
Escribe en salida/: rankings.csv, desglose.csv, calidad.csv, movimientos.csv y excluidas.csv.
"""
import csv
import os
import re
import sys
from collections import Counter, defaultdict

# Orden fijo de los rankings (Sección 5 de las indicaciones)
ORDEN_RANKINGS = ["HIPOTECARIO", "CONSTRUCCION", "INDUSTRIA", "AGROPECUARIO", "COMERCIO", "CONSUMO"]

# Regla especial de CONSUMO (Sección 6)
CINU_CREDITO_PERSONAL = "K.64.649.6492.64921"
CINU_AUTOMOVIL = "K.64.649.6492.64922"
CINU_TARJETA = "K.64.649.6499.64991"
FACILIDAD_AUTO = "03"
FACILIDAD_TARJETA = "07"

MONTO = re.compile(r"^(-?)(\d+)\.(\d{2})$")
FECHA = re.compile(r"^\d{8}$")

# Campos del AT03 que usa el cálculo (el resto se valida solo en el esquema)
USADOS = ["Fecha", "Codigo_Banco", "Facilidad_Crediticia", "Destino", "Numero_Prestamo",
          "Tipo_Actividad", "Saldo"]


# ------------------------------------------------------------------ utilidades exactas
def a_centavos(texto):
    """'1234.56' → 123456 ; '-0.50' → -50. Falla si el formato no es el del reto."""
    m = MONTO.match(texto)
    if not m:
        raise ValueError(f"monto con formato inesperado: {texto!r}")
    signo, enteros, decimales = m.groups()
    c = int(enteros) * 100 + int(decimales)
    return -c if signo else c


def monto(c):
    """123456 → '1234.56' ; -50 → '-0.50'."""
    signo = "-" if c < 0 else ""
    c = abs(c)
    return f"{signo}{c // 100}.{c % 100:02d}"


def porcentaje_4(numerador, denominador):
    """numerador / denominador × 100 con 4 decimales y redondeo aritmético
    (la mitad se aleja de cero), todo con enteros. None si el denominador es 0."""
    if denominador == 0:
        return None
    n = numerador * 100 * 10_000          # en diezmilésimas de punto porcentual
    negativo = (n < 0) != (denominador < 0)
    q, r = divmod(abs(n), abs(denominador))
    if 2 * r >= abs(denominador):
        q += 1
    texto = f"{q // 10_000}.{q % 10_000:04d}"
    return f"-{texto}" if negativo and q != 0 else texto


def leer_dict(ruta):
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def escribir(ruta, encabezado, filas):
    with open(ruta, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(encabezado)
        w.writerows(filas)


# ------------------------------------------------------------------ catálogos
def leer_catalogos(directorio):
    dic = [r["Campo"] for r in leer_dict(os.path.join(directorio, "Diccionario_datos_AT03_reto.csv"))]
    cinu = {}
    subs_por_macro = defaultdict(list)          # en el orden del catálogo
    for r in leer_dict(os.path.join(directorio, "Catalogo_CINU_SB109_reto.csv")):
        codigo, macro, sub = r["Codigo_CINU"], r["Macroactividad_Reto"], r["Subactividad_Reto"]
        if codigo in cinu:
            raise SystemExit(f"Catálogo CINU con código repetido: {codigo}")
        cinu[codigo] = (macro, sub)
        if sub not in subs_por_macro[macro]:
            subs_por_macro[macro].append(sub)
    if set(subs_por_macro) != set(ORDEN_RANKINGS):
        raise SystemExit(f"El catálogo trae macroactividades inesperadas: {sorted(subs_por_macro)}")
    bancos = {}
    for r in leer_dict(os.path.join(directorio, "Bancos_ficticios.csv")):
        bancos[r["Codigo_Banco"]] = r["Nombre_Ficticio"]
    sb21 = {r["Codigo"] for r in leer_dict(os.path.join(directorio, "Tabla_SB21_simplificada.csv"))}
    for codigo in (CINU_CREDITO_PERSONAL, CINU_AUTOMOVIL, CINU_TARJETA):
        if codigo not in cinu or cinu[codigo][0] != "CONSUMO":
            raise SystemExit(f"El catálogo no trae {codigo} en CONSUMO")
    return dic, cinu, dict(subs_por_macro), bancos, sb21


# ------------------------------------------------------------------ lectura AT03
def leer_at03(directorio, campos_dic):
    """Devuelve {fecha: [fila, ...]} en el orden de lectura (archivos por nombre, filas en orden)
    y la lista de problemas de esquema. Cada fila es un dict con los campos usados + archivo y fila."""
    archivos = sorted(f for f in os.listdir(directorio) if f.startswith("AT03_") and f.lower().endswith(".csv"))
    if not archivos:
        raise SystemExit("No hay archivos AT03_*.csv")
    periodos = defaultdict(list)
    archivos_por_fecha = defaultdict(list)
    problemas = []
    for nombre in archivos:
        with open(os.path.join(directorio, nombre), encoding="utf-8-sig", newline="") as f:
            lector = csv.reader(f)
            encabezado = next(lector)
            if encabezado != campos_dic:
                faltan = [c for c in campos_dic if c not in encabezado]
                sobran = [c for c in encabezado if c not in campos_dic]
                problemas.append(f"{nombre}: encabezado distinto del diccionario "
                                 f"({len(encabezado)} columnas; faltan {faltan}; sobran {sobran})")
            pos = {c: encabezado.index(c) for c in USADOS}
            for n, valores in enumerate(lector, start=1):
                if len(valores) != len(encabezado):
                    raise SystemExit(f"{nombre} fila {n}: {len(valores)} columnas en vez de {len(encabezado)}")
                fila = {c: valores[pos[c]] for c in USADOS}
                if not FECHA.match(fila["Fecha"]):
                    raise SystemExit(f"{nombre} fila {n}: Fecha inválida {fila['Fecha']!r}")
                fila["saldo_c"] = a_centavos(fila["Saldo"])
                fila["archivo"] = nombre
                fila["fila"] = n
                periodos[fila["Fecha"]].append(fila)
                if nombre not in archivos_por_fecha[fila["Fecha"]]:
                    archivos_por_fecha[fila["Fecha"]].append(nombre)
    return dict(periodos), dict(archivos_por_fecha), problemas


# ------------------------------------------------------------------ cálculo por período
def procesar_periodo(fecha, filas, cinu, subs_por_macro, bancos, sb21):
    nombre_tarjeta = cinu[CINU_TARJETA][1]
    nombre_credito_personal = cinu[CINU_CREDITO_PERSONAL][1]
    excluidas = []
    cascada = Counter()
    independientes = Counter()
    primera = {}                       # Numero_Prestamo -> fila de su primera ocurrencia
    universo = []

    for r in filas:
        # Conteos independientes (cada regla sobre TODAS las filas leídas, solo informativos)
        if r["Numero_Prestamo"] in primera:
            independientes["E1"] += 1
        if r["Destino"] != "L":
            independientes["E2"] += 1
        if r["saldo_c"] <= 0:
            independientes["E3"] += 1
        if r["Tipo_Actividad"] not in cinu:
            independientes["E4"] += 1

        # Cascada oficial: la fila cuenta solo en el primer filtro que incumple
        if r["Numero_Prestamo"] in primera:
            p = primera[r["Numero_Prestamo"]]
            filtro, motivo = "E1", f"Numero_Prestamo duplicado en el periodo (se conserva la fila {p['fila']} de {p['archivo']})"
        else:
            primera[r["Numero_Prestamo"]] = r
            if r["Destino"] != "L":
                filtro, motivo = "E2", f"Destino extranjero ({r['Destino']})"
            elif r["saldo_c"] <= 0:
                filtro, motivo = "E3", f"Saldo no positivo ({r['Saldo']})"
            elif r["Tipo_Actividad"] not in cinu:
                filtro, motivo = "E4", f"Actividad no catalogada ({r['Tipo_Actividad']})"
            else:
                filtro = None
        if filtro:
            cascada[filtro] += 1
            excluidas.append([fecha, r["fila"], r["Numero_Prestamo"], r["Codigo_Banco"], filtro, motivo])
        else:
            universo.append(r)

    # Clasificación + regla SB21 de CONSUMO
    sub_saldo = defaultdict(int)       # (macro, banco, sub) -> centavos
    sub_ops = defaultdict(int)
    act_saldo = defaultdict(int)       # (macro, banco) -> centavos, sumado DIRECTO de las filas
    act_ops = defaultdict(int)
    total_banco = defaultdict(int)     # banco -> centavos, sobre todo el universo
    alertas = Counter()
    reclasificadas = Counter()         # banco -> n.º de operaciones de Crédito personal con facilidad 07
    for r in universo:
        macro, sub = cinu[r["Tipo_Actividad"]]
        act = r["Tipo_Actividad"]
        fac = r["Facilidad_Crediticia"]
        if act == CINU_CREDITO_PERSONAL:
            if fac == FACILIDAD_TARJETA:
                sub = nombre_tarjeta
                reclasificadas[r["Codigo_Banco"]] += 1
            else:
                sub = nombre_credito_personal
        elif act == CINU_AUTOMOVIL and fac != FACILIDAD_AUTO:
            alertas["CINU Automovil con facilidad distinta de 03 (se mantiene Automovil)"] += 1
        elif act == CINU_TARJETA and fac != FACILIDAD_TARJETA:
            alertas["CINU Tarjeta con facilidad distinta de 07 (se mantiene Tarjeta)"] += 1
        b = r["Codigo_Banco"]
        sub_saldo[(macro, b, sub)] += r["saldo_c"]
        sub_ops[(macro, b, sub)] += 1
        act_saldo[(macro, b)] += r["saldo_c"]
        act_ops[(macro, b)] += 1
        total_banco[b] += r["saldo_c"]

    # Integridad referencial (alertas, no excluyen)
    for r in filas:
        if r["Codigo_Banco"] not in bancos:
            alertas[f"Codigo_Banco fuera del catalogo ({r['Codigo_Banco']})"] += 1
        if r["Facilidad_Crediticia"] not in sb21:
            alertas[f"Facilidad_Crediticia fuera de SB21 ({r['Facilidad_Crediticia']})"] += 1

    saldo_universo = sum(r["saldo_c"] for r in universo)
    codigos = sorted(bancos)

    # Rankings: siempre los 12 bancos; saldo desc, desempate Codigo_Banco asc
    rankings = {}
    for macro in ORDEN_RANKINGS:
        orden = sorted(codigos, key=lambda b: (-act_saldo.get((macro, b), 0), b))
        rankings[macro] = [(pos, b) for pos, b in enumerate(orden, start=1)]

    # Reconciliaciones
    r1 = [(m, b) for m in ORDEN_RANKINGS for b in codigos
          if sum(sub_saldo.get((m, b, s), 0) for s in subs_por_macro[m]) != act_saldo.get((m, b), 0)]
    r2 = [b for b in codigos
          if sum(act_saldo.get((m, b), 0) for m in ORDEN_RANKINGS) != total_banco.get(b, 0)]
    r3_ok = sum(total_banco.get(b, 0) for b in codigos) == saldo_universo
    unicos = len({r["Numero_Prestamo"] for r in universo}) == len(universo)
    identidad = len(filas) == sum(cascada.values()) + len(universo)

    return {
        "fecha": fecha, "leidas": len(filas), "cascada": cascada, "independientes": independientes,
        "universo": universo, "saldo_universo": saldo_universo, "excluidas": excluidas,
        "sub_saldo": sub_saldo, "sub_ops": sub_ops, "act_saldo": act_saldo, "act_ops": act_ops,
        "total_banco": total_banco, "rankings": rankings, "alertas": alertas,
        "reclasificadas": reclasificadas, "r1": r1, "r2": r2, "r3_ok": r3_ok,
        "unicos": unicos, "identidad": identidad,
    }


# ------------------------------------------------------------------ principal
def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    entrada, salida = sys.argv[1], sys.argv[2]
    os.makedirs(salida, exist_ok=True)
    campos_dic, cinu, subs_por_macro, bancos, sb21 = leer_catalogos(entrada)
    periodos, archivos_por_fecha, problemas = leer_at03(entrada, campos_dic)
    fechas = sorted(periodos)
    res = {f: procesar_periodo(f, periodos[f], cinu, subs_por_macro, bancos, sb21) for f in fechas}
    codigos = sorted(bancos)

    # rankings.csv
    filas = []
    for f in fechas:
        p = res[f]
        for macro in ORDEN_RANKINGS:
            for pos, b in p["rankings"][macro]:
                s = p["act_saldo"].get((macro, b), 0)
                t = p["total_banco"].get(b, 0)
                pond = porcentaje_4(s, t) or "0.0000"
                filas.append([f, macro, pos, b, bancos[b], monto(s), monto(t), pond, p["act_ops"].get((macro, b), 0)])
    escribir(os.path.join(salida, "rankings.csv"),
             ["Fecha", "Ranking", "Posicion", "Codigo_Banco", "Banco", "Saldo_Actividad",
              "Total_Cartera_Local_Valida", "Ponderacion_Pct", "Operaciones_Validas"], filas)

    # desglose.csv (todas las combinaciones; 0.00 si no hay saldo)
    filas = []
    for f in fechas:
        p = res[f]
        for macro in ORDEN_RANKINGS:
            for b in codigos:
                for sub in subs_por_macro[macro]:
                    filas.append([f, macro, sub, b, monto(p["sub_saldo"].get((macro, b, sub), 0))])
    escribir(os.path.join(salida, "desglose.csv"),
             ["Fecha", "Ranking", "Subactividad", "Codigo_Banco", "Saldo"], filas)

    # calidad.csv
    filas = []
    for f in fechas:
        p = res[f]
        c = p["cascada"]
        filas.append([f, p["leidas"], c["E1"], c["E2"], c["E3"], c["E4"], len(p["universo"]),
                      monto(p["saldo_universo"]), "SI" if p["identidad"] else "NO"])
    escribir(os.path.join(salida, "calidad.csv"),
             ["Fecha", "Filas_Leidas", "E1_Duplicados", "E2_Destino_Extranjero", "E3_Saldo_No_Positivo",
              "E4_Actividad_No_Catalogada", "Universo_Local_Valido", "Saldo_Universo_Local_Valido", "Cuadra"], filas)

    # excluidas.csv
    filas = [e for f in fechas for e in res[f]["excluidas"]]
    escribir(os.path.join(salida, "excluidas.csv"),
             ["Fecha", "Fila", "Numero_Prestamo", "Codigo_Banco", "Filtro", "Motivo"], filas)

    # movimientos.csv (períodos consecutivos)
    filas = []
    for ant, act in zip(fechas, fechas[1:]):
        pa, pc = res[ant], res[act]
        for macro in ORDEN_RANKINGS:
            pos_ant = {b: pos for pos, b in pa["rankings"][macro]}
            for pos, b in pc["rankings"][macro]:
                s_ant = pa["act_saldo"].get((macro, b), 0)
                s_act = pc["act_saldo"].get((macro, b), 0)
                var = s_act - s_ant
                var_pct = porcentaje_4(var, s_ant)
                filas.append([ant, act, macro, b, bancos[b], pos_ant[b], pos, pos_ant[b] - pos,
                              monto(s_ant), monto(s_act), monto(var), var_pct if var_pct is not None else "NA", "", ""])
    escribir(os.path.join(salida, "movimientos.csv"),
             ["Fecha_Anterior", "Fecha_Actual", "Ranking", "Codigo_Banco", "Banco", "Posicion_Anterior",
              "Posicion_Actual", "Cambio_Posicion", "Saldo_Anterior", "Saldo_Actual", "Var_Saldo",
              "Var_Saldo_Pct", "Significativo", "Motivo"], filas)

    # ---------------- resumen en pantalla
    print("Esquema:", "OK (61 columnas en el orden del diccionario)" if not problemas else "; ".join(problemas))
    for f in fechas:
        p = res[f]
        c = p["cascada"]
        i = p["independientes"]
        print(f"\n== {f} ({', '.join(archivos_por_fecha[f])})")
        print(f"  leídas {p['leidas']} = E1 {c['E1']} + E2 {c['E2']} + E3 {c['E3']} + E4 {c['E4']} "
              f"+ universo {len(p['universo'])}  → {'cuadra' if p['identidad'] else 'NO CUADRA'}")
        print(f"  conteo independiente por regla (informativo): E1 {i['E1']} · E2 {i['E2']} · E3 {i['E3']} · E4 {i['E4']}")
        print(f"  saldo universo {monto(p['saldo_universo'])} · préstamos únicos en el universo: {'sí' if p['unicos'] else 'NO'}")
        print(f"  R1 {'cuadra' if not p['r1'] else 'NO: ' + str(p['r1'][:5])} · "
              f"R2 {'cuadra' if not p['r2'] else 'NO: ' + str(p['r2'][:5])} · R3 {'cuadra' if p['r3_ok'] else 'NO'}")
        print(f"  reclasificadas a Tarjeta (Crédito personal + facilidad 07): {sum(p['reclasificadas'].values())}")
        print(f"  alertas: {dict(p['alertas']) if p['alertas'] else 'ninguna'}")
        lideres = []
        for macro in ORDEN_RANKINGS:
            b = p["rankings"][macro][0][1]
            lideres.append(f"{macro} {b} {bancos[b]} {monto(p['act_saldo'].get((macro, b), 0))}")
        print("  líderes: " + " | ".join(lideres))
    print(f"\nArchivos escritos en {salida}")


if __name__ == "__main__":
    main()
