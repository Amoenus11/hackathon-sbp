'use strict';
/* =====================================================================
   Syntropy · Página del equipo
   Ajustes fáciles de cambiar (todo en hora de Panamá):
     HORA_PRESENTACION  la hora de la cuenta regresiva
     PLAN               los bloques del día; con "fin" = bloque (puede estar AHORA),
                        sin "fin" = hito (un momento: se marca como hecho al pasar)
   ===================================================================== */
const HORA_PRESENTACION = "15:30";

const PLAN = [
  { inicio: "08:00", fin: "09:30", titulo: "Arranque", detalle: "Entender el reto y la rúbrica" },
  { inicio: "09:30", titulo: "Congelar la misión", detalle: "En una frase, y no se mueve más" },
  { inicio: "09:30", fin: "12:00", titulo: "Núcleo", detalle: "Datos cargados, panel y el agente respondiendo bien 5 preguntas clave" },
  { inicio: "12:00", fin: "12:30", titulo: "Almuerzo + control", detalle: "Demo de punta a punta (aunque fea)" },
  { inicio: "12:30", fin: "14:30", titulo: "Pulir", detalle: "Diferenciadores, informe ejecutivo, alertas, diseño" },
  { inicio: "14:30", titulo: "Congelar el código", detalle: "Desde aquí, solo arreglos" },
  { inicio: "14:30", fin: "15:15", titulo: "Ensayar el pitch 3 veces", detalle: "Con cronómetro y con el plan B listo" },
  { inicio: "15:30", fin: "16:00", titulo: "Presentación", detalle: "5 minutos: historia y demo en vivo" },
];

const ZONA = "America/Panama";
const CLAVE_LISTA = "syntropy-lista-v1";

/* ----------------------------- utilidades ----------------------------- */
const formatoHora = new Intl.DateTimeFormat("es-PA", {
  timeZone: ZONA, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function relojPanama() {
  const p = {};
  for (const parte of formatoHora.formatToParts(new Date())) p[parte.type] = parte.value;
  const h = Number(p.hour) % 24;
  const m = Number(p.minute);
  const s = Number(p.second);
  const dos = (n) => String(n).padStart(2, "0");
  return { segundos: h * 3600 + m * 60 + s, texto: `${dos(h)}:${dos(m)}:${dos(s)}` };
}

function aSegundos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 3600 + m * 60;
}

function ponerTexto(id, texto) {
  const el = document.getElementById(id);
  if (el && el.textContent !== texto) el.textContent = texto;
}

function textoCuenta(falta) {
  if (falta <= 0) return falta > -1800 ? "¡Es la hora de presentar!" : "Presentación hecha";
  const h = Math.floor(falta / 3600);
  const m = Math.floor((falta % 3600) / 60);
  const s = falta % 60;
  if (h > 0) return `Faltan ${h} h ${String(m).padStart(2, "0")} min`;
  return `Faltan ${m} min ${String(s).padStart(2, "0")} s`;
}

/* ----------------------------- plan del día ----------------------------- */
function pintarPlan() {
  const ol = document.getElementById("plan");
  if (!ol) return [];
  ol.textContent = "";
  return PLAN.map((paso) => {
    const li = document.createElement("li");
    li.className = paso.fin ? "paso" : "paso hito";

    const hora = document.createElement("div");
    hora.className = "paso-hora";
    const t = document.createElement("time");
    t.textContent = paso.inicio;
    hora.append(t);
    if (paso.fin) {
      const fin = document.createElement("small");
      fin.textContent = "→ " + paso.fin;
      hora.append(fin);
    }

    const eje = document.createElement("div");
    eje.className = "paso-eje";
    eje.setAttribute("aria-hidden", "true");
    const punto = document.createElement("span");
    punto.className = "paso-punto";
    eje.append(punto);

    const texto = document.createElement("div");
    texto.className = "paso-texto";
    const titulo = document.createElement("strong");
    titulo.className = "paso-titulo";
    titulo.textContent = paso.titulo;
    const estado = document.createElement("span");
    estado.className = "estado";
    titulo.append(estado);
    const detalle = document.createElement("span");
    detalle.className = "paso-detalle";
    detalle.textContent = paso.detalle;
    texto.append(titulo, detalle);

    li.append(hora, eje, texto);
    ol.append(li);
    return { paso, li, estado, desde: aSegundos(paso.inicio), hasta: paso.fin ? aSegundos(paso.fin) : null };
  });
}

function estadoDe(fila, ahora) {
  if (fila.hasta !== null) {
    if (ahora >= fila.hasta) return "hecho";
    if (ahora >= fila.desde) return "ahora";
    return "";
  }
  return ahora >= fila.desde ? "hecho" : "";
}

/* ----------------------------- actualización ----------------------------- */
function actualizar(filas, progreso) {
  const reloj = relojPanama();
  const ahora = reloj.segundos;
  ponerTexto("hora", reloj.texto);

  const meta = aSegundos(HORA_PRESENTACION);
  ponerTexto("cuenta", textoCuenta(meta - ahora));

  if (progreso) {
    const inicio = filas.length ? filas[0].desde : aSegundos("08:00");
    const total = Math.max(1, meta - inicio);
    const pct = Math.round(Math.max(0, Math.min(1, (ahora - inicio) / total)) * 100);
    if (progreso.value !== pct) {
      progreso.value = pct;
      progreso.textContent = `${pct} %`;
      progreso.setAttribute("aria-valuetext", `${pct} % del día`);
    }
  }

  let actual = null;
  let siguiente = null;
  for (const fila of filas) {
    let estado = estadoDe(fila, ahora);
    if (!estado && !siguiente && fila.desde > ahora) {
      estado = "siguiente";
      siguiente = fila;
    }
    if (estado === "ahora" && !actual) actual = fila;

    fila.li.classList.toggle("hecho", estado === "hecho");
    fila.li.classList.toggle("ahora", estado === "ahora");
    fila.li.classList.toggle("siguiente", estado === "siguiente");
    const etiqueta = estado === "ahora" ? "AHORA" : estado === "siguiente" ? "SIGUIENTE" : "";
    if (fila.estado.textContent !== etiqueta) fila.estado.textContent = etiqueta;
    if (estado === "hecho") fila.li.setAttribute("aria-label", `${fila.paso.inicio} ${fila.paso.titulo} (hecho)`);
    else fila.li.removeAttribute("aria-label");
  }

  let textoActual;
  if (actual) textoActual = actual.paso.titulo;
  else if (siguiente) textoActual = `pausa · sigue ${siguiente.paso.titulo} (${siguiente.paso.inicio})`;
  else textoActual = "día terminado";
  ponerTexto("bloque-actual", textoActual);
}

/* ----------------------------- lista antes de presentar ----------------------------- */
function prepararLista() {
  const seccion = document.getElementById("lista");
  const cajas = Array.from(document.querySelectorAll('.checklist input[type="checkbox"]'));
  let guardado = {};
  try {
    guardado = JSON.parse(localStorage.getItem(CLAVE_LISTA) || "{}") || {};
  } catch (e) {
    guardado = {};
  }

  const contar = () => {
    const hechos = cajas.filter((c) => c.checked).length;
    ponerTexto("lista-cuenta", `${hechos} de ${cajas.length}`);
    if (seccion) seccion.classList.toggle("completa", cajas.length > 0 && hechos === cajas.length);
  };

  for (const caja of cajas) {
    caja.checked = Boolean(guardado[caja.id]);
    caja.addEventListener("change", () => {
      guardado[caja.id] = caja.checked;
      try {
        localStorage.setItem(CLAVE_LISTA, JSON.stringify(guardado));
      } catch (e) {
        /* sin almacenamiento (modo privado): la lista funciona igual, solo no se recuerda */
      }
      contar();
    });
  }
  contar();
}

/* ----------------------------- salir ----------------------------- */
function prepararSalir() {
  const boton = document.getElementById("salir");
  if (!boton) return;
  boton.addEventListener("click", async () => {
    boton.disabled = true;
    try {
      await fetch("/api/salir", { method: "POST", headers: { "X-Syntropy": "1" }, credentials: "same-origin" });
    } catch (e) {
      /* aunque falle la red, se vuelve a la entrada */
    }
    window.location.href = "/entrar";
  });
}

/* ----------------------------- inicio ----------------------------- */
(function iniciar() {
  ponerTexto("hora-presentacion", HORA_PRESENTACION);
  const filas = pintarPlan();
  const progreso = document.getElementById("progreso-dia");
  prepararLista();
  prepararSalir();
  actualizar(filas, progreso);
  setInterval(() => actualizar(filas, progreso), 1000);
})();
