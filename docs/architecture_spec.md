# Architecture Specification — Kavana CleanStock

> **Document Type:** Technical Architecture Specification (estado real, 2026-07-16)
> **Audience:** IT Consultants, Senior Developers, Technical Stakeholders
> **Versión actual:** 1.0 (backend monolítico)
> **Última actualización:** 2026-07-16
> **⚠️ Nota:** Este documento refleja el código que realmente corre en producción.
>   Los módulos aspiracionales (Socket.IO, Zod, Swagger, separación en controladores)
>   están documentados como planificados, no como implementados. Para el roadmap ver
>   `docs/internal_roadmap.md` (versión honesta).

---

## 1. Arquitectura real

### Stack
| Capa | Tecnología |
|------|-----------|
| Frontend supervisor | React 18 + Vite + TypeScript + CSS plano |
| App operario | React + Vite (PWA) + Capacitor (APK Android) |
| Backend | Node.js + Express (monolítico en `src/app.js`, 38 endpoints) |
| Backend (controllers separados) | 3: `costeController`, `deviationController`, `purchaseController` (importados desde app.js) |
| ORM | Prisma 6.x (@prisma/client) |
| Base de datos | PostgreSQL 16 (Docker) |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Validación | Manual en cada handler (sin librería de schemas) |
| Tiempo real | **No implementado** (las alertas son consultas REST) |
| Documentación API | **No implementada** (sin Swagger/OpenAPI) |
| Infra | Docker Compose + nginx + Let's Encrypt |
| Hosting | VPS Hetzner (2 vCPU, 3.7 GB RAM, Ubuntu 24.04) |

### Diagrama de despliegue real
```
          cleanstock.kavanasystems.com
                     │
                ┌────┴────┐
                │  nginx   │  ← SSL (Let's Encrypt)
                │  :443    │
                └────┬────┘
      ┌──────────────┼──────────────┐
      ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Dashboard │  │  Mobile   │  │  API      │
│ :4001    │  │ :4000    │  │ :3000     │
│ React SPA │  │ PWA React │  │ Express   │
│ nginx     │  │ nginx     │  │ + Prisma  │
└──────────┘  └──────────┘  └────┬─────┘
                                  ▼
                            ┌──────────┐
                            │PostgreSQL│
                            │ :5432    │
                            └──────────┘
```

### Estructura real del proyecto
```
clean-stock/
├── src/
│   ├── app.js              # API Express (monolítico, 38 endpoints)
│   ├── server.js           # Entry point (carga app.js + dotenv)
│   ├── lib/
│   │   └── logger.js       # Logger estructurado
│   ├── controllers/
│   │   ├── costeController.js       # Costes por centro (GET /api/v1/dashboard/costes)
│   │   ├── deviationController.js   # Desviaciones stock registrado vs físico
│   │   └── purchaseController.js    # Propuesta de compra automática
│   └── __tests__/
│       └── api.test.js     # 26 tests Jest
├── prisma/
│   ├── schema.prisma       # 10 modelos
│   └── seed.js
├── dashboard/              # Panel supervisor (React+Vite+TS)
│   └── src/pages/          # 7 rutas funcionales + 3 páginas sin enrutar
├── mobile/                 # App operario (React+Vite+Capacitor)
│   └── src/pages/          # 2 páginas: Login y Main
├── landing/                # Página de aterrizaje (HTML estático)
├── docker-compose.yml
└── Dockerfile.api
```

---

## 2. Modelo de datos (Prisma schema)

| Modelo | Descripción | Relaciones clave |
|--------|------------|------------------|
| `Cliente` | Empresa cliente del SaaS | 1:N → `Usuario`, `Centro` |
| `Usuario` | Empleado (supervisor/limpiador/admin) | N:1 → `Cliente`; 1:N → `AsignacionPersonal`, `RegistroMovimiento`, `Incidencia` |
| `Centro` | Centro de trabajo (ej. un colegio) | N:1 → `Cliente` (NOT NULL); 1:N → `InventarioCentro`, `AsignacionPersonal`, `RegistroMovimiento` |
| `Producto` | Catálogo global (lejía, papel, etc.) | N:1 → `Cliente` (opcional, catálogo público) |
| `InventarioCentro` | Stock de un producto en un centro | FK compuesta `(id_centro, id_producto)`, ON DELETE CASCADE |
| `AsignacionPersonal` | Operario asignado a un centro | N:1 → `Usuario`, `Centro` |
| `RegistroMovimiento` | Cada consumo/entrada | N:1 → `Usuario`, `Centro`, `Producto`; ON DELETE CASCADE |
| `Incidencia` | Reporte de avería | N:1 → `Usuario`, `Centro` |
| `ReglaNotificacion` | Regla de alerta (creada en BD, **sin endpoints CRUD todavía**) | N:1 → `Usuario` (supervisor) |
| `Notificacion` | Historial de alertas (creada en BD, **sin endpoints CRUD todavía**) | N:1 → `Usuario` |
| `RefreshToken` | Token de refresco (creada en BD, **sin wirear al login todavía**) | N:1 → `Usuario` |

---

## 3. Seguridad (auditoría ECC completada 2026-07-16)

| Capa | Implementación |
|------|---------------|
| **Multi-tenant** | Todo endpoint filtra por `id_cliente` del token JWT. Centro ajeno → 403. Verificado con tests (empresa A vs empresa B). |
| **Auth** | JWT con `id_cliente` en payload; en producción sin `JWT_SECRET` el servidor no arranca (M1). Token expira en 2h (M2). |
| **CORS** | Whitelist de orígenes desde env `CORS_ORIGIN` (M3). Verificado: `evil.com` bloqueado. |
| **SQL Injection** | Eliminado `$queryRawUnsafe`; todo vía Prisma tipado (C1). |
| **Mass-assignment** | Whitelist de campos en POST; `id_cliente` se fuerza del token (A1). |
| **Errores 500** | Mensajes genéricos + logger estructurado (M4, M8). |
| **Integridad BD** | `Centro.id_cliente` NOT NULL, FKs con ON DELETE CASCADE (M9, M10). |
| **Tests** | 26 tests, bloque SECURITY multi-tenant (6 tests, 403 confirmado). |

**Auditoría completa:** Ver `AUDITORIA_ESTADO.md`
**Hallazgos:** 4 críticos + 8 altos + 14 medios cerrados (M6 documentado).

---

## 4. API REST (endpoints reales)

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login (email o username) |
| POST | `/api/v1/auth/register-empresa` | Registro empresa + trial + email credenciales |

### Dashboard
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/dashboard` | Stats generales |
| GET | `/api/v1/dashboard/consumption` | Consumos con filtros, gasto €, % presupuesto |
| GET | `/api/v1/dashboard/alerts` | Alertas de stock crítico/bajo (REST, no tiempo real) |
| GET | `/api/v1/dashboard/deviations` | Desviación stock registrado vs físico |
| GET | `/api/v1/dashboard/costes` | Coste € por centro vs presupuesto |

### CRUD
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/POST | `/api/v1/categorias` | Categorías de producto |
| GET/POST/PUT/DELETE | `/api/v1/productos` | Catálogo de productos |
| GET/POST/PUT | `/api/v1/centros` | Centros de trabajo |
| GET/POST | `/api/v1/empleados` | Empleados |
| GET/POST | `/api/v1/inventario` | Stock por centro |
| POST | `/api/v1/inventario/reponer` | Reponer producto |
| GET/POST | `/api/v1/consumos` | Historial de consumos |
| GET/POST/PUT | `/api/v1/incidencias` | Incidencias |
| GET | `/api/v1/asignaciones/active` | Centro activo del operario |
| POST | `/api/v1/stock/consume` | Consumir producto (operario) |
| GET | `/api/v1/stock/inventory?centro=X` | Inventario de un centro |
| GET/PUT | `/api/v1/centros/:id/presupuesto` | Presupuesto mensual |
| GET | `/api/v1/purchases/proposal` | Propuesta de compra |

### Admin
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/PUT | `/api/v1/admin/clientes` | Gestión empresas |
| GET | `/api/v1/admin/clientes/:id` | Detalle cliente |
| GET | `/api/v1/admin/stats` | Estadísticas SaaS |

## 5. Futuro planificado (NO implementado hoy)

- **Socket.IO** para alertas en tiempo real
- **Separación en controladores modulares** (stockController, incidenciaController, etc.)
- **Documentación OpenAPI / Swagger**
- **Validación Zod** en los handlers
- **Refresh token wireado** al login (tabla existe)
- **Notificaciones CRUD** (tablas existen)
- **Migración serverless** a Vercel + Supabase si escala

> Ver `docs/internal_roadmap.md` (versión honesta) para el detalle de lo hecho vs. lo planificado.
