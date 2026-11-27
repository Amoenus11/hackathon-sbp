"""Conexión a PostgreSQL: usuarios, sesiones, auditoría y paneles (la parte «operativa»).

Los datos que se analizan viven aparte, en Parquet (ver datos.py): PostgreSQL para operar,
DuckDB/Parquet para analizar.
"""
import json
import os
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

ESQUEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
  usuario          text PRIMARY KEY,
  nombre           text NOT NULL,
  rol              text NOT NULL CHECK (rol IN ('admin', 'equipo', 'sbp')),
  clave_hash       text,
  fallos           int  NOT NULL DEFAULT 0,
  bloqueado_hasta  timestamptz,
  ultimo_acceso    timestamptz,
  creado           timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS enlaces (
  token_hash  text PRIMARY KEY,
  usuario     text NOT NULL REFERENCES usuarios ON DELETE CASCADE,
  tipo        text NOT NULL CHECK (tipo IN ('activar', 'revelar')),
  cifrado     bytea,
  caduca      timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash  text PRIMARY KEY,
  usuario     text NOT NULL REFERENCES usuarios ON DELETE CASCADE,
  creada      timestamptz NOT NULL DEFAULT now(),
  caduca      timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS auditoria (
  id       bigserial PRIMARY KEY,
  cuando   timestamptz NOT NULL DEFAULT now(),
  usuario  text,
  accion   text NOT NULL,
  detalle  jsonb,
  ip       text
);
CREATE INDEX IF NOT EXISTS auditoria_ip ON auditoria (ip, cuando) WHERE accion = 'entrar_falla';
CREATE TABLE IF NOT EXISTS paneles (
  id       bigserial PRIMARY KEY,
  creado   timestamptz NOT NULL DEFAULT now(),
  usuario  text,
  datos    jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS fijados (
  id       bigserial PRIMARY KEY,
  creado   timestamptz NOT NULL DEFAULT now(),
  usuario  text,
  datos    jsonb NOT NULL
);
"""


def _dsn() -> str:
    return psycopg.conninfo.make_conninfo(
        host=os.environ.get("DB_HOST", "hackathon-db"),
        dbname=os.environ.get("POSTGRES_DB", "hackathon"),
        user=os.environ.get("POSTGRES_USER", "hackathon"),
        password=os.environ.get("POSTGRES_PASSWORD", ""),
        connect_timeout=5,
    )


@contextmanager
def conexion():
    with psycopg.connect(_dsn(), row_factory=dict_row, autocommit=True) as c:
        yield c


def iniciar() -> None:
    with conexion() as c:
        c.execute(ESQUEMA)


def auditar(usuario: str | None, accion: str, detalle: dict | None = None, ip: str | None = None) -> None:
    try:
        with conexion() as c:
            c.execute(
                "INSERT INTO auditoria (usuario, accion, detalle, ip) VALUES (%s, %s, %s, %s)",
                (usuario, accion, json.dumps(detalle or {}, ensure_ascii=False), ip),
            )
    except Exception as e:  # la auditoría nunca debe tumbar la petición
        print("auditoría falló:", type(e).__name__, flush=True)
