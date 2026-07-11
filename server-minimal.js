// ============================
// CleanStock v2 API — server-minimal.js
// ============================
require('dotenv').config({ path: '/root/clean_ops/.env' });
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const prisma = new PrismaClient();
const JWT_SECRET=proces...CRET || 'cleanstock-fallback';

// Auth middleware

// ---- AUTH ----
route('post', '/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const u = await prisma.usuario.findUnique({ where: { email } });
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'Credenciales inválidas' });
  if (u.estado !== 'activo') return res.status(403).json({ error: 'Cuenta no activa' });
  const token = jwt.sign({ id_usuario: u.id_usuario, email, rol: u.rol }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, usuario: { id_usuario: u.id_usuario, nombre: u.nombre, apellidos: u.apellidos, email: u.email, rol: u.rol, numero_empleado: u.numero_empleado } });
});

// ---- CATEGORIAS ----
route('get', '/categorias', auth, async (req, res) => {
  const cats = await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } });
  ok({ categorias: cats });
});
route('post', '/categorias', auth, supervisorOnly, async (req, res) => {
  const cat = await prisma.categoria.create({ data: req.body });
  ok({ categoria: cat });
});

// ---- PRODUCTOS ----
route('get', '/productos', auth, async (req, res) => {
  const { search, categoria } = req.query;
  const where = {};
  if (search) where.nombre = { contains: search, mode: 'insensitive' };
  if (categoria) where.id_categoria = parseInt(categoria);
  const prods = await prisma.producto.findMany({ where, include: { categoria: true }, orderBy: { nombre: 'asc' } });
  ok({ productos: prods });
});
route('post', '/productos', auth, supervisorOnly, async (req, res) => {
  const p = await prisma.producto.create({ data: req.body });
  ok({ producto: p });
});
route('put', '/productos/:id', auth, supervisorOnly, async (req, res) => {
  const p = await prisma.producto.update({ where: { id_producto: parseInt(req.params.id) }, data: req.body });
  ok({ producto: p });
});

// ---- CENTROS ----
route('get', '/centros', auth, async (req, res) => {
  const centros = await prisma.centro.findMany({ orderBy: { nombre: 'asc' },
    include: { _count: { select: { usuarios: true, inventario_centros: true } } }
  });
  ok({ centros });
});
route('post', '/centros', auth, supervisorOnly, async (req, res) => {
  const c = await prisma.centro.create({ data: req.body });
  ok({ centro: c });
});

// ---- EMPLEADOS ----
route('get', '/empleados', auth, supervisorOnly, async (req, res) => {
  const users = await prisma.usuario.findMany({
    where: { rol: 'limpiador' },
    select: { id_usuario: true, nombre: true, apellidos: true, email: true, numero_empleado: true, estado: true, centro: true },
    orderBy: { nombre: 'asc' }
  });
  ok({ empleados: users });
});
route('post', '/empleados', auth, supervisorOnly, async (req, res) => {
  const { nombre, apellidos, email, password, numero_empleado, id_centro } = req.body;
  const hash = await bcrypt.hash(password || 'cleanstock', 12);
  const u = await prisma.usuario.create({ data: { nombre, apellidos, email, password_hash: hash, numero_empleado, id_centro, rol: 'limpiador' } });
  ok({ empleado: { id_usuario: u.id_usuario, nombre: u.nombre, apellidos: u.apellidos, email: u.email } });
});
route('put', '/empleados/:id', auth, supervisorOnly, async (req, res) => {
  const u = await prisma.usuario.update({ where: { id_usuario: parseInt(req.params.id) }, data: req.body });
  ok({ empleado: u });
});

// ---- INVENTARIO ----
route('get', '/inventario', auth, async (req, res) => {
  const { centro, search, bajo_stock } = req.query;
  const where = {};
  if (centro) where.id_centro = parseInt(centro);
  const items = await prisma.inventarioCentro.findMany({
    where,
    include: { producto: { include: { categoria: true } }, centro: true },
    orderBy: { producto: { nombre: 'asc' } }
  });
  let result = items;
  if (search) result = result.filter(i => i.producto.nombre.toLowerCase().includes(search.toLowerCase()));
  if (bajo_stock === 'true') result = result.filter(i => i.cantidad_actual <= (i.stock_minimo || 0) && i.stock_minimo > 0);
  ok({ inventario: result });
});
route('post', '/inventario', auth, supervisorOnly, async (req, res) => {
  const { id_centro, id_producto, cantidad_actual, stock_minimo, stock_maximo } = req.body;
  const item = await prisma.inventarioCentro.upsert({
    where: { id_centro_id_producto: { id_centro, id_producto } },
    update: { cantidad_actual, stock_minimo, stock_maximo, fecha_actualizacion: new Date() },
    create: { id_centro, id_producto, cantidad_actual, stock_minimo, stock_maximo }
  });
  ok({ inventario: item });
});

// ---- CONSUMOS ----
route('get', '/consumos', auth, async (req, res) => {
  const { centro, desde, hasta } = req.query;
  const where = { tipo: 'consumo' };
  if (centro) where.id_centro = parseInt(centro);
  if (desde) where.fecha_hora = { gte: new Date(desde) };
  const movs = await prisma.registroMovimiento.findMany({
    where, include: { producto: true, centro: true, usuario: { select: { nombre: true, apellidos: true } } },
    orderBy: { fecha_hora: 'desc' }, take: 200
  });
  ok({ consumos: movs });
});
route('post', '/consumos', auth, async (req, res) => {
  const { id_centro, id_producto, cantidad, observaciones } = req.body;
  const inv = await prisma.inventarioCentro.findUnique({ where: { id_centro_id_producto: { id_centro, id_producto } } });
  if (!inv || inv.cantidad_actual < cantidad) return res.status(400).json({ error: 'Stock insuficiente' });
  await prisma.inventarioCentro.update({ where: { id_centro_id_producto: { id_centro, id_producto } }, data: { cantidad_actual: inv.cantidad_actual - cantidad, fecha_actualizacion: new Date() } });
  const mov = await prisma.registroMovimiento.create({ data: { id_centro, id_producto, id_usuario: req.user.id_usuario, cantidad: -Math.abs(cantidad), tipo: 'consumo', observaciones } });
  ok({ consumo: mov });
});
route('post', '/inventario/reponer', auth, supervisorOnly, async (req, res) => {
  const { id_centro, id_producto, cantidad } = req.body;
  const inv = await prisma.inventarioCentro.findUnique({ where: { id_centro_id_producto: { id_centro, id_producto } } });
  const nueva = (inv?.cantidad_actual || 0) + cantidad;
  await prisma.inventarioCentro.upsert({
    where: { id_centro_id_producto: { id_centro, id_producto } },
    update: { cantidad_actual: nueva, fecha_actualizacion: new Date() },
    create: { id_centro, id_producto, cantidad_actual: cantidad }
  });
  ok({ message: 'Repuesto' });
});

// ---- DASHBOARD ----
route('get', '/dashboard', auth, async (req, res) => {
  const totalProductos = await prisma.producto.count();
  const totalCentros = await prisma.centro.count();
  const totalEmpleados = await prisma.usuario.count({ where: { rol: 'limpiador' } });
  const bajoStock = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as count FROM inventario_centros WHERE cantidad_actual <= stock_minimo AND stock_minimo > 0`
  );
  const bajoStockCount = parseInt(bajoStock[0]?.count || 0);
  const consumosHoyResult = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as count FROM registro_movimientos WHERE tipo = 'consumo' AND fecha_hora >= CURRENT_DATE`
  );
  const consumosHoy = parseInt(consumosHoyResult[0]?.count || 0);
  // Top products consumed
  const topRaw = await prisma.$queryRawUnsafe(
    `SELECT id_producto, SUM(ABS(cantidad)) as total FROM registro_movimientos WHERE tipo='consumo' GROUP BY id_producto ORDER BY total DESC LIMIT 5`
  );
  const tops = await prisma.producto.findMany({ where: { id_producto: { in: topRaw.map(t => t.id_producto) } } });
  ok({ totalProductos, totalCentros, totalEmpleados, bajoStock: bajoStockCount, consumosHoy, topConsumos: tops.map(p => ({ producto: p.nombre, cantidad: parseInt(topRaw.find(t => t.id_producto === p.id_producto)?.total || 0) })) });
});

// ---- INCIDENCIAS ----
route('get', '/incidencias', auth, async (req, res) => {
  const incs = await prisma.incidencia.findMany({ include: { centro: true, usuario: { select: { nombre: true, apellidos: true } } }, orderBy: { fecha_creacion: 'desc' } });
  ok({ incidencias: incs });
});
route('post', '/incidencias', auth, async (req, res) => {
  const inc = await prisma.incidencia.create({ data: { ...req.body, id_usuario: req.user.id_usuario } });
  ok({ incidencia: inc });
});
route('put', '/incidencias/:id', auth, supervisorOnly, async (req, res) => {
  const inc = await prisma.incidencia.update({ where: { id_incidencia: parseInt(req.params.id) }, data: { estado: req.body.estado } });
  ok({ incidencia: inc });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CleanStock v2 API on ${PORT}`));
