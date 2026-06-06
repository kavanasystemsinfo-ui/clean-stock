# Deployment Guide — Kavana CleanStock

> **Document Type:** Technical Deployment Guide
> **Target:** DevOps, IT Operations
> **Version:** 2.0.0
> **Last Updated:** 2026-06-06

---

## Architecture Overview

```
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│   Mobile PWA    │  │   Dashboard     │  │   API (Express)      │
│   :4000         │  │   :4001         │  │   :3000              │
│   nginx serve   │  │   nginx serve   │  │   Node.js + Prisma   │
└────────┬────────┘  └────────┬────────┘  └──────────┬───────────┘
         │                    │                       │
         └─────────┬──────────┘                       │
                   │  /api/* → proxy                  │
                   ▼                                   ▼
         ┌──────────────────────────────────────────────┐
         │           Internal Docker Network            │
         │              kavana-cleanstock_kavana-net    │
         └──────────────────────────────────────────────┘
                                │
                                ▼
                   ┌──────────────────────┐
                   │  PostgreSQL 16       │
                   │  :5432               │
                   │  kavana_cleanstock   │
                   └──────────────────────┘
```

**Port Map:**

| Service    | Internal | External | Notes          |
|------------|----------|----------|----------------|
| PostgreSQL | 5432     | 5432     | Database       |
| API        | 3000     | 3000     | Express server |
| Dashboard  | 80       | 4001     | Supervisor UI  |
| Mobile PWA | 80       | 4000     | Limpiador UI   |

---

## Prerequisites

- **Docker** v24+ with Docker Compose plugin (v2.20+)
- **Git** (for cloning the repository)
- **Minimum resources:** 2 CPU cores, 4 GB RAM, 10 GB disk

---

## Quick Start (Local Development)

### Opción A — Lanzador automático (Windows)

Ejecuta [`start.bat`](start.bat) haciendo doble clic desde el explorador de archivos. El script:

1. Verifica e inicia el contenedor Docker PostgreSQL si no está corriendo
2. Instala dependencias npm si faltan
3. Ejecuta migraciones Prisma automáticamente
4. Abre 3 ventanas de terminal (API :3000, Dashboard :4001, Mobile :4000)
5. Abre el navegador en `http://localhost:4001`

### Opción B — Manual (cualquier SO)

### 1. Clone and enter the project

```bash
git clone <repository-url> kavana-cleanstock
cd kavana-cleanstock
```

### 2. Start all services

```bash
# Build and start all containers
docker compose up --build -d

# Monitor logs
docker compose logs -f
```

### 3. Verify deployment

```bash
# Health checks
curl http://localhost:3000/health          # API
curl http://localhost:4001/health          # Dashboard
curl http://localhost:4000/                # Mobile PWA

# Test login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@kavana.com","password":"admin123"}'

# Swagger docs
open http://localhost:3000/api-docs
```

### 4. Access the applications

| Application  | URL                          | Default Credentials                |
|--------------|------------------------------|------------------------------------|
| Dashboard    | http://localhost:4001        | supervisor@kavana.com / SuperKavana2026! |
| Mobile PWA   | http://localhost:4000        | limpiador@kavana.com / LimpKavana2026!  |
| API Docs     | http://localhost:3000/api-docs | —                                |

---

## Environment Variables

Create a `.env` file in the project root (or copy from `.env.example`):

```bash
# Database (change for production!)
DB_PASSWORD=kavana_pass

# JWT (change for production!)
JWT_SECRET=kavana-cleanstock-jwt-secret-prod-2026
JWT_EXPIRES_IN=15m

# Refresh Tokens
REFRESH_TOKEN_EXPIRY_DAYS=30
```

> **IMPORTANT:** For production, generate strong random secrets:
> ```bash
> openssl rand -base64 32  # for JWT_SECRET
> openssl rand -base64 16  # for DB_PASSWORD
> ```

---

## Production Deployment

### Build and run

```bash
# Generate production secrets
export JWT_SECRET=$(openssl rand -base64 32)
export DB_PASSWORD=$(openssl rand -base64 16)

# Build and start
docker compose up --build -d

# Verify
docker compose ps
docker compose logs --tail=50
```

### Update to a new version

```bash
git pull
docker compose up --build -d
# Database migrations run automatically on API startup
```

### Backup and restore

**Backup PostgreSQL database:**

```bash
docker exec kavana-db pg_dump -U kavana kavana_cleanstock > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Restore:**

```bash
docker exec -i kavana-db psql -U kavana kavana_cleanstock < backup.sql
```

### Stop and clean up

```bash
# Stop services (preserves data)
docker compose down

# Stop services and delete volumes (WARNING: deletes all data)
docker compose down -v
```

---

## Container Details

### API (`Dockerfile.api`)

- **Base image:** `node:20-alpine`
- **Entrypoint:** Custom `start.sh` script that:
  1. Runs `prisma migrate deploy` (applies pending migrations)
  2. Runs `prisma/seed.js` (seeds initial data)
  3. Starts Express server via `node src/server.js`
- **Health check:** `GET /health`
- **Non-root user:** `appuser` (UID 1001)

### Dashboard (`Dockerfile.dashboard` / `dashboard/nginx.conf`)

- **Base image:** `nginx:1.27-alpine` (multi-stage: Vite build → nginx)
- **API proxy:** `/api/*` → `http://api:3000`
- **SPA fallback:** All non-file routes serve `index.html`
- **Caching:** Static assets cached for 1 year, HTML never cached
- **Gzip:** Enabled for text-based assets
- **Non-root user:** `nginx`

### Mobile PWA (`Dockerfile.mobile` / `mobile/nginx.conf`)

- **Base image:** `nginx:1.27-alpine` (multi-stage: Vite build → nginx)
- **API proxy:** `/api/*` → `http://api:3000`
- **Service Worker:** Served with `no-cache` headers, `Service-Worker-Allowed: /`
- **PWA:** Long cache for assets, standalone manifest
- **Gzip:** Enabled for text-based assets
- **Non-root user:** `nginx`

---

## Scaling Considerations

For production with high concurrency:

1. **API horizontal scaling:**
   - Add API replicas: `docker compose up -d --scale api=3`
   - Add a reverse proxy (nginx, Traefik) in front of API instances
   - Use PostgreSQL connection pooling (PgBouncer)

2. **Database:**
   - Consider managed PostgreSQL (RDS, Cloud SQL) for HA
   - Set up regular WAL archiving for point-in-time recovery

3. **Static frontends:**
   - Dashboard and Mobile PWA are pure static files
   - Serve via CDN (Cloudflare, AWS CloudFront) for global low latency

4. **Environment-specific configs:**
   - Override `.env` variables per environment via Docker Compose override files:
     ```bash
     docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
     ```

---

## Troubleshooting

### API fails to start

```bash
# Check startup logs
docker compose logs api

# Common issues:
#   - Database not ready (wait for healthcheck)
#   - Migration fails (check schema compatibility)
#   - Port 3000 already in use (change PORT in .env)

# Manually run migrations
docker compose exec api npx prisma migrate deploy
```

### Frontend shows blank page

```bash
# Check nginx logs
docker compose logs dashboard
docker compose logs mobile

# Check if API is reachable from nginx
docker compose exec dashboard wget -qO- http://api:3000/health
```

### Database connection refused

```bash
# Verify DB is healthy
docker compose ps db

# Check connection from API container
docker compose exec api wget -qO- http://db:5432

# Reset database (WARNING: deletes data)
docker compose down -v
docker compose up -d
```

---

## File Reference

| File | Purpose |
|------|---------|
| [`docker-compose.yml`](docker-compose.yml) | Full-stack orchestration (4 services) |
| [`Dockerfile.api`](Dockerfile.api) | API build: Node.js + Prisma + Express |
| [`Dockerfile.dashboard`](Dockerfile.dashboard) | Dashboard build: Vite → nginx |
| [`Dockerfile.mobile`](Dockerfile.mobile) | Mobile build: Vite → nginx |
| [`dashboard/nginx.conf`](dashboard/nginx.conf) | Dashboard nginx with API proxy |
| [`mobile/nginx.conf`](mobile/nginx.conf) | Mobile nginx with API proxy + SW headers |
| [`start.bat`](start.bat) | **Lanzador de desarrollo local** (Windows) — inicia BD + API + frontends |
| [`.env`](.env) | Environment variables (local dev defaults) |
| [`.dockerignore`](.dockerignore) | Excludes node_modules, logs, docs from Docker context |

---

## Deploy en Producción (Cloud)

Tu proyecto tiene 3 componentes que desplegar:

| Componente | Tecnología | Dónde desplegarlo |
|------------|-----------|-------------------|
| **API** (Express + Socket.IO + Prisma) | Node.js | Railway ⭐ o Render |
| **PostgreSQL** | Base de datos | Railway (incluida) ⭐ o Render |
| **Dashboard** (React + TypeScript) | Frontend SPA | Vercel |
| **Mobile PWA** (React + TypeScript) | Frontend SPA + PWA | Vercel |

### Comparativa de Plataformas para API + BD

| Plataforma | Coste/mes | WebSocket | PostgreSQL | Facilidad |
|------------|-----------|-----------|------------|-----------|
| **Railway ⭐** | **$5/mes** | ✅ Sí | ✅ Incluido | ✅ Muy fácil |
| Render | $14/mes ($7 API + $7 BD) | ✅ (plan Starter) | ✅ Aparte | ✅ Fácil |
| Fly.io | ~$5/mes | ✅ Sí | ✅ Volumen | ⚠️ Media |
| Vercel + Neon | ~$0/mes | ❌ No serverless | ✅ Neon gratis | ⚠️ Media |

**👉 Recomendación: Railway + Vercel** — Es la opción más barata, PostgreSQL incluido, WebSocket funciona, y el deploy es idéntico a Render.

---

## Opción A: Railway + Vercel ⭐ RECOMENDADA

### Arquitectura

```
                         ┌─────────────────────────────────────┐
                         │       kavanasystems.com             │
                         │         (Vercel)                    │
                         │                                     │
                         │  ┌──────────────────────────────┐   │
                         │  │  Dashboard (Supervisor)      │   │
                         │  │  https://kavanasystems.com   │   │
                         │  │  → /api/* → railway.app      │   │
                         │  │  → /socket.io → railway.app  │   │
                         │  └──────────────────────────────┘   │
                         │  ┌──────────────────────────────┐   │
                         │  │  Mobile PWA (Limpiador)      │   │
                         │  │  https://app.kavanasystems.com│   │
                         │  │  → /api/* → railway.app      │   │
                         │  └──────────────────────────────┘   │
                         └──────────────┬──────────────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────────────┐
                         │     Railway (API + DB)               │
                         │                                      │
                         │  ┌──────────────┐  ┌──────────────┐  │
                         │  │  PostgreSQL  │  │  API Express  │  │
                         │  │  (Railway)   │◄─│  Node.js      │  │
                         │  │  :5432       │  │  :3000        │  │
                         │  └──────────────┘  │  + Socket.IO  │  │
                         │                    └──────────────┘  │
                         └──────────────────────────────────────┘
```

### Paso 1: Railway — API + PostgreSQL

Railway es la plataforma más sencilla porque **la base de datos viene incluida** y se conecta automáticamente.

1. Ve a [Railway Dashboard](https://railway.app) → **New Project**
2. Selecciona **Deploy from GitHub repo** → conecta tu repositorio
3. Railway detecta automáticamente que es un proyecto Node.js
4. **Añade PostgreSQL:** Click en **New** → **Database** → **Add PostgreSQL**
   - Railway crea la BD y **auto-inyecta** la variable `DATABASE_URL` en la API
   - No necesitas configurar nada manualmente
5. Configura la API (Railway lo hace casi todo automático, pero verifica):
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npx prisma migrate deploy && node prisma/seed.js && node src/server.js`
   - **Root Directory:** dejarlo vacío (el proyecto raíz)
6. **Environment Variables** (añadir manualmente):

   | Variable | Valor | Cómo generarlo |
   |----------|-------|----------------|
   | `JWT_SECRET` | `tu_secreto_fuerte` | `openssl rand -base64 32` en tu terminal |
   | `JWT_EXPIRES_IN` | `15m` | |
   | `REFRESH_TOKEN_EXPIRY_DAYS` | `30` | |
   | `NODE_ENV` | `production` | |
   | `CORS_ORIGIN` | `https://kavanasystems.com,https://app.kavanasystems.com` | |

   > `DATABASE_URL` la inyecta Railway automáticamente. No la añadas manualmente.

7. Railway hará el build y deploy automáticamente.
8. Una vez desplegado, ve a **Settings** → **Domains** → **Generate Domain**
   - Obtendrás una URL como: `https://kavana-cleanstock-api.up.railway.app`
   - (Opcional) Puedes configurar un dominio personalizado como `api.kavanasystems.com`

### Paso 2: Vercel — Dashboard (Supervisor)

El Dashboard irá en la raíz de `kavanasystems.com`.

1. Ve a [Vercel Dashboard](https://vercel.com) → **Add New** → **Project**
2. Importa tu repositorio de GitHub
3. Configura:
   - **Root Directory:** `dashboard`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment Variables:** No necesitas ninguna (las rutas API se resuelven via `vercel.json`)
5. **Domain:** Configura `kavanasystems.com` en Settings → Domains
6. El archivo [`dashboard/vercel.json`](dashboard/vercel.json) ya está creado. Solo cambia la URL de Railway:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://KAVANA-API-URL.up.railway.app/api/:path*" },
    { "source": "/socket.io/:path*", "destination": "https://KAVANA-API-URL.up.railway.app/socket.io/:path*" },
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### Paso 3: Vercel — Mobile PWA (Limpiador)

La app móvil en `app.kavanasystems.com`.

1. En Vercel → **Add New** → **Project**
2. Mismo repositorio:
   - **Root Directory:** `mobile`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. **Domain:** Configura `app.kavanasystems.com`
4. El archivo [`mobile/vercel.json`](mobile/vercel.json) ya está creado. Cambia la URL de Railway:

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://KAVANA-API-URL.up.railway.app/api/:path*" },
    { "source": "/(.*)", "destination": "/" }
  ],
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Service-Worker-Allowed", "value": "/" },
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    }
  ]
}
```

### Paso 4: Configurar dominio kavanasystems.com

1. En Vercel: Proyecto Dashboard → **Settings** → **Domains** → añade `kavanasystems.com`
2. Vercel te dará los nameservers a los que apuntar tu dominio
3. Ve a tu proveedor de dominio (donde compraste kavanasystems.com) y cambia los nameservers por los de Vercel
4. Para `app.kavanasystems.com`: en el proyecto Mobile → **Settings** → **Domains** → añade `app.kavanasystems.com`

### Paso 5: Verificar

```bash
# Health check
curl https://KAVANA-API-URL.up.railway.app/health

# Login de prueba
curl -X POST https://KAVANA-API-URL.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"supervisor@kavana.com","password":"SuperKavana2026!"}'

# Swagger docs
# https://KAVANA-API-URL.up.railway.app/api-docs

# Dashboard
# https://kavanasystems.com

# Mobile PWA
# https://app.kavanasystems.com
```

---

## Opción B: Render + Vercel (Alternativa)

Si prefieres Render por conocimiento previo, el proceso es similar pero con dos servicios separados (API + PostgreSQL) y un coste de ~$14/mes.

### Paso 1: Render — Base de Datos PostgreSQL

1. [Render Dashboard](https://dashboard.render.com) → **New +** → **PostgreSQL**
2. Configura:
   - **Name:** `kavana-cleanstock-db`
   - **Database:** `kavana_cleanstock`
   - **Region:** Frankfurt (Europa)
   - **Plan:** Starter ($7/mes)
3. Una vez creado, copia la **Internal Database URL**

### Paso 2: Render — API (Express + Socket.IO)

1. **New +** → **Web Service** → conecta tu GitHub
2. Configura:
   - **Name:** `kavana-cleanstock-api`
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npx prisma migrate deploy && node prisma/seed.js && node src/server.js`
   - **Plan:** Starter ($7/mes)
3. **Environment Variables:**

   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | La Internal URL de tu PostgreSQL en Render |
   | `JWT_SECRET` | `openssl rand -base64 32` |
   | `JWT_EXPIRES_IN` | `15m` |
   | `REFRESH_TOKEN_EXPIRY_DAYS` | `30` |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | `https://kavanasystems.com,https://app.kavanasystems.com` |

4. **Health Check Path:** `/health`

### Paso 3: Vercel — Frontends (Dashboard + Mobile)

Sigue los mismos pasos que en Railway (Pasos 2 y 3 de la Opción A), pero cambiando la URL en los `vercel.json`:

```json
// dashboard/vercel.json y mobile/vercel.json
{ "source": "/api/:path*", "destination": "https://kavana-cleanstock-api.onrender.com/api/:path*" }
```

---

## Actualización del código en producción

Cualquier plataforma que elijas, el flujo es el mismo:

```bash
git add .
git commit -m "Descripción de los cambios"
git push
# Railway / Render / Vercel detectan el push y hacen redeploy automático
```

---

## Troubleshooting

### API no arranca
```bash
# Railway: Dashboard → Project → Deploy Logs
# Render: Dashboard → kavana-cleanstock-api → Logs
# Errores comunes:
#   - DATABASE_URL incorrecta o no inyectada
#   - Migraciones fallan (prisma migrate deploy)
#   - Puerto: usa process.env.PORT siempre
```

### CORS errors
```bash
# Verifica CORS_ORIGIN en Railway/Render:
#   CORS_ORIGIN=https://kavanasystems.com,https://app.kavanasystems.com
# Con vercel.json rewrites no debería haber CORS issues
```

### Socket.IO no conecta
```bash
# Railway: ✅ Funciona desde el plan de $5/mes
# Render: ❌ No funciona en plan Free. Necesitas Starter ($7/mes)
# Alternativa: Socket.IO hace fallback a long-polling automáticamente
```

### Base de datos lenta
```bash
# Railway PostgreSQL: 1GB RAM incluido en el plan
# Render PostgreSQL Starter: 512MB RAM
# Alternativas: Neon.tech (serverless, 10GB gratis), Supabase
```
