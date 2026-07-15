// Kavana CleanStock — Deviation Controller
// Calcula la desviación de consumo real vs. teórico por centro/producto.
// Contrato de salida (ver dashboard/src/lib/api.ts -> DeviationsData):
//   { mes, total_desviaciones, desviaciones: [{ centro, producto, consumo_teorico,
//     consumo_real, desviacion, porcentaje_consumido, coste_desviacion, estado }] }

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Umbral (en unidades) por debajo del cual la desviación se considera "normal".
const UMBRAL_NORMAL = 1;

function mesAnteriorISO(fecha = new Date()) {
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function getDeviations(req, res) {
  try {
    const usuario = req.user;
    if (!usuario) return res.status(401).json({ error: 'No autenticado' });

    // El token puede no traer id_cliente; lo resolvemos desde la BD.
    let idCliente = usuario.id_cliente;
    if (!idCliente && usuario.id_usuario) {
      const u = await prisma.usuario.findUnique({ where: { id_usuario: usuario.id_usuario } });
      idCliente = u?.id_cliente;
    }
    if (!idCliente) return res.status(403).json({ error: 'Sin empresa asociada' });

    const filtroCentro = req.query.centro ? Number(req.query.centro) : null;
    const mes = typeof req.query.mes === 'string' && /^\d{4}-\d{2}$/.test(req.query.mes)
      ? req.query.mes
      : mesAnteriorISO();
    const [y, m] = mes.split('-').map(Number);
    const desde = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const hasta = new Date(Date.UTC(y, m, 1, 0, 0, 0));

    // Teóricos del cliente (opcionalmente filtrado por centro)
    const whereTeorico = { centro: { id_cliente: idCliente } };
    if (filtroCentro) whereTeorico.id_centro = filtroCentro;
    const teoricos = await prisma.consumoTeorico.findMany({
      where: whereTeorico,
      include: { centro: true, producto: true },
    });

    const desviaciones = [];
    for (const t of teoricos) {
      const movs = await prisma.registroMovimiento.findMany({
        where: {
          id_centro: t.id_centro,
          id_producto: t.id_producto,
          cantidad: { lt: 0 },
          fecha_hora: { gte: desde, lt: hasta },
        },
      });
      const consumoReal = movs.reduce((s, mv) => s + Math.abs(Number(mv.cantidad)), 0);
      const teorico = Number(t.cantidad_teorica) || 0;
      const desviacion = Math.round((consumoReal - teorico) * 100) / 100;
      const porcentaje = teorico > 0 ? Math.round((consumoReal / teorico) * 100) : (consumoReal > 0 ? 999 : 0);
      const costeUnit = Number(t.producto.coste_unitario) || 0;
      const costeDesviacion = Math.round(desviacion * costeUnit * 100) / 100;
      let estado = 'normal';
      if (desviacion > UMBRAL_NORMAL) estado = 'exceso';
      else if (desviacion < -UMBRAL_NORMAL) estado = 'infraconsumo';

      desviaciones.push({
        centro: { id_centro: t.id_centro, nombre_centro: t.centro.nombre_centro },
        producto: {
          id_producto: t.id_producto,
          nombre_producto: t.producto.nombre_producto,
          unidad_medida: t.producto.unidad_medida,
          coste_unitario: costeUnit,
        },
        consumo_teorico: teorico,
        consumo_real: consumoReal,
        desviacion,
        porcentaje_consumido: porcentaje,
        coste_desviacion: costeDesviacion,
        estado,
      });
    }

    // Ordenar por desviación absoluta descendente (los problemas primero)
    desviaciones.sort((a, b) => Math.abs(b.desviacion) - Math.abs(a.desviacion));
    const totalDesviaciones = desviaciones.filter((d) => d.estado !== 'normal').length;

    res.json({ mes, total_desviaciones: totalDesviaciones, desviaciones });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

module.exports = { getDeviations };
