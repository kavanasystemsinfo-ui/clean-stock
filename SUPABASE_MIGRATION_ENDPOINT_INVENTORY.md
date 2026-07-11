# CleanStock → Supabase Edge Functions: Complete Endpoint Inventory

> Generated from Express source in `/root/clean_ops/src/`
> Migration target: Supabase DB + Edge Functions + Realtime

---

## Table of Contents

1. [Auth Endpoints](#1-auth-endpoints)
2. [Stock Endpoints](#2-stock-endpoints)
3. [Asignaciones Endpoints](#3-asignaciones-endpoints)
4. [Dashboard Endpoints](#4-dashboard-endpoints)
5. [Incidencias Endpoints](#5-incidencias-endpoints)
6. [Purchases Endpoints](#6-purchases-endpoints)
7. [Notifications Endpoints](#7-notifications-endpoints)
8. [Push Notification Endpoints](#8-push-notification-endpoints)
9. [System Endpoint](#9-system-endpoint)
10. [WebSocket / Socket.IO Events](#10-websocket--socketio-events)
11. [Database Models Reference](#11-database-models-reference)
12. [Auth & Middleware Summary](#12-auth--middleware-summary)

---

## 1. Auth Endpoints

All under prefix: `/api/v1/auth`

### 1.1 POST /api/v1/auth/login

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | No (public) |
| **Middleware** | `validate(loginSchema)` — Zod validation |
| **Controller** | `authController.login` |

**Request Body:**
```json
{
  "email": "string (valid email)",
  "password": "string (min 1 char)"
}
```

**Success Response (200):**
```json
{
  "token": "string (JWT, 15min expiry)",
  "refreshToken": "string (hex, 64 bytes 30 day expiry)",
  "refreshTokenExpiresAt": "ISO date string",
  "usuario": {
    "id_usuario": "integer",
    "nombre": "string",
    "email": "string",
    "rol": "limpiador | supervisor | admin",
    "estado": "activo | baja_medica | inactivo"
  }
}
```

**Error Responses:**
- `401` — Credenciales inválidas (wrong email or password)
- `403` — Cuenta de baja médica o inactiva

**Supabase Equivalent:** `supabase.auth.signInWithPassword()` or custom via `supabase-js` + bcrypt

---

### 1.2 POST /api/v1/auth/register

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | Yes — Bearer JWT |
| **Role Required** | `admin` |
| **Middleware** | `authenticate` → `authorize('admin')` → `validate(registerSchema)` |
| **Controller** | `authController.register` |

**Request Body:**
```json
{
  "nombre": "string (1-100 chars)",
  "email": "string (valid email)",
  "password": "string (min 6 chars)",
  "rol": "limpiador | supervisor | admin (optional, default: limpiador)"
}
```

**Success Response (201):**
```json
{
  "usuario": {
    "id_usuario": "integer",
    "nombre": "string",
    "email": "string",
    "rol": "string",
    "estado": "string"
  }
}
```

**Error Responses:**
- `401` — Token not provided or invalid
- `403` — Requires admin role
- `409` — Email already registered

**Implementation Notes:**
- Password hashed with `bcryptjs` (salt rounds: 12)
- Supabase migration: Use `supabase.auth.admin.createUser()` or custom users table with `bcrypt` in Edge Function
- Roles: `limpiador`, `supervisor`, `admin` (stored as string)

---

### 1.3 GET /api/v1/auth/verify

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes — Bearer JWT |
| **Middleware** | `authenticate` |
| **Controller** | `authController.verify` |

**Success Response (200):**
```json
{
  "usuario": {
    "id_usuario": "integer",
    "nombre": "string",
    "email": "string",
    "rol": "string",
    "estado": "string"
  }
}
```

**Error Responses:**
- `401` — Token expired or invalid
- `404` — User not found in DB

**Supabase Equivalent:** `supabase.auth.getUser()` for JWT verification, then lookup `usuarios` table.

---

### 1.4 POST /api/v1/auth/refresh

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | No (public, uses refresh token) |
| **Middleware** | `validate(refreshSchema)` |
| **Controller** | `authController.refresh` |

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

**Success Response (200):**
```json
{
  "token": "string (new JWT, 15min)",
  "refreshToken": "string (new hex token, rotation)",
  "refreshTokenExpiresAt": "ISO date string",
  "usuario": { "id_usuario": "int", "nombre": "string", "email": "string", "rol": "string", "estado": "string" }
}
```

**Error Responses:**
- `401` — Refresh token invalid, revoked, or expired
- `403` — Account inactive

**Implementation Notes:**
- Old refresh token is revoked (rotation) to prevent replay attacks
- Refresh tokens stored in `refresh_tokens` table with `expires_at` and `revoked` fields
- Cleanup: `cleanupExpiredTokens()` runs every 6 hours

---

### 1.5 POST /api/v1/auth/logout

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | Yes — Bearer JWT |
| **Middleware** | `authenticate` |
| **Controller** | `authController.logout` |

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

**Success Response (200):**
```json
{
  "message": "Sesión cerrada correctamente."
}
```

**Error Responses:**
- `400` — refreshToken is required
- `401` — Invalid token

---

## 2. Stock Endpoints

All under prefix: `/api/v1/stock` (requires `authenticate` middleware)

### 2.1 GET /api/v1/stock/inventory

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | `stockController.getInventory` |

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `centro` | integer | No | Filter by center ID. For `limpiador` role, auto-resolved from active assignment |

**Success Response (200):**
```json
{
  "inventario": [
    {
      "id_centro": "integer",
      "id_producto": "integer",
      "cantidad_actual": "integer",
      "producto": {
        "id_producto": "integer",
        "nombre_producto": "string",
        "unidad_medida": "string",
        "stock_minimo_alerta": "integer",
        "coste_unitario": "float"
      },
      "centro": {
        "id_centro": "integer",
        "nombre_centro": "string",
        "direccion": "string|null",
        "presupuesto_mensual": "float"
      }
    }
  ]
}
```

**Behavior:** If user is `limpiador` and no `centro` query param provided, auto-resolves to their active assignment's center.

---

### 2.2 GET /api/v1/stock/centros

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | `stockController.getCentros` |

**Success Response (200):**
```json
{
  "centros": [
    {
      "id_centro": "integer",
      "nombre_centro": "string",
      "direccion": "string|null",
      "presupuesto_mensual": "float"
    }
  ]
}
```

---

### 2.3 POST /api/v1/stock/consume

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` → `validate(consumeStockSchema)` |
| **Controller** | `stockController.consumeStock` |

**Request Body:**
```json
{
  "id_producto": "integer (positive)",
  "cantidad": "integer (positive — the controller converts to negative internally)",
  "id_centro": "integer (optional, auto-resolved for limpiador)"
}
```

**Success Response (200):**
```json
{
  "message": "Consumo registrado correctamente.",
  "inventario": {
    "id_centro": "integer",
    "id_producto": "integer",
    "cantidad_actual": "integer"
  },
  "movimiento": {
    "id_movimiento": "integer",
    "id_usuario": "integer",
    "id_centro": "integer",
    "id_producto": "integer",
    "cantidad": "integer (negative=consumption)",
    "fecha_hora": "ISO date string"
  }
}
```

**Error Responses:**
- `400` — Stock insuficiente
- `403` — No tienes un centro activo asignado
- `404` — Producto or Centro not found

**Socket.IO Events Emitted:**
- `stock:consumed` (to room `centro:{id_centro}`)
- `stock:alert` (if `cantidad_actual <= stock_minimo_alerta`)

**Push Notification:**
- Sends push notification to the consuming user (operator confirmation)
- Payload: `{ title: "Consumo Registrado", body: "...", data: { type: "consumption_confirmation", centroId, productoId, movimientoId } }`

---

### 2.4 POST /api/v1/stock/restock

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` → `validate(restockSchema)` |
| **Controller** | `stockController.restock` |

**Request Body:**
```json
{
  "id_producto": "integer (positive)",
  "cantidad": "integer (positive)",
  "id_centro": "integer (positive, required)"
}
```

**Success Response (200):**
```json
{
  "message": "Reposición registrada correctamente.",
  "inventario": {
    "id_centro": "integer",
    "id_producto": "integer",
    "cantidad_actual": "integer"
  },
  "movimiento": {
    "id_movimiento": "integer",
    "id_usuario": "integer",
    "id_centro": "integer",
    "id_producto": "integer",
    "cantidad": "integer (positive=restock)",
    "fecha_hora": "ISO date string"
  }
}
```

**Error Responses:**
- `403` — Role not authorized
- `404` — Producto or Centro not found

**Socket.IO Events Emitted:**
- `stock:restocked` (to room `centro:{id_centro}`)

---

### 2.5 GET /api/v1/stock/alerts

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | `stockController.getAlerts` |

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `centro` | integer | No | Filter by center ID |

**Success Response (200):**
```json
{
  "alerts": [
    {
      "id_centro": "integer",
      "id_producto": "integer",
      "cantidad_actual": "integer",
      "producto": {
        "id_producto": "integer",
        "nombre_producto": "string",
        "unidad_medida": "string",
        "stock_minimo_alerta": "integer",
        "coste_unitario": "float"
      },
      "centro": { "full center object" }
    }
  ]
}
```

**Logic:** Filters where `cantidad_actual <= producto.stock_minimo_alerta` (performed in-memory because Prisma doesn't support cross-field comparisons in WHERE).

---

## 3. Asignaciones Endpoints

All under prefix: `/api/v1/asignaciones` (requires `authenticate` middleware)

### 3.1 GET /api/v1/asignaciones/active

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | `asignacionController.getActive` |

**Success Response (200):**
```json
{
  "asignacion": {
    "id_asignacion": "integer",
    "id_usuario": "integer",
    "id_centro": "integer",
    "fecha_inicio": "ISO date string",
    "fecha_fin": "ISO date string|null",
    "centro": {
      "id_centro": "integer",
      "nombre_centro": "string",
      "direccion": "string|null",
      "presupuesto_mensual": "float"
    }
  }
}
```

**Error Responses:**
- `404` — No active assignment for current date

**Logic:** Finds assignment where `fecha_inicio <= TODAY` AND (`fecha_fin >= TODAY` OR `fecha_fin IS NULL`)

---

### 3.2 GET /api/v1/asignaciones/users

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | `asignacionController.getAllUsers` |

**Success Response (200):**
```json
{
  "usuarios": [
    {
      "id_usuario": "integer",
      "nombre": "string",
      "email": "string",
      "rol": "string"
    }
  ]
}
```

**Used by:** Dashboard user/operator selectors.

---

### 3.3 GET /api/v1/asignaciones

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | `asignacionController.list` |

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `usuario` | integer | No | Filter by user ID |
| `centro` | integer | No | Filter by center ID |

**Success Response (200):**
```json
{
  "asignaciones": [
    {
      "id_asignacion": "integer",
      "id_usuario": "integer",
      "id_centro": "integer",
      "fecha_inicio": "ISO date string",
      "fecha_fin": "ISO date string|null",
      "usuario": {
        "id_usuario": "integer",
        "nombre": "string",
        "email": "string",
        "rol": "string"
      },
      "centro": { "id_centro": "int", "nombre_centro": "string" }
    }
  ]
}
```

---

### 3.4 POST /api/v1/asignaciones

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` → `validate(createAsignacionSchema)` |
| **Controller** | `asignacionController.create` |

**Request Body:**
```json
{
  "id_usuario": "integer (positive)",
  "id_centro": "integer (positive)",
  "fecha_inicio": "string (YYYY-MM-DD)",
  "fecha_fin": "string (YYYY-MM-DD) | null (optional)"
}
```

**Success Response (201):**
```json
{
  "asignacion": { "full assignment object with usuario + centro" }
}
```

**Error Responses:**
- `404` — User or center not found
- `409` — Overlapping assignment exists for this user in the period

**Validation:**
- Checks date overlap: `fecha_inicio <= new_end OR new_start <= fecha_fin` for existing assignments for same user

---

### 3.5 PUT /api/v1/asignaciones/:id

| Field | Detail |
|---|---|
| **HTTP Method** | `PUT` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` → `validate(updateAsignacionSchema)` |
| **Controller** | `asignacionController.update` |

**Path Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Assignment ID (`id_asignacion`) |

**Request Body:**
```json
{
  "fecha_inicio": "string YYYY-MM-DD (optional)",
  "fecha_fin": "string YYYY-MM-DD | null (optional)"
}
```
At least one field must be provided (validated via Zod `.refine()`).

**Success Response (200):**
```json
{
  "asignacion": { "full assignment object with usuario + centro" }
}
```

---

## 4. Dashboard Endpoints

All under prefix: `/api/v1/dashboard` (requires `authenticate` + `authorize('supervisor', 'admin')`)

### 4.1 GET /api/v1/dashboard/consumption

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `dashboardController.consumption` |

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `centro` | integer | No | Filter by center ID |
| `producto` | integer | No | Filter by product ID |
| `desde` | string (YYYY-MM-DD) | No | Start date |
| `hasta` | string (YYYY-MM-DD) | No | End date |

**Success Response (200):**
```json
{
  "total_consumo_unidades": "integer",
  "total_gasto_euros": "float",
  "total_movimientos": "integer",
  "resumen_por_centro": [
    {
      "centro": {
        "id_centro": "integer",
        "nombre_centro": "string",
        "presupuesto_mensual": "float"
      },
      "presupuesto_mensual": "float",
      "total_consumo_unidades": "integer",
      "gasto_total_euros": "float",
      "movimientos": "integer",
      "porcentaje_consumido": "float",
      "productos": [
        {
          "id_producto": "integer",
          "nombre_producto": "string",
          "unidad_medida": "string",
          "coste_unitario": "float",
          "cantidad": "integer",
          "gasto_euros": "float"
        }
      ]
    }
  ],
  "movimientos": [
    {
      "id_movimiento": "integer",
      "id_centro": "integer",
      "id_producto": "integer",
      "id_usuario": "integer",
      "cantidad": "integer",
      "fecha_hora": "ISO date string",
      "gasto_euros": "float",
      "producto": { "id_producto": "int", "nombre_producto": "string", "unidad_medida": "string", "coste_unitario": "float" },
      "centro": { "id_centro": "int", "nombre_centro": "string", "presupuesto_mensual": "float" },
      "usuario": { "id_usuario": "int", "nombre": "string" }
    }
  ]
}
```

**Logic:**
- Only consumption movements (cantidad < 0)
- Groups by center, calculates OPEX (cost = cantidad * coste_unitario)
- Calculates budget consumption percentage
- Last 100 movements returned in detail

---

### 4.2 GET /api/v1/dashboard/alerts

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `dashboardController.alerts` |

**Success Response (200):**
```json
{
  "total_alertas": "integer",
  "criticas": [
    {
      "id_centro": "integer",
      "centro": "string (nombre_centro)",
      "id_producto": "integer",
      "producto": "string (nombre_producto)",
      "unidad_medida": "string",
      "cantidad_actual": "integer",
      "stock_minimo_alerta": "integer",
      "deficit": "integer"
    }
  ],
  "advertencias": [
    {
      "id_centro": "integer",
      "centro": "string",
      "id_producto": "integer",
      "producto": "string",
      "unidad_medida": "string",
      "cantidad_actual": "integer",
      "stock_minimo_alerta": "integer",
      "deficit": "integer"
    }
  ]
}
```

**Logic:**
- `criticas`: `cantidad_actual <= 0`
- `advertencias`: `0 < cantidad_actual <= stock_minimo_alerta`
- `deficit = stock_minimo_alerta - cantidad_actual`

---

### 4.3 GET /api/v1/dashboard/deviations

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `deviationController.getDeviations` |

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `centro` | integer | No | Filter by center ID |
| `mes` | string (YYYY-MM) | No | Month to analyze (default: current month) |

**Success Response (200):**
```json
{
  "mes": "string (YYYY-MM)",
  "total_desviaciones": "integer (count of 'exceso' items)",
  "desviaciones": [
    {
      "centro": { "id_centro": "int", "nombre_centro": "string" },
      "producto": { "id_producto": "int", "nombre_producto": "string", "unidad_medida": "string", "coste_unitario": "float" },
      "consumo_teorico": "integer",
      "consumo_real": "integer",
      "desviacion": "integer (real - teorico)",
      "porcentaje_consumido": "float",
      "coste_desviacion": "float",
      "estado": "exceso | infraconsumo | normal"
    }
  ]
}
```

**Logic:**
- Compares `consumo_teorico` table (monthly allowance per center/product) vs actual consumption from `registro_movimientos` for the month
- Sorted by deviation descending (worst first)
- `estado`: `exceso` (over-consumed), `infraconsumo` (under-consumed), `normal` (exactly on target)

---

## 5. Incidencias Endpoints

All under prefix: `/api/v1/incidencias` (requires `authenticate` middleware)

### 5.1 POST /api/v1/incidencias

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | `incidenciaController.createIncidencia` |

**Request Body:**
```json
{
  "id_centro": "integer",
  "categoria": "limpieza | fontaneria | electricidad | cerrajeria | otros",
  "titulo": "string (min 3 chars)",
  "descripcion": "string (optional)",
  "foto_url": "string (optional)"
}
```

**Success Response (201):**
```json
{
  "message": "Incidencia reportada correctamente.",
  "incidencia": {
    "id_incidencia": "integer",
    "id_centro": "integer",
    "id_usuario": "integer",
    "categoria": "string",
    "titulo": "string",
    "descripcion": "string",
    "foto_url": "string|null",
    "estado": "pendiente",
    "fecha_creacion": "ISO date string",
    "centro": { "id_centro": "int", "nombre_centro": "string" },
    "usuario": { "id_usuario": "int", "nombre": "string" }
  }
}
```

**Error Responses:**
- `400` — Invalid category, title too short, or missing center
- `403` — No active center assigned

**Behavior:**
- If `limpiador` role, resolves center from active assignment (can't specify a different center)
- Supervisor/admin can specify any center

---

### 5.2 GET /api/v1/incidencias

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | `incidenciaController.listIncidencias` |

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `centro` | integer | No | Filter by center ID |
| `estado` | string | No | Filter by state (pendiente, en_proceso, resuelta) |
| `categoria` | string | No | Filter by category |

**Success Response (200):**
```json
{
  "total": "integer",
  "incidencias": [
    {
      "id_incidencia": "integer",
      "id_centro": "integer",
      "id_usuario": "integer",
      "categoria": "string",
      "titulo": "string",
      "descripcion": "string",
      "foto_url": "string|null",
      "estado": "string (pendiente|en_proceso|resuelta)",
      "fecha_creacion": "ISO date string",
      "centro": { "id_centro": "int", "nombre_centro": "string" },
      "usuario": { "id_usuario": "int", "nombre": "string" }
    }
  ]
}
```

**Limits:** Max 100 results, ordered by `fecha_creacion DESC`.

---

### 5.3 PUT /api/v1/incidencias/:id

| Field | Detail |
|---|---|
| **HTTP Method** | `PUT` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `incidenciaController.updateIncidencia` |

**Path Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Incidencia ID (`id_incidencia`) |

**Request Body:**
```json
{
  "estado": "pendiente | en_proceso | resuelta"
}
```

**Success Response (200):**
```json
{
  "message": "Incidencia actualizada.",
  "incidencia": { "full incidencia object" }
}
```

---

## 6. Purchases Endpoints

All under prefix: `/api/v1/purchases` (requires `authenticate` + `authorize('supervisor', 'admin')`)

### 6.1 GET /api/v1/purchases/proposal

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `purchaseController.getProposal` |

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `centro` | integer | No | Filter by center ID |

**Success Response (200):**
```json
{
  "fecha_generacion": "ISO date string",
  "total_articulos": "integer",
  "total_unidades": "integer",
  "total_coste_estimado": "float",
  "propuestas": [
    {
      "centro": { "id_centro": "int", "nombre_centro": "string" },
      "producto": {
        "id_producto": "integer",
        "nombre_producto": "string",
        "unidad_medida": "string",
        "coste_unitario": "float"
      },
      "stock_actual": "integer",
      "stock_minimo": "integer",
      "deficit": "integer",
      "cantidad_pedido": "integer (rounded up to multiple of 5)",
      "coste_estimado": "float"
    }
  ]
}
```

**Logic:**
- Filters inventory where `cantidad_actual < stock_minimo_alerta`
- Calculates `deficit = stock_minimo - cantidad_actual`
- `cantidad_pedido = Math.ceil(deficit / 5) * 5` (rounds up to nearest 5)
- `coste_estimado = cantidad_pedido * coste_unitario`

---

## 7. Notifications Endpoints

All under prefix: `/api/v1/notifications` (requires `authenticate` + `authorize('supervisor', 'admin')`)

### 7.1 GET /api/v1/notifications

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `notificationsController.getNotifications` |

**Success Response (200):**
```json
{
  "notificaciones": [
    {
      "id_notificacion": "integer",
      "id_usuario": "integer",
      "titulo": "string",
      "mensaje": "string",
      "leida": "boolean",
      "fecha_creacion": "ISO date string"
    }
  ]
}
```

**Logic:** Returns max 50 notifications for the current user, newest first.

---

### 7.2 PUT /api/v1/notifications/:id/read

| Field | Detail |
|---|---|
| **HTTP Method** | `PUT` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `notificationsController.markAsRead` |

**Path Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Notification ID |

**Success Response (200):**
```json
{
  "success": true,
  "notificacion": { "full notification object with leida: true" }
}
```

**Security:** Ensures user can only mark own notifications as read (`WHERE id_usuario = req.user.id_usuario`).

---

### 7.3 GET /api/v1/notifications/rules

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `notificationsController.getRules` |

**Success Response (200):**
```json
{
  "reglas": [
    {
      "id_regla": "integer",
      "id_supervisor": "integer",
      "id_centro": "integer|null",
      "id_operario": "integer|null",
      "id_producto": "integer|null",
      "activa": "boolean",
      "centro": { "id_centro": "int", "nombre_centro": "string" } | null,
      "operario": { "id_usuario": "int", "nombre": "string" } | null,
      "producto": { "id_producto": "int", "nombre_producto": "string" } | null
    }
  ]
}
```

**Logic:** Returns rules where `id_supervisor = current user`.

---

### 7.4 POST /api/v1/notifications/rules

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `notificationsController.createRule` |

**Request Body:**
```json
{
  "id_centro": "integer (optional)",
  "id_operario": "integer (optional)",
  "id_producto": "integer (optional)"
}
```
All fields are optional (null = wildcard/any).

**Success Response (200):**
```json
{
  "message": "Regla creada",
  "regla": { "full regla object with relationships" }
}
```

---

### 7.5 DELETE /api/v1/notifications/rules/:id

| Field | Detail |
|---|---|
| **HTTP Method** | `DELETE` |
| **Auth Required** | Yes |
| **Role Required** | `supervisor` or `admin` |
| **Middleware** | `authenticate` → `authorize('supervisor', 'admin')` |
| **Controller** | `notificationsController.deleteRule` |

**Path Parameters:**
| Param | Type | Description |
|---|---|---|
| `id` | integer | Rule ID (`id_regla`) |

**Success Response (200):**
```json
{
  "success": true,
  "message": "Regla eliminada"
}
```

**Security:** Ensures user can only delete own rules (`WHERE id_supervisor = req.user.id_usuario`).

---

## 8. Push Notification Endpoints

All under prefix: `/api/v1/push` (mounted via `router.use('/push', pushRouter)`)

### 8.1 GET /api/v1/push/vapid-public-key

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | No |
| **Controller** | Inline route handler in `push.js` |

**Success Response (200):**
```json
{
  "publicKey": "string (VAPID_PUBLIC_KEY env var)"
}
```

---

### 8.2 POST /api/v1/push/subscribe

| Field | Detail |
|---|---|
| **HTTP Method** | `POST` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | Inline route handler in `push.js` |

**Request Body:**
```json
{
  "endpoint": "string",
  "p256dh": "string",
  "auth": "string"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "subscriptionId": "integer"
}
```

**Logic:** Upserts — if subscription exists for same user+endpoint, updates keys; otherwise creates new.

---

### 8.3 DELETE /api/v1/push/unsubscribe

| Field | Detail |
|---|---|
| **HTTP Method** | `DELETE` |
| **Auth Required** | Yes |
| **Middleware** | `authenticate` |
| **Controller** | Inline route handler in `push.js` |

**Request Body:**
```json
{
  "endpoint": "string"
}
```

**Success Response (200):**
```json
{
  "success": true
}
```

**Logic:** Deletes all push subscriptions matching user + endpoint.

---

## 9. System Endpoint

### 9.1 GET /health

| Field | Detail |
|---|---|
| **HTTP Method** | `GET` |
| **Auth Required** | No |
| **Handler** | Inline in `server.js` |

**Success Response (200):**
```json
{
  "status": "ok",
  "timestamp": "ISO date string"
}
```

---

## 10. WebSocket / Socket.IO Events

System: Socket.IO server (initialized in `server.js`, configured in `lib/socket.js`)

### 10.1 Client-to-Server Events

| Event | Payload | Description |
|---|---|---|
| `join:centro` | `centroId: number` | Client requests to join a center's room to receive real-time events. Validates `centroId` is a number. |
| `leave:centro` | `centroId: number` | Client leaves a center's room. |

### 10.2 Server-to-Client Events

| Event | Payload Shape | When Emitted |
|---|---|---|
| `stock:consumed` | `{ id_centro, id_producto, nombre_producto, cantidad (negative), usuario: { id_usuario, nombre }, cantidad_actual, timestamp }` | After `POST /stock/consume` — emitted to room `centro:{id_centro}` |
| `stock:restocked` | `{ id_centro, id_producto, nombre_producto, cantidad (positive), usuario: { id_usuario, nombre }, cantidad_actual, timestamp }` | After `POST /stock/restock` — emitted to room `centro:{id_centro}` |
| `stock:alert` | `{ id_centro, id_producto, nombre_producto, cantidad, usuario, cantidad_actual, timestamp, tipo: 'critica'|'advertencia', stock_minimo_alerta, deficit }` | After `stock:consumed` if `cantidad_actual <= stock_minimo_alerta` — emitted to room `centro:{id_centro}` |
| `joined:centro` | `{ centroId, room }` | Acknowledgement after `join:centro` |
| `left:centro` | `{ centroId, room }` | Acknowledgement after `leave:centro` |
| `error` | `{ message }` | Validation error (e.g., centroId not a number) |

### 10.3 Socket Connection Details

- **Auth:** JWT sent in `socket.handshake.auth.token` during handshake
- **Transport:** `['websocket', 'polling']`
- **Ping:** timeout 60s, interval 25s
- **Rooms per center:** Named `centro:{centroId}` (e.g., `centro:3`)
- **Roles:** All authenticated users can connect; supervisors typically join centro rooms for monitoring

---

## 11. Database Models Reference

Mapping from Prisma models to PostgreSQL tables:

| Model | Table | Key Fields |
|---|---|---|
| `Usuario` | `usuarios` | `id_usuario` (PK), `nombre`, `email` (unique), `password_hash`, `rol`, `estado` |
| `Centro` | `centros` | `id_centro` (PK), `nombre_centro`, `direccion`, `presupuesto_mensual` |
| `Producto` | `productos` | `id_producto` (PK), `nombre_producto`, `unidad_medida`, `stock_minimo_alerta`, `coste_unitario` |
| `AsignacionPersonal` | `asignaciones_personal` | `id_asignacion` (PK), `id_usuario` (FK), `id_centro` (FK), `fecha_inicio`, `fecha_fin` (nullable) |
| `InventarioCentro` | `inventario_centros` | Composite PK: `(id_centro, id_producto)`, `cantidad_actual` |
| `RefreshToken` | `refresh_tokens` | `id_refresh_token` (PK), `id_usuario` (FK), `token` (unique), `expires_at`, `revoked` |
| `RegistroMovimiento` | `registro_movimientos` | `id_movimiento` (PK), `id_usuario`, `id_centro`, `id_producto`, `cantidad`, `fecha_hora` |
| `ConsumoTeorico` | `consumo_teorico` | Composite PK: `(id_centro, id_producto)`, `cantidad_teorica` |
| `Incidencia` | `incidencias` | `id_incidencia` (PK), `id_centro`, `id_usuario`, `categoria`, `titulo`, `descripcion`, `foto_url`, `estado`, `fecha_creacion` |
| `ReglaNotificacion` | `reglas_notificacion` | `id_regla` (PK), `id_supervisor`, `id_centro` (nullable), `id_operario` (nullable), `id_producto` (nullable), `activa` |
| `Notificacion` | `notificaciones` | `id_notificacion` (PK), `id_usuario`, `titulo`, `mensaje`, `leida`, `fecha_creacion` |
| `PushSubscription` | `push_subscriptions` | `id` (PK), `endpoint` (unique), `p256dh`, `auth`, `usuarioId` (FK) |

---

## 12. Auth & Middleware Summary

### Auth Flow (Express → Supabase)

| Express Concept | Supabase Equivalent |
|---|---|
| JWT signed with `JWT_SECRET` env var | `supabase.auth.signInWithPassword()` / `supabase.auth.getSession()` |
| Custom `refresh_tokens` table with rotation | `supabase.auth.refreshSession()` handles rotation automatically |
| Roles stored in `usuarios.rol` | Custom JWT claim (`app_metadata.rol`) or custom `usuarios` table + `supabase.rpc()` for role checks |
| `authenticate` middleware (JWT verification) | Built-in `supabase.auth.getUser()` in Edge Functions |
| `authorize('supervisor', 'admin')` factory | Custom helper checking `req.user.app_metadata.rol` or DB lookup |
| bcryptjs password hashing | `supabase.auth.signUp()` handles hashing, or use `bcryptjs` in Edge Function |
| Token expiry: 15min access + 30 day refresh (with rotation) | Configurable via Supabase Auth settings (default 1h access, unlimited refresh) |

### Role Hierarchy

```
admin     → everything
supervisor → dashboard, restock, incidencias management, assignments, notifications, purchases
limpiador  → consume stock, view own inventory, report incidencias
```

### Middleware Chain Order

```
1. authenticate → verifies Bearer JWT, attaches req.user { id_usuario, email, rol }
2. authorize('role1', 'role2') → checks req.user.rol is in allowed list (403 if not)
3. validate(schema) → Zod schema validation on req.body (400 if invalid)
```

---

## Endpoint Summary Table

| # | Method | Path | Auth | Roles | Validation | Controller | Socket Events |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/auth/login` | No | — | loginSchema | authController.login | — |
| 2 | POST | `/auth/register` | Yes | admin | registerSchema | authController.register | — |
| 3 | GET | `/auth/verify` | Yes | any | — | authController.verify | — |
| 4 | POST | `/auth/refresh` | No | — | refreshSchema | authController.refresh | — |
| 5 | POST | `/auth/logout` | Yes | any | — | authController.logout | — |
| 6 | GET | `/stock/inventory` | Yes | any | — | stockController.getInventory | — |
| 7 | GET | `/stock/centros` | Yes | any | — | stockController.getCentros | — |
| 8 | POST | `/stock/consume` | Yes | any | consumeStockSchema | stockController.consumeStock | `stock:consumed`, `stock:alert` |
| 9 | POST | `/stock/restock` | Yes | supervisor, admin | restockSchema | stockController.restock | `stock:restocked` |
| 10 | GET | `/stock/alerts` | Yes | any | — | stockController.getAlerts | — |
| 11 | GET | `/asignaciones/active` | Yes | any | — | asignacionController.getActive | — |
| 12 | GET | `/asignaciones/users` | Yes | any | — | asignacionController.getAllUsers | — |
| 13 | GET | `/asignaciones` | Yes | any | — | asignacionController.list | — |
| 14 | POST | `/asignaciones` | Yes | supervisor, admin | createAsignacionSchema | asignacionController.create | — |
| 15 | PUT | `/asignaciones/:id` | Yes | supervisor, admin | updateAsignacionSchema | asignacionController.update | — |
| 16 | GET | `/dashboard/consumption` | Yes | supervisor, admin | — | dashboardController.consumption | — |
| 17 | GET | `/dashboard/alerts` | Yes | supervisor, admin | — | dashboardController.alerts | — |
| 18 | GET | `/dashboard/deviations` | Yes | supervisor, admin | — | deviationController.getDeviations | — |
| 19 | POST | `/incidencias` | Yes | any | — | incidenciaController.createIncidencia | — |
| 20 | GET | `/incidencias` | Yes | any | — | incidenciaController.listIncidencias | — |
| 21 | PUT | `/incidencias/:id` | Yes | supervisor, admin | — | incidenciaController.updateIncidencia | — |
| 22 | GET | `/purchases/proposal` | Yes | supervisor, admin | — | purchaseController.getProposal | — |
| 23 | GET | `/notifications` | Yes | supervisor, admin | — | notificationsController.getNotifications | — |
| 24 | PUT | `/notifications/:id/read` | Yes | supervisor, admin | — | notificationsController.markAsRead | — |
| 25 | GET | `/notifications/rules` | Yes | supervisor, admin | — | notificationsController.getRules | — |
| 26 | POST | `/notifications/rules` | Yes | supervisor, admin | — | notificationsController.createRule | — |
| 27 | DELETE | `/notifications/rules/:id` | Yes | supervisor, admin | — | notificationsController.deleteRule | — |
| 28 | GET | `/push/vapid-public-key` | No | — | — | Inline (push.js) | — |
| 29 | POST | `/push/subscribe` | Yes | any | — | Inline (push.js) | — |
| 30 | DELETE | `/push/unsubscribe` | Yes | any | — | Inline (push.js) | — |
| 31 | GET | `/health` | No | — | — | Inline (server.js) | — |

**Total: 31 endpoints** (30 API + 1 health check)

---

## Migration Notes for Supabase Edge Functions

### Authentication Strategy
1. **Option A (Recommended):** Use Supabase Auth natively
   - Replace custom JWT with `supabase-js` Auth
   - Map `usuarios` table to Supabase Auth users via `auth.users`
   - Store custom claims (rol) in `raw_app_meta_data`
   - Use `supabase.auth.getUser()` in each Edge Function for JWT verification
   - Refresh token rotation handled automatically by Supabase Auth client

2. **Option B (Custom):** Keep custom auth in Edge Functions
   - Build `authenticate` and `authorize` as reusable Edge Function middleware
   - Use `jose` library (works in Edge Runtime) for JWT verification
   - Store refresh tokens in a `refresh_tokens` table
   - Implement token rotation logic in the `/auth/refresh` Edge Function

### Real-time / Realtime
- **Socket.IO** rooms per center → **Supabase Realtime** channels
  - Server events (`stock:consumed`, `stock:restocked`, `stock:alert`) → Broadcast via Realtime
  - Socket `join:centro` / `leave:centro` → Subscribe/unsubscribe to a Realtime channel per centro
  - Use Postgres replication: INSERT on `registro_movimientos` triggers Realtime broadcast
  - Client-side: Use `supabase-js` Realtime subscription instead of `socket.io-client`

### Push Notifications
- Currently uses `web-push` (Web Push Protocol with VAPID)
- Can be migrated to a Supabase Edge Function that calls the Web Push API directly
- Subscription management (CRUD) can stay as Edge Functions against the `push_subscriptions` table

### File Structure Migration
```
/root/clean_ops/src/
├── controllers/    → /supabase/functions/{endpoint-name}/index.ts
├── middleware/     → /supabase/functions/_shared/middleware.ts
├── routes/        → (routes defined by function directory structure)
├── lib/           → /supabase/functions/_shared/
├── prisma/        → /supabase/migrations/ (SQL schema)
└── config/        → /supabase/functions/_shared/config.ts
```

### Edge Functions Recommended Structure
```
supabase/
├── functions/
│   ├── _shared/
│   │   ├── cors.ts
│   │   ├── auth.ts         (authenticate + authorize helpers)
│   │   ├── validate.ts     (Zod validation)
│   │   ├── prisma.ts       (Supabase client)
│   │   └── push.ts         (Web Push helper)
│   ├── health/             (GET /health)
│   ├── auth-login/
│   ├── auth-register/
│   ├── auth-verify/
│   ├── auth-refresh/
│   ├── auth-logout/
│   ├── stock-inventory/    (GET /stock/inventory)
│   ├── stock-centros/      (GET /stock/centros)
│   ├── stock-consume/      (POST /stock/consume)
│   ├── stock-restock/      (POST /stock/restock)
│   ├── stock-alerts/       (GET /stock/alerts)
│   ├── asignaciones-active/
│   ├── asignaciones-users/
│   ├── asignaciones-list/  (GET /asignaciones)
│   ├── asignaciones-create/(POST /asignaciones)
│   ├── asignaciones-update/(PUT /asignaciones/:id)
│   ├── dashboard-consumption/
│   ├── dashboard-alerts/
│   ├── dashboard-deviations/
│   ├── incidencias-create/ (POST /incidencias)
│   ├── incidencias-list/   (GET /incidencias)
│   ├── incidencias-update/ (PUT /incidencias/:id)
│   ├── purchases-proposal/
│   ├── notifications-list/ (GET /notifications)
│   ├── notifications-read/ (PUT /notifications/:id/read)
│   ├── notification-rules-list/   (GET /notifications/rules)
│   ├── notification-rules-create/ (POST /notifications/rules)
│   ├── notification-rules-delete/ (DELETE /notifications/rules/:id)
│   ├── push-vapid-key/     (GET /push/vapid-public-key)
│   ├── push-subscribe/     (POST /push/subscribe)
│   └── push-unsubscribe/   (DELETE /push/unsubscribe)
├── migrations/
│   └── 001_initial_schema.sql
└── config.toml
```
