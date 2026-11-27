# Analista aislado (hackathon-asistente)

Es el asistente de la página: **Claude Code sin pantalla** (`claude -p`, Claude Opus 5.5 con esfuerzo bajo)
que analiza los datos cargados y responde con un JSON fijo (`esquema_respuesta.json`): resumen para
directivos, KPIs, gráficos de ECharts, hallazgos con evidencia, alertas, recomendaciones, el SQL/Python
exacto de cada cifra y las limitaciones.

## Por qué está aislado

El aislamiento lo impone el sistema, no una promesa del modelo: aunque alguien se lo pida, no puede.

| Qué | Cómo |
| --- | --- |
| Sin internet | Solo está en la red interna `hackathon-ia`; su única salida es `hackathon-salida`. |
| Sin clave | Su clave es falsa (`sin-clave`). La real solo la tiene `hackathon-salida`, que la pone al reenviar. |
| Solo puede hablar con la IA | `hackathon-salida` reenvía únicamente `/v1/messages`, `/v1/messages/count_tokens` y `/v1/models*`. |
| Datos en solo lectura | `/datos` se monta `:ro`. Cada pregunta trabaja en su propia carpeta de `/tmp`, que se borra al final. |
| Sin root | Usuario 1000, disco de solo lectura, sin capacidades, sin `docker.sock`. |
| Gasto y tiempo acotados | `--max-budget-usd` (1.5 por pregunta y 2.5 por panel), 300 s / 480 s como máximo, 2 análisis a la vez. |
| Entorno limpio | Claude Code recibe solo PATH, HOME, LANG, `ANTHROPIC_BASE_URL`, la clave falsa y las variables `DISABLE_*`. |

## Contrato

`POST /preguntar` con `{"pregunta": "...", "modo": "pregunta"|"panel", "historial": [{"pregunta","resumen"}], "usuario": "..."}`
responde `application/x-ndjson`, un evento por línea:
`inicio` → `paso` (0 o más, con `texto` y `detalle`) → `respuesta` (con `datos`) o `error` (con `texto`) → `fin` (con `segundos`, `costo_usd` y `turnos`).
`GET /salud` responde `{"ok": true}`.

## Para el compose

- `read_only: true`, `cap_drop: [ALL]`, `no-new-privileges`, `user: "1000:1000"`.
- `tmpfs: /tmp:uid=1000,gid=1000,mode=0700,exec,size=1g`. Hace falta `exec`: Claude Code puede
  extraer y ejecutar sus ayudantes (como ripgrep) en /tmp.
- Volumen de datos en `/datos:ro`; redes: solo `hackathon-ia`.
- `mem_limit` de unos 3 GB y `pids_limit` de 300: son 2 análisis a la vez, y cada uno es Claude Code más Python.

## Cómo se prueba (dentro de la red interna)

```bash
docker exec hackathon-web python -c "import urllib.request, json; print(urllib.request.urlopen('http://hackathon-asistente:8100/salud').read())"
docker exec hackathon-web python - <<'EOF'
import json, urllib.request
pet = urllib.request.Request("http://hackathon-asistente:8100/preguntar",
    data=json.dumps({"pregunta": "¿Cuántas filas tiene cada conjunto?", "modo": "pregunta", "usuario": "prueba"}).encode(),
    headers={"Content-Type": "application/json"})
for linea in urllib.request.urlopen(pet, timeout=400):
    print(linea.decode().strip()[:300])
EOF
docker logs --tail 20 hackathon-asistente   # una línea por análisis: id, usuario, modo, segundos, costo
docker logs --tail 20 hackathon-salida      # rutas pedidas (un 403 = algo que Claude Code pidió y no dejamos pasar)
```
