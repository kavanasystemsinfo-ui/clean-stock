# CleanStock — SaaS de Trazabilidad de Stock para Limpieza Profesional

[![Tests](https://img.shields.io/badge/tests-26%20passing-brightgreen)](https://github.com/kavanasystemsinfo-ui/clean-stock)
[![Node](https://img.shields.io/badge/Node-20-339933?logo=nodedotjs)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express)](https://expressjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](docker-compose.yml)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## ⚡ 30 Segundos: ¿Qué es y para qué sirve?

**Problema que resuelve:** Las empresas de limpieza con centros descentralizados (colegios, oficinas, hospitales) pierden hasta un 30% de su presupuesto en materiales porque no saben qué producto se consume en cada centro, ni si el gasto se ajusta a lo presupuestado. Los supervisores descubren las desviaciones semanas después, cuando ya no pueden corregirlas.

**Solución:** CleanStock es un SaaS B2B que permite a supervisores ver en tiempo real el consumo de productos por centro, compararlo con el presupuesto y recibir alertas de desviaciones. El **responsable de centro** hace recuento físico del stock desde una app móvil. El **supervisor** controla todo desde un dashboard web.

**Stack:** Node.js + Express · React + Vite · PostgreSQL 16 · Prisma ORM · Docker

**Nota sobre el proceso de desarrollo:** Este proyecto fue diseñado y dirigido por un arquitecto de software. Las decisiones arquitectónicas y de producto responden a criterio técnico propio. La implementación se realizó con asistencia de herramientas de IA como par de programación.

**[🎯 Live Demo →](https://cleanstock.kavanasystems.com)**

---

## 📖 Índice

1. [Arquitectura](#-arquitectura)
2. [Decisiones clave](#-decisiones-clave)
3. [Stack tecnológico](#-stack-tecnológico)
4. [Cómo ejecutar](#-cómo-ejecutar)
5. [Estado del proyecto](#-estado-del-proyecto)
6. [Documentación](#-documentación)

---

## 🏗️ Arquitectura

```
RESPONSABLE DE CENTRO          SUPERVISOR
┌──────────────────┐          ┌──────────────────┐
│  App Móvil        │          │  Dashboard Web   │
│  (Recuento stock) │          │  (Control total)  │
└────────┬─────────┘          └────────┬─────────┘
         │                             │
         └──────────────┬──────────────┘
                        ▼
              ┌──────────────────┐
              │  API REST        │
              │  Express + Prisma│
              │  + Auth JWT      │
              └────────┬─────────┘
                       │
              ┌────────▼─────────┐
              │  PostgreSQL 16   │
              │  + client_id     │
              │  (multi-tenant)  │
              └──────────────────┘
```

**Flujo de negocio:**
1. **Responsable de centro** hace recuento físico del stock desde la app móvil
2. Los datos se envían a la API y se comparan con el presupuesto del centro
3. **Supervisor** ve en el dashboard: consumo real vs presupuestado, alertas de desviación, histórico por centro

> **Modelo de negocio:** Se descartó la app para limpiadores (fricción de usabilidad). El recuento lo hace personal de confianza del cliente. [Ver decisión →](docs/adr/001-multi-tenant-feature-flags.md)

---

## 🧠 Decisiones clave

| Decisión | Alternativas | Elegida | Por qué |
|----------|-------------|---------|---------|
| **Multi-tenancy** | Schema-per-tenant, instancias separadas | Shared-schema + `client_id` | Migraciones simples, escalable a cientos de clientes |
| **Feature flags** | Tablas separadas por plan | JSON en tabla clients | Sin migraciones, activación instantánea |
| **Framework** | NestJS, Fastify | Express | Suficiente para el dominio, sin over-engineering |
| **ORM** | SQL directo, Drizzle | Prisma | Tipado seguro, migrations automáticas |
| **App limpiadores** | App nativa | ❌ **Descartada** | Fricción de usabilidad en operarios |
| **Infraestructura** | Serverless, Railway | VPS Docker | Menor coste para MVP, migrable después |

---

## 🛠️ Stack tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Backend** | Node.js + Express | Madurez, ecosistema, simplicidad para el dominio |
| **ORM** | Prisma 6 | Tipado seguro, migrations automáticas, DX |
| **Frontend** | React 18 + Vite + TypeScript | Renderizado rápido, tooling moderno |
| **App Móvil** | React (web mobile responsive) | Misma codebase que el dashboard |
| **BD** | PostgreSQL 16 | JSONB, rendimiento, madurez |
| **Auth** | JWT + bcrypt + Zod | Sin dependencias externas, validación centralizada |
| **Tests** | Jest + Supertest | 26 tests de integración |
| **Infra** | Docker Compose + nginx + Let's Encrypt | VPS Hetzner, despliegue reproducible |
| **CI/CD** | GitHub Actions | Tests automáticos en cada push |

---

## 🚀 Cómo ejecutar

```bash
# 1. Clonar
git clone https://github.com/kavanasystemsinfo-ui/clean-stock.git
cd clean-stock

# 2. Variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Docker (todo el stack)
docker compose up -d

# 4. Tests
npm test                # 26 tests de integración
```

**Demo online:** https://cleanstock.kavanasystems.com  
**API Health:** https://cleanstock.kavanasystems.com/api/v1/health

---

## 📊 Estado del proyecto

### ✅ Implementado y verificable
- [x] Autenticación multi-tenant con JWT + bcrypt
- [x] Dashboard supervisor con consumo por centro
- [x] App móvil para recuento físico de stock
- [x] Feature flags por cliente (JSON en BD)
- [x] Alertas de stock mínimo y desviaciones
- [x] 26 tests de integración (Jest + Supertest)
- [x] CI/CD (GitHub Actions)
- [x] Despliegue Docker en VPS con HTTPS

### 🚧 En desarrollo
- [ ] Migración a infraestructura serverless (Railway/Render)
- [ ] Informes avanzados exportables (PDF/CSV)
- [ ] Múltiples idiomas
- [ ] App nativa para responsables de centro (React Native)

---

## 📚 Documentación

### Para negocio
| Documento | Contenido |
|-----------|-----------|
| [Estado Actual](docs/commercial/00_current-status.md) | Situación del producto y modelo de negocio |
| [Plan de Mejoras](docs/commercial/01_improvement-plan.md) | Roadmap de funcionalidades enterprise |
| [Reunión Directiva](docs/commercial/02_board-meeting.md) | Acta de decisión sobre cambio de modelo |

### Para arquitectura / decisiones técnicas
| Documento | Contenido |
|-----------|-----------|
| [ADR-001: Multi-Tenant + Feature Flags](docs/adr/001-multi-tenant-feature-flags.md) | Alternativas evaluadas y decisiones |
| [Arquitectura Técnica](docs/technical/01_architecture-spec.md) | Especificación completa del sistema |
| [Guía de Despliegue](docs/technical/02_deployment.md) | Docker, nginx, VPS |
| [Roadmap Interno](docs/technical/03_internal-roadmap.md) | Plan de desarrollo técnico |

---

## 🔒 Seguridad

Ver [`SECURITY.md`](SECURITY.md).

---

## 📄 Licencia

MIT © [Jorge Adán Rodríguez](https://github.com/kavanasystemsinfo-ui)

---

*Última actualización: 2026-07-23*
