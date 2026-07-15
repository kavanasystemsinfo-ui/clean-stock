// Seed de DEMOSTRACIÓN — Caso real de la cuñada (encargada limpieza Valencia)
// Centros: Diputación, Beneficencia, Plaza de Toros, Museo Bellas Artes
// Producto estrella: Papel (consumo anómalo en Plaza de Toros)
//
// Uso: node prisma/seed-demo-cunada.js
// Carga datos de ejemplo en la BD que ya corre (definida por DATABASE_URL en .env).
// Idempotente: si ya existe el cliente demo, no duplica.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EMPRESA_DEMO = 'Limpiezas Valencia Centro, S.L.';

async function main() {
  console.log('→ Seed demo CleanStock (caso cuñada)...');

  // 1. Cliente demo (idempotente por nombre)
  let cliente = await prisma.cliente.findFirst({ where: { nombre_empresa: EMPRESA_DEMO } });
  if (!cliente) {
    cliente = await prisma.cliente.create({
      data: {
        nombre_empresa: EMPRESA_DEMO,
        email_contacto: 'cuñada@limpiezasvalencia.demo',
        telefono: '600000000',
        plan: 'pro',
        estado: 'trial',
        trial_fin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notas: 'Cliente piloto demo — caso real centros descentralizados Valencia',
      },
    });
    console.log('  ✓ Cliente demo creado:', cliente.id_cliente);
  } else {
    console.log('  • Cliente demo ya existe:', cliente.id_cliente);
  }

  const idCliente = cliente.id_cliente;

  // 2. Centros (sus centros reales)
  const centrosDef = [
    'Diputación de Valencia',
    'Beneficencia',
    'Plaza de Toros',
    'Museo Bellas Artes',
  ];
  const centros = {};
  for (const nombre of centrosDef) {
    let c = await prisma.centro.findFirst({ where: { nombre_centro: nombre, id_cliente: idCliente } });
    if (!c) {
      c = await prisma.centro.create({
        data: { nombre_centro: nombre, direccion: 'Valencia', presupuesto_mensual: 1500, id_cliente: idCliente },
      });
      console.log('  ✓ Centro creado:', c.nombre_centro);
    } else {
      console.log('  • Centro ya existe:', c.nombre_centro);
    }
    centros[nombre] = c.id_centro;
  }

  // 3. Productos
  const productosDef = [
    { nombre: 'Papel higiénico (rollo)', unidad: 'rollos', coste: 0.8, min: 5 },
    { nombre: 'Papel industrial (rollo)', unidad: 'rollos', coste: 1.2, min: 3 },
    { nombre: 'Lejía', unidad: 'litros', coste: 1.5, min: 4 },
    { nombre: 'Guantes de limpieza', unidad: 'pares', coste: 0.3, min: 10 },
    { nombre: 'Bolsas de basura', unidad: 'paquetes', coste: 2.0, min: 5 },
  ];
  const productos = {};
  for (const p of productosDef) {
    let prod = await prisma.producto.findFirst({ where: { nombre_producto: p.nombre } });
    if (!prod) {
      prod = await prisma.producto.create({
        data: { nombre_producto: p.nombre, unidad_medida: p.unidad, coste_unitario: p.coste, stock_minimo_alerta: p.min },
      });
      console.log('  ✓ Producto creado:', prod.nombre_producto);
    } else {
      console.log('  • Producto ya existe:', prod.nombre_producto);
    }
    productos[p.nombre] = prod.id_producto;
  }

  // 4. Inventario actual por centro (stock presente)
  for (const [nombreCentro, idCentro] of Object.entries(centros)) {
    for (const [nombreProd, idProd] of Object.entries(productos)) {
      const existe = await prisma.inventarioCentro.findUnique({ where: { id_centro_id_producto: { id_centro: idCentro, id_producto: idProd } } });
      if (!existe) {
        await prisma.inventarioCentro.create({
          data: { id_centro: idCentro, id_producto: idProd, cantidad_actual: 20, stock_minimo: 5 },
        });
      }
    }
  }
  console.log('  ✓ Inventario inicializado');

  // 5. Consumo teóico: papel 10 rollos/mes por centro
  for (const [nombreCentro, idCentro] of Object.entries(centros)) {
    const idPapel = productos['Papel higiénico (rollo)'];
    const existe = await prisma.consumoTeorico.findUnique({ where: { id_centro_id_producto: { id_centro: idCentro, id_producto: idPapel } } });
    if (!existe) {
      await prisma.consumoTeorico.create({ data: { id_centro: idCentro, id_producto: idPapel, cantidad_teorica: 10 } });
    }
  }
  console.log('  ✓ Consumo teórico de papel (10/mes) definido');

  // 6. Usuarios (supervisor + operarios para trazabilidad "quién cogió qué")
  const pw = await bcrypt.hash('demo1234', 10);
  let supervisor = await prisma.usuario.findFirst({ where: { email: 'supervisor.demo@cleanstock.com' } });
  if (!supervisor) {
    supervisor = await prisma.usuario.create({
      data: { nombre: 'Zaira García', email: 'supervisor.demo@cleanstock.com', username: 'zaira', password_hash: pw, rol: 'supervisor', id_cliente: idCliente },
    });
    console.log('  ✓ Supervisor creado (Zaira García)');
  }
  const operarios = [
    { nombre: 'María L.', centro: 'Diputación de Valencia' },
    { nombre: 'José P.', centro: 'Beneficencia' },
    { nombre: 'Lucía R.', centro: 'Plaza de Toros' },
    { nombre: 'Antonio M.', centro: 'Museo Bellas Artes' },
  ];
  const opPorCentro = {};
  for (const op of operarios) {
    const email = op.nombre.toLowerCase().replace(/[^a-z.]/g, '') + '@cleanstock.com';
    let u = await prisma.usuario.findFirst({ where: { email } });
    if (!u) {
      u = await prisma.usuario.create({
        data: { nombre: op.nombre, email, username: op.nombre.split(' ')[0].toLowerCase(), password_hash: pw, rol: 'limpiador', id_cliente: idCliente },
      });
      await prisma.asignacionPersonal.create({
        data: { id_usuario: u.id_usuario, id_centro: centros[op.centro], fecha_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      });
      console.log('  ✓ Operario creado:', op.nombre, '→', op.centro);
    }
    opPorCentro[op.centro] = u.id_usuario;
  }

  // 7. Movimientos de consumo (trazabilidad) — PLAZA DE TOROS ANÓMALO
  // Consumo del mes actual. Plaza de Toros: 35 rollos (3.5x teórico 10).
  // Resto: dentro de lo normal.
  const ahora = Date.now();
  const diasAtras = (d) => new Date(ahora - d * 24 * 60 * 60 * 1000);
  const consumos = [
    { centro: 'Diputación de Valencia', prod: 'Papel higiénico (rollo)', qty: 12, op: 'María L.', dia: 2 },
    { centro: 'Beneficencia', prod: 'Papel higiénico (rollo)', qty: 9, op: 'José P.', dia: 3 },
    { centro: 'Plaza de Toros', prod: 'Papel higiénico (rollo)', qty: 35, op: 'Lucía R.', dia: 1 }, // ANÓMALO
    { centro: 'Museo Bellas Artes', prod: 'Papel higiénico (rollo)', qty: 11, op: 'Antonio M.', dia: 4 },
    { centro: 'Plaza de Toros', prod: 'Lejía', qty: 6, op: 'Lucía R.', dia: 5 },
    { centro: 'Diputación de Valencia', prod: 'Guantes de limpieza', qty: 14, op: 'María L.', dia: 6 },
  ];
  for (const m of consumos) {
    const idCentro = centros[m.centro];
    const idProd = productos[m.prod];
    const idOp = opPorCentro[m.centro];
    // Evita duplicar si ya hay movimiento similar este mes (idempotencia suave)
    const ya = await prisma.registroMovimiento.findFirst({
      where: { id_centro: idCentro, id_producto: idProd, id_usuario: idOp, fecha_hora: { gte: new Date(ahora - 10 * 24 * 60 * 60 * 1000) } },
    });
    if (!ya) {
      await prisma.registroMovimiento.create({
        data: { id_usuario: idOp, id_centro: idCentro, id_producto: idProd, cantidad: -m.qty, fecha_hora: diasAtras(m.dia) },
      });
      // Decrementa inventario
      await prisma.inventarioCentro.update({
        where: { id_centro_id_producto: { id_centro: idCentro, id_producto: idProd } },
        data: { cantidad_actual: { decrement: m.qty }, fecha_actualizacion: new Date() },
      });
    }
  }
  console.log('  ✓ Movimientos de consumo registrados (Plaza de Toros anómalo: 35 rollos)');

  // 8. Regla de notificación: alertar a la encargada si consumo de papel en cualquier centro
  const reglaExiste = await prisma.reglaNotificacion.findFirst({ where: { id_supervisor: supervisor.id_usuario, id_producto: productos['Papel higiénico (rollo)'] } });
  if (!reglaExiste) {
    await prisma.reglaNotificacion.create({
      data: { id_supervisor: supervisor.id_usuario, id_producto: productos['Papel higiénico (rollo)'], activa: true },
    });
    console.log('  ✓ Regla de alerta de papel creada');
  }

  console.log('\n✅ Demo lista. Login encargada: supervisor.demo@cleanstock.com / demo1234');
  console.log('   Centros: Diputación, Beneficencia, Plaza de Toros, Museo Bellas Artes');
  console.log('   Alerta esperada: Plaza de Toros consumió 35 rollos (teórico 10/mes) → desviación 250%');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
