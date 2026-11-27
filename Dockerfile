# Versión en internet (https://syntropy.com.pa). Para ejecutar localmente no hace falta: npm start.
# Etapa 1: instala, PRUEBA (si una prueba falla, no se publica) y compila la web.
FROM node:24-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS construccion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test && npm run build && npm prune --omit=dev

# Etapa 2: solo lo necesario para servir, sin herramientas de compilación.
FROM node:24-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530
ENV NODE_ENV=production ANFITRION=0.0.0.0 PUERTO=3000
WORKDIR /app
COPY --from=construccion /app/node_modules ./node_modules
COPY --from=construccion /app/dist ./dist
COPY package.json ./
COPY motor ./motor
COPY servidor ./servidor
COPY datos/reto ./datos/reto
RUN mkdir -p /app/datos-locales /resultados && chown node:node /app/datos-locales /resultados
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=30s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/sesion').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "servidor/index.js"]
