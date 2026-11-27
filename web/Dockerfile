# Web de Syntropy: inicio de sesión, datos, panel y puente hacia el analista aislado.
FROM python:3.12-slim@sha256:5e2bdb1b0d542d5039cffb8181c65930093949194a65c365dfb1b0fe13a4fa5b
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
 && useradd -u 1000 -m web \
 && mkdir -p /datos/conjuntos && chown -R 1000:1000 /datos
COPY app ./app
COPY static ./static
USER 1000
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/salud', timeout=4)"]
CMD ["uvicorn", "app.principal:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
