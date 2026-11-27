# Analista aislado de Syntropy: Claude Code sin pantalla + Python para analizar datos.
# Sin root, sin internet (solo hackathon-salida), sin clave real, datos en solo lectura.
FROM python:3.12-slim@sha256:5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    LANG=C.UTF-8 \
    HOME=/tmp/casa \
    DISABLE_AUTOUPDATER=1 \
    DISABLE_TELEMETRY=1 \
    DISABLE_ERROR_REPORTING=1 \
    DISABLE_BUG_COMMAND=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1

WORKDIR /app
COPY requirements.txt /app/requirements.txt
# claude-agent-sdk trae el binario de Claude Code (2.1.332) en claude_agent_sdk/_bundled/claude:
# lo enlazamos a /usr/local/bin/claude y comprobamos que arranca.
RUN pip install --no-cache-dir -r /app/requirements.txt \
 && ln -s "$(python -c 'import claude_agent_sdk, pathlib; print(pathlib.Path(claude_agent_sdk.__file__).parent / "_bundled" / "claude")')" /usr/local/bin/claude \
 && HOME=/tmp/prueba-version claude --version \
 && rm -rf /tmp/prueba-version

RUN useradd --uid 1000 --user-group --no-create-home --home-dir /tmp/casa --shell /bin/bash analista

COPY servidor.py explicador.py instrucciones.md instrucciones_observatorio.md esquema_respuesta.json /app/

USER 1000:1000
EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8100/salud', timeout=4).status == 200 else 1)"]
CMD ["uvicorn", "servidor:app", "--host", "0.0.0.0", "--port", "8100", "--no-access-log"]
