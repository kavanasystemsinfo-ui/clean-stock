# Kavana CleanStock

Sistema MES para control de inventario distribuido, diseñado inicialmente para empresas de limpieza profesional.

## Stack

| Componente | Tecnología | Despliegue |
|---|---|---|
| **Backend API** | Node.js + Express + Prisma | Docker en VPS (Hetzner) |
| **Base de datos** | PostgreSQL 16 | Docker en VPS |
| **Dashboard supervisor** | React + Vite + TypeScript | nginx reverse proxy (VPS) |
| **App móvil limpiador (PWA)** | React + Vite + PWA | nginx reverse proxy (VPS) |
| **APK Android** | Capacitor | Build manual desde Android Studio |
| **Tiempo real** | Socket.IO | Integrado en API |

## URLs

| URL | Qué es |
|---|---|
| **[https://cleanstock.kavanasystems.com](https://cleanstock.kavanasystems.com)** | Dashboard supervisor |
| **https://cleanstock.kavanasystems.com/empleado** | App móvil limpiador (PWA) |
| **https://cleanstock.kavanasystems.com/api/v1/health** | API health check |

## Despliegue (VPS)

La aplicación corre en un VPS de Hetzner con Docker:

```
                  cleanstock.kavanasystems.com
                          │
                     ┌────┴────┐
                     │  nginx  │  ← SSL (Let's Encrypt)
                     │  :443   │
                     └────┬────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
  ┌────────────┐  ┌────────────┐  ┌──────────────┐
  │ Dashboard  │  │   Mobile   │  │  API Express │
  │ :4001      │  │ :4000      │  │ :3000        │
  │ React SPA  │  │ PWA React  │  │ + Prisma     │
  │ nginx      │  │ nginx      │  │              │
  └────────────┘  └────────────┘  └──────┬───────┘
                                         │
                                         ▼
                                  ┌────────────┐
                                  │ PostgreSQL │
                                  │ :5432      │
                                  └────────────┘
```

### Requisitos

- Docker y Docker Compose
- Node.js 20 (imagen Docker)
- nginx con Let's Encrypt (certbot)
- VPS con 2+ GB RAM, 20+ GB disco

### Instalación local

```bash
# 1. Clonar
git clone https://github.com/kavanasystemsinfo-ui/clean-stock.git
cd clean-stock

# 2. Copiar .env
cp .env.example .env
# Editar DATABASE_URL y JWT_SECRET

# 3. Levantar con Docker
docker compose up -d

# 4. Migraciones y seed
npx prisma migrate deploy
node prisma/seed.js
```

### Desarrollo local

```bash
npm install
cd dashboard && npm install && npm run dev      # :4001
cd ../mobile && npm install && npm run dev       # :4000
npm run dev                        # API :3000
```

## APK Android

La app móvil tiene soporte para Capacitor, que genera un APK que carga la web dentro de una WebView nativa.

Para generar el APK:

1. Clona el repo en tu PC con Android Studio
2. Abre `mobile/android/` en Android Studio
3. Build → Build APK
4. El APK aparece en `android/app/build/outputs/apk/debug/`

Cada cambio en la web se refleja automáticamente sin actualizar el APK.

## Usuarios de prueba

| Email | Rol | Contraseña |
|---|---|---|
| `admin@kavana.com` | Admin | CleanStock2026! |
| `supervisor@kavana.com` | Supervisor | CleanStock2026! |
| `empleado@kavana.com` | Limpiador | CleanStock2026! |

## Estructura del proyecto

```
├── api/                      # Vercel serverless entry (futuro)
├── dashboard/                # React SPA (supervisor)
│   └── src/
│       ├── pages/
│       └── lib/
├── mobile/                   # React PWA (limpiador)
│   ├── android/              # Proyecto Capacitor (APK)
│   └── src/
├── prisma/                   # Schema + migraciones
├── src/                      # API Express
│   ├── routes/
│   └── controllers/
├── docker-compose.yml
├── vercel.json               # Config Vercel (futuro)
└── supabase-migrate.sh       # Guía migración Supabase
```

## Licencia

MIT — Kavana Systems
