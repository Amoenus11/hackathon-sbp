"""Conjuntos de datos: se suben (CSV, Excel, JSON o Parquet), se limpian y se guardan en Parquet.

El analista aislado los ve en solo lectura en /datos (catalogo.json + conjuntos/*.parquet).
"""
import io
import json
import os
import re
import tempfile
import unicodedata
from datetime import datetime, timezone

import pandas as pd

RAIZ = os.environ.get("DATOS", "/datos")
CATALOGO = os.path.join(RAIZ, "catalogo.json")
CARPETA = os.path.join(RAIZ, "conjuntos")
MAX_BYTES = 60 * 1024 * 1024


def _slug(s: str, defecto: str = "col") -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    if not s:
        s = defecto
    if s[0].isdigit():
        s = f"{defecto}_{s}"
    return s[:60]


def leer_catalogo() -> dict:
    try:
        with open(CATALOGO, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"conjuntos": []}


def _guardar_catalogo(cat: dict) -> None:
    os.makedirs(RAIZ, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=RAIZ, prefix=".catalogo-")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(cat, f, ensure_ascii=False, indent=1, default=str)
    os.chmod(tmp, 0o644)
    os.replace(tmp, CATALOGO)


def _limpiar(df: pd.DataFrame) -> pd.DataFrame:
    df = df.dropna(how="all").dropna(axis=1, how="all")
    nombres, vistos = [], {}
    for c in df.columns:
        base = _slug(c)
        vistos[base] = vistos.get(base, 0) + 1
        nombres.append(base if vistos[base] == 1 else f"{base}_{vistos[base]}")
    df.columns = nombres
    for c in df.columns:
        s = df[c]
        if s.dtype == object or pd.api.types.is_string_dtype(s):
            txt = s.dropna().astype(str).str.strip()
            if txt.empty:
                continue
            # ¿números? (acepta «1,234.56», «$ 1200» y «12%»)
            num = pd.to_numeric(txt.str.replace(r"[\s$%]", "", regex=True).str.replace(",", "", regex=False),
                                errors="coerce")
            if num.notna().mean() >= 0.95:
                df[c] = pd.to_numeric(s.astype(str).str.replace(r"[\s$%]", "", regex=True).str.replace(",", "", regex=False), errors="coerce")
                continue
            # ¿fechas?
            if txt.str.contains(r"\d{1,4}[-/]\d{1,2}[-/]\d{1,4}").mean() >= 0.9:
                fechas = pd.to_datetime(s, errors="coerce", dayfirst=not txt.str.match(r"^\d{4}-").all())
                if fechas.notna().mean() >= 0.9:
                    df[c] = fechas
                    continue
            df[c] = s.astype("string")
    return df.reset_index(drop=True)


def _leer(nombre_archivo: str, contenido: bytes) -> dict[str, pd.DataFrame]:
    ext = os.path.splitext(nombre_archivo.lower())[1]
    b = io.BytesIO(contenido)
    if ext in (".xlsx", ".xlsm", ".xls"):
        hojas = pd.read_excel(b, sheet_name=None)
        return {h: df for h, df in hojas.items() if not df.empty}
    if ext == ".parquet":
        return {"": pd.read_parquet(b)}
    if ext == ".json":
        return {"": pd.read_json(b)}
    if ext in (".csv", ".txt", ".tsv"):
        for cod in ("utf-8-sig", "latin-1"):
            try:
                return {"": pd.read_csv(io.BytesIO(contenido), sep=None, engine="python", encoding=cod)}
            except UnicodeDecodeError:
                continue
    raise ValueError("Formato no soportado. Usa CSV, Excel (.xlsx), JSON o Parquet.")


def _perfil(df: pd.DataFrame) -> list[dict]:
    cols = []
    for c in df.columns:
        s = df[c]
        info = {"nombre": c, "tipo": str(s.dtype), "nulos_pct": round(float(s.isna().mean() * 100), 1)}
        if pd.api.types.is_numeric_dtype(s) and s.notna().any():
            info.update(min=float(s.min()), max=float(s.max()), media=round(float(s.mean()), 4))
        elif pd.api.types.is_datetime64_any_dtype(s) and s.notna().any():
            info.update(desde=str(s.min().date()), hasta=str(s.max().date()))
        else:
            info["distintos"] = int(s.nunique())
            top = s.dropna().astype(str).value_counts().head(3).index.tolist()
            info["ejemplos"] = [t[:40] for t in top]
        cols.append(info)
    return cols


def guardar_subida(nombre_archivo: str, contenido: bytes, descripcion: str, usuario: str) -> list[dict]:
    if len(contenido) > MAX_BYTES:
        raise ValueError("El archivo supera 60 MB.")
    tablas = _leer(nombre_archivo, contenido)
    if not tablas:
        raise ValueError("El archivo no tiene datos.")
    os.makedirs(CARPETA, exist_ok=True)
    cat = leer_catalogo()
    base = _slug(os.path.splitext(os.path.basename(nombre_archivo))[0], "datos")
    nuevos = []
    for hoja, df in tablas.items():
        df = _limpiar(df)
        nombre = base if not hoja or len(tablas) == 1 else f"{base}__{_slug(hoja, 'hoja')}"
        ruta = os.path.join(CARPETA, f"{nombre}.parquet")
        tmp = ruta + ".tmp"
        df.to_parquet(tmp, index=False)
        os.chmod(tmp, 0o644)
        os.replace(tmp, ruta)
        entrada = {
            "nombre": nombre,
            "archivo_parquet": f"conjuntos/{nombre}.parquet",
            "origen": nombre_archivo + (f" (hoja {hoja})" if hoja and len(tablas) > 1 else ""),
            "descripcion": descripcion[:500],
            "filas": int(len(df)),
            "columnas": _perfil(df),
            "subido_por": usuario,
            "subido": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        cat["conjuntos"] = [c for c in cat["conjuntos"] if c["nombre"] != nombre] + [entrada]
        nuevos.append(entrada)
    _guardar_catalogo(cat)
    return nuevos


def borrar(nombre: str) -> bool:
    cat = leer_catalogo()
    resto = [c for c in cat["conjuntos"] if c["nombre"] != nombre]
    if len(resto) == len(cat["conjuntos"]):
        return False
    cat["conjuntos"] = resto
    _guardar_catalogo(cat)
    ruta = os.path.join(CARPETA, f"{_slug(nombre, 'datos')}.parquet")
    if os.path.exists(ruta):
        os.remove(ruta)
    return True


def muestra(nombre: str, filas: int = 50) -> dict:
    cat = leer_catalogo()
    entrada = next((c for c in cat["conjuntos"] if c["nombre"] == nombre), None)
    if not entrada:
        raise KeyError(nombre)
    df = pd.read_parquet(os.path.join(RAIZ, entrada["archivo_parquet"])).head(filas)
    return {"columnas": list(df.columns), "filas": json.loads(df.to_json(orient="values", date_format="iso"))}
