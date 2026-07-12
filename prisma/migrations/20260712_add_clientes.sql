-- CleanStock SaaS — Migración: Clientes + Suscripciones
-- Añade tabla clientes y columnas relacionadas
-- No elimina ni modifica columnas existentes

-- 1. Crear tabla clientes
CREATE TABLE IF NOT EXISTS "clientes" (
    "id_cliente" SERIAL NOT NULL,
    "nombre_empresa" TEXT NOT NULL,
    "email_contacto" TEXT NOT NULL,
    "telefono" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'basic',
    "estado" TEXT NOT NULL DEFAULT 'trial',
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trial_fin" TIMESTAMP(3) NOT NULL,
    "fecha_renovacion" TIMESTAMP(3),
    "notas" TEXT,
    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id_cliente")
);

-- 2. Añadir columnas a usuarios (solo si no existen)
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "id_cliente" INTEGER;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "is_super_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "telefono" TEXT;

-- 3. Añadir columna a centros
ALTER TABLE "centros" ADD COLUMN IF NOT EXISTS "id_cliente" INTEGER;

-- 4. Foreign keys
ALTER TABLE "usuarios" DROP CONSTRAINT IF EXISTS "usuarios_id_cliente_fkey";
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_cliente_fkey" 
    FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "centros" DROP CONSTRAINT IF EXISTS "centros_id_cliente_fkey";
ALTER TABLE "centros" ADD CONSTRAINT "centros_id_cliente_fkey" 
    FOREIGN KEY ("id_cliente") REFERENCES "clientes"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Crear super admin si no existe (Jorge)
INSERT INTO "usuarios" ("nombre", "email", "password_hash", "rol", "estado", "is_super_admin")
SELECT 'Jorge Adán', 'kavanasystems.info@gmail.com', 
       '$2a$12$LJ3m4ys3Lg3Yx0S0wYs1s.Yh0R8wOBX5p.h5s5q5s5q5s5q5s5q5O', 
       'admin', 'activo', true
WHERE NOT EXISTS (SELECT 1 FROM "usuarios" WHERE "email" = 'kavanasystems.info@gmail.com');

-- 6. Índices
CREATE INDEX IF NOT EXISTS "idx_usuarios_id_cliente" ON "usuarios"("id_cliente");
CREATE INDEX IF NOT EXISTS "idx_centros_id_cliente" ON "centros"("id_cliente");
CREATE INDEX IF NOT EXISTS "idx_clientes_estado" ON "clientes"("estado");
