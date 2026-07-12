# CleanStock

**Sistema de gestión de inventario para empresas de limpieza**

CleanStock permite a supervisores y operarios gestionar productos, inventarios y consumos en tiempo real desde cualquier dispositivo.

---

## 🚀 Demo

- **Landing:** https://cleanstock.kavanasystems.com/welcome/
- **Regístrate:** https://cleanstock.kavanasystems.com/registro/
- **Panel Supervisor:** https://cleanstock.kavanasystems.com/ 
- **App Operario:** https://cleanstock.kavanasystems.com/empleado/

---

## 🛠️ Tecnología

| Capa | Tecnología |
|------|------------|
| **Frontend** | React + Vite + TailwindCSS |
| **Backend** | Node.js + Express + Prisma ORM |
| **Database** | PostgreSQL 16 |
| **Auth** | JWT + bcrypt |

---

## 📁 Estructura del Proyecto

```
clean-stock/
├── src/app.js              # API Express (Docker + Vercel compatible)
├── prisma/
│   ├── schema.prisma       # Esquema de base de datos
│   └── migrations/       # Migraciones SQL
├── dashboard/              # Panel supervisor (React/Vite)
├── mobile/                 # App operario (React/Vite)
├── api/index.js           # Wrapper Vercel serverless
├── vercel.json            # Configuración Vercel
├── docker-compose.yml     # Deploy VPS
└── README.md
```

---

## 🔧 Despliegue

### Opción A: VPS (Producción)

```bash
# En el VPS
docker compose pull  # Si usas imágenes prebuild
docker compose up -d
```

**Variables de entorno (.env):**
```env
DATABASE_URL=postgresql://kavana:***@db:5432/kavana_cleanstock
JWT_SECRET=tu-secret-jwt
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notificaciones@tudominio.com
SMTP_PASS=app-password-de-gmail
SMTP_FROM=CleanStock <notificaciones@tudominio.com>
```

### Opción B: Vercel (Sin VPS)

1. Configura variables en Vercel Dashboard:
   ```
   DATABASE_URL=postgresql://postgres:***@db.[PROJECT].supabase.co:5432/postgres
   SUPABASE_ANON_KEY=[anon public key]
   SUPABASE_SERVICE_ROLE_KEY=[service role key]
   JWT_SECRET=tu-secret-jwt
   ```

2. Deploy:
   ```bash
   npm install -g vercel
   vercel --prod
   ```

---

## 📚 API Endpoints

### Auth
- `POST /api/v1/auth/login` — Login (email o username)
- `POST /api/v1/auth/register-empresa` — Registro trial 30 días

### Recursos
- `GET /api/v1/dashboard` — Stats generales
- `GET /api/v1/categorias` — Listar categorías
- `GET /api/v1/productos?search=&categoria=` — Listar productos
- `GET /api/v1/centros` — Listar centros
- `GET /api/v1/empleados` — Listar operarios (supervisor+)
- `GET /api/v1/inventario?centro=` — Stock por centro
- `GET /api/v1/consumos?centro=` — Historial consumos
- `GET /api/v1/incidencias` — Listar incidencias

### Admin (Super Admin)
- `GET /api/v1/admin/clientes` — Listar clientes
- `GET /api/v1/admin/clientes/:id` — Detalle cliente
- `PUT /api/v1/admin/clientes/:id` — Actualizar plan/estado
- `GET /api/v1/admin/stats` — Estadísticas SaaS

---

## 💰 Planes SaaS

| Característica | Basic (9€/mes) | Pro (29€/mes) |
|----------------|----------------|----------------|
| Empleados | 5 usuarios | Ilimitados |
| Centros | 3 centros | Ilimitados |
| Histórico consumos | 60 días | Ilimitado |
| Exportar datos | ❌ | ✅ CSV/PDF |
| Notificaciones push | ❌ | ✅ |

---

## 📱 APK Android

El proyecto incluye Capacitor en `/mobile/android/`.  
Genera el APK con Android Studio desde `mobile/` → **Build > Generate Signed Bundle/APK**.

---

## 🔐 Credenciales por defecto

Al registrarte recibes:
- **Email:** el que usaste en el formulario
- **Contraseña:** la que elegiste
- **Rol:** supervisor (acceso a todo el negocio)
- **Trial:** 30 días gratis

---

## 🆘 Soporte

Contacto: kavanasystems.info@gmail.com