import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getInventory, restock, getCentros, getPurchaseProposal,
  getCatalogoProductos, createProducto, addProductoCentro,
  type InventarioItem, type Centro, type Producto,
} from '../lib/api'
import {
  connect, disconnect, subscribe,
  joinCentro, leaveCentro,
  type StockConsumedPayload, type StockRestockedPayload,
} from '../lib/socket'
import { exportToCsv } from '../lib/csv'
import { GuiaAyuda } from '../components/GuiaAyuda'

export function Inventario() {
  const [inventory, setInventory] = useState<InventarioItem[]>([])
  const [centros, setCentros] = useState<Centro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filtroCentro, setFiltroCentro] = useState('')

  // Real-time toast notification
  const [notification, setNotification] = useState<{
    type: 'consumed' | 'restocked'
    message: string
  } | null>(null)

  // Restock modal
  const [showRestock, setShowRestock] = useState(false)
  const [restockCentro, setRestockCentro] = useState('')
  const [restockProducto, setRestockProducto] = useState('')
  const [restockCantidad, setRestockCantidad] = useState(1)
  const [restockLoading, setRestockLoading] = useState(false)
  const [restockError, setRestockError] = useState('')

  // Nuevo producto modal
  const [showNuevoProd, setShowNuevoProd] = useState(false)
  const [catalogo, setCatalogo] = useState<Producto[]>([])
  const [npNombre, setNpNombre] = useState('')
  const [npUnidad, setNpUnidad] = useState('unidades')
  const [npCoste, setNpCoste] = useState('')
  const [npMinimo, setNpMinimo] = useState('')
  const [npCentro, setNpCentro] = useState('')
  const [npCantidad, setNpCantidad] = useState('')
  const [npLoading, setNpLoading] = useState(false)
  const [npError, setNpError] = useState('')
  const [npSuccess, setNpSuccess] = useState('')

  // Ref para evitar doble conexión en modo Strict
  const socketInitialized = useRef(false)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [invData, centrosData] = await Promise.all([
        getInventory(filtroCentro ? Number(filtroCentro) : undefined),
        getCentros(),
      ])
      setInventory(invData)
      setCentros(centrosData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------------------------------
  // Socket.IO: Conexión y suscripción a eventos en tiempo real
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Conectar al servidor Socket.IO
    const socket = connect()

    if (!socket) {
      // No hay token — probablemente no autenticado
      return
    }

    // Suscribirse a eventos de consumo
    const unsubConsumed = subscribe('stock:consumed', (raw) => {
      const payload = raw as StockConsumedPayload
      const cantidad = Math.abs(payload.cantidad)

      // Mostrar notificación toast
      setNotification({
        type: 'consumed',
        message: `${payload.usuario.nombre} consumió ${cantidad} de ${payload.nombre_producto} en centro #${payload.id_centro}`,
      })

      // Actualizar el inventario local sin recargar toda la página
      setInventory((prev) =>
        prev.map((item) =>
          item.id_centro === payload.id_centro && item.id_producto === payload.id_producto
            ? { ...item, cantidad_actual: payload.cantidad_actual }
            : item
        )
      )
    })

    // Suscribirse a eventos de reposición
    const unsubRestocked = subscribe('stock:restocked', (raw) => {
      const payload = raw as StockRestockedPayload

      setNotification({
        type: 'restocked',
        message: `${payload.usuario.nombre} repuso ${payload.cantidad} de ${payload.nombre_producto} en centro #${payload.id_centro}`,
      })

      // Actualizar el inventario local
      setInventory((prev) =>
        prev.map((item) =>
          item.id_centro === payload.id_centro && item.id_producto === payload.id_producto
            ? { ...item, cantidad_actual: payload.cantidad_actual }
            : item
        )
      )
    })

    // Unirse al room global (todos los centros — supervisores ven todo)
    // Si hay un filtro de centro activo, unirse solo a ese centro
    if (filtroCentro) {
      joinCentro(Number(filtroCentro))
    }

    // Limpiar notificación después de 4 segundos
    const notifTimer = setTimeout(() => setNotification(null), 4000)

    return () => {
      clearTimeout(notifTimer)
      unsubConsumed()
      unsubRestocked()
      if (filtroCentro) {
        leaveCentro(Number(filtroCentro))
      }
      disconnect()
      socketInitialized.current = false
    }
  }, [filtroCentro])

  // Auto-limpiar notificación cuando cambia
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  // Cargar datos al inicio o cuando cambia el filtro
  useEffect(() => {
    loadData()
  }, [filtroCentro])

  const openRestock = () => {
    setRestockCentro('')
    setRestockProducto('')
    setRestockCantidad(1)
    setRestockError('')
    setShowRestock(true)
  }

  const openNuevoProd = async () => {
    setNpError('')
    setNpSuccess('')
    setNpNombre('')
    setNpUnidad('unidades')
    setNpCoste('')
    setNpMinimo('')
    setNpCentro('')
    setNpCantidad('')
    try {
      const cats = await getCatalogoProductos()
      setCatalogo(cats)
    } catch {
      setCatalogo([])
    }
    setShowNuevoProd(true)
  }

  const handleCrearProducto = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!npNombre.trim()) {
      setNpError('Escribe el nombre del producto.')
      return
    }
    const coste = parseFloat(npCoste)
    const minimo = parseInt(npMinimo) || 0
    if (isNaN(coste) || coste < 0) {
      setNpError('El coste debe ser un número válido.')
      return
    }
    setNpLoading(true)
    setNpError('')
    try {
      const { producto } = await createProducto({
        nombre_producto: npNombre.trim(),
        unidad_medida: npUnidad,
        coste_unitario: coste,
        stock_minimo_alerta: minimo,
      })
      // Si eligió centro, lo añadimos al inventario de ese centro
      if (npCentro) {
        const cant = parseInt(npCantidad) || 0
        await addProductoCentro({
          id_centro: parseInt(npCentro),
          id_producto: producto.id_producto,
          cantidad_actual: cant,
          stock_minimo: minimo,
        })
        setNpSuccess(`"${producto.nombre_producto}" creado y añadido al centro.`)
      } else {
        setNpSuccess(`"${producto.nombre_producto}" creado en el catálogo.`)
      }
      await loadData()
      setTimeout(() => { setShowNuevoProd(false); setNpSuccess('') }, 1200)
    } catch (err: any) {
      setNpError(err?.message || 'Error al crear el producto.')
    } finally {
      setNpLoading(false)
    }
  }

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restockCentro || !restockProducto || restockCantidad < 1) {
      setRestockError('Debe completar todos los campos.')
      return
    }
    setRestockLoading(true)
    setRestockError('')
    try {
      await restock({
        id_centro: Number(restockCentro),
        id_producto: Number(restockProducto),
        cantidad: restockCantidad,
      })
      setSuccess(`Reposición de ${restockCantidad} unidades registrada.`)
      setShowRestock(false)
      loadData()
    } catch (err) {
      setRestockError(err instanceof Error ? err.message : 'Error al reponer')
    } finally {
      setRestockLoading(false)
    }
  }

  const handleGenerateProposal = async () => {
    try {
      setLoading(true)
      const proposal = await getPurchaseProposal(filtroCentro ? Number(filtroCentro) : undefined)
      if (proposal.propuestas.length === 0) {
        setSuccess('No hay productos por debajo del stock mínimo. No se requiere compra.')
        setTimeout(() => setSuccess(''), 4000)
        return
      }
      const rows = proposal.propuestas.map(p => ({
        Centro: p.centro.nombre_centro,
        Producto: p.producto.nombre_producto,
        'Stock Actual': p.stock_actual,
        'Stock Mínimo': p.stock_minimo,
        'Déficit': p.deficit,
        'Cantidad a Pedir': p.cantidad_pedido,
        'Coste Estimado (€)': p.coste_estimado
      }))
      exportToCsv(`propuesta-compra-${new Date().toISOString().split('T')[0]}`, rows)
      setSuccess(`Propuesta exportada. Coste total estimado: ${proposal.total_coste_estimado} €`)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar propuesta')
    } finally {
      setLoading(false)
    }
  }

  const availableProducts = inventory
    .filter((item) => !restockCentro || item.id_centro === Number(restockCentro))
    .map((item) => item.producto)
    .filter((p, i, arr) => arr.findIndex((x) => x.id_producto === p.id_producto) === i)

  if (loading && inventory.length === 0) {
    return (
      <div className="loading">
        <div className="spinner" />
        Cargando inventario...
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Inventario</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={handleGenerateProposal}>
            📥 Propuesta de Compra
          </button>
          <button className="btn btn-primary" onClick={openRestock}>
            + Reponer Stock
          </button>
          <button className="btn btn-primary" onClick={openNuevoProd}>
            ➕ Nuevo Producto
          </button>
          <GuiaAyuda titulo="Inventario">
            <p>Esta pantalla muestra <strong>todo el material que hay en cada centro</strong> y te ayuda a saber cuándo comprar.</p>
            <h3>¿Qué ves?</h3>
            <ul>
              <li><strong>Stock actual:</strong> lo que hay ahora.</li>
              <li><strong>Stock mínimo:</strong> el nivel bajo del que no deberías bajar.</li>
              <li>Si el stock está por debajo del mínimo, sale en <strong>rojo</strong> o <strong>ámbar</strong>.</li>
            </ul>
            <h3>📥 Propuesta de Compra</h3>
            <p>Pulsa el botón y la app te dice <strong>qué productos faltan y cuántos comprar</strong>, con el coste estimado. Puedes descargarlo en CSV.</p>
            <h3>+ Reponer Stock</h3>
            <p>Para añadir material al almacén cuando llega un pedido.</p>
            <h3>➕ Nuevo Producto</h3>
            <p>Para <strong>crear un producto que no existe todavía</strong> en el sistema (ej. un tipo de guante nuevo). Escribe el nombre, la unidad (rollos, litros, pares...), el coste y el stock mínimo. Opcionalmente elígelo centro para añadirlo directamente a su inventario con su cantidad inicial.</p>
            <div className="guia-ejemplo">
              💡 <strong>Ejemplo:</strong> Beneficencia tiene 22 lejías y el mínimo es 30 → la Propuesta de Compra te dirá "pide 38 lejías (57 €)".
            </div>
          </GuiaAyuda>
        </div>
      </div>

      {/* Real-time notification toast */}
      {notification && (
        <div className={`alert ${notification.type === 'consumed' ? 'alert-warning' : 'alert-success'}`}
          style={{ animation: 'slideIn 0.3s ease-out' }}>
          <strong>
            {notification.type === 'consumed' ? '📦 Consumo' : '📥 Reposición'}
          </strong>
          : {notification.message}
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Filter */}
      <div className="card">
        <div className="filters-bar">
          <div className="form-group">
            <label className="form-label">Filtrar por centro</label>
            <select className="form-select" value={filtroCentro} onChange={(e) => setFiltroCentro(e.target.value)}>
              <option value="">Todos los centros</option>
              {centros.map((c) => (
                <option key={c.id_centro} value={c.id_centro}>{c.nombre_centro}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Centro</th>
                <th>Producto</th>
                <th>Unidad</th>
                <th>Stock Actual</th>
                <th>Stock Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => {
                const isLow = item.cantidad_actual <= item.producto.stock_minimo_alerta
                const isCritical = item.cantidad_actual <= 0
                return (
                  <tr key={`${item.id_centro}-${item.id_producto}`}>
                    <td><strong>{item.centro?.nombre_centro}</strong></td>
                    <td>{item.producto.nombre_producto}</td>
                    <td>{item.producto.unidad_medida}</td>
                    <td style={{ fontWeight: 600, color: isCritical ? 'var(--danger)' : isLow ? 'var(--warning)' : 'inherit' }}>
                      {item.cantidad_actual}
                    </td>
                    <td>{item.producto.stock_minimo_alerta}</td>
                    <td>
                      {isCritical ? (
                        <span className="badge badge-danger">Crítico</span>
                      ) : isLow ? (
                        <span className="badge badge-warning">Bajo</span>
                      ) : (
                        <span className="badge badge-success">Normal</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                    No hay inventario disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {showRestock && (
        <div className="modal-overlay" onClick={() => setShowRestock(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Reponer Stock</h2>
            {restockError && <div className="alert alert-danger">{restockError}</div>}
            <form onSubmit={handleRestock}>
              <div className="form-group">
                <label className="form-label">Centro</label>
                <select className="form-select" value={restockCentro} onChange={(e) => { setRestockCentro(e.target.value); setRestockProducto('') }} required>
                  <option value="">Seleccionar centro...</option>
                  {centros.map((c) => (
                    <option key={c.id_centro} value={c.id_centro}>{c.nombre_centro}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Producto</label>
                <select className="form-select" value={restockProducto} onChange={(e) => setRestockProducto(e.target.value)} required>
                  <option value="">Seleccionar producto...</option>
                  {availableProducts.map((p) => (
                    <option key={p.id_producto} value={p.id_producto}>{p.nombre_producto}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad</label>
                <input className="form-input" type="number" min="1" value={restockCantidad} onChange={(e) => setRestockCantidad(Number(e.target.value))} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowRestock(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={restockLoading}>
                  {restockLoading ? 'Reponiendo...' : 'Reponer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Producto */}
      {showNuevoProd && (
        <div className="modal-backdrop" onClick={() => setShowNuevoProd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>➕ Nuevo Producto</h3>
              <button className="modal-close" onClick={() => setShowNuevoProd(false)}>✕</button>
            </div>
            {npSuccess && <div className="alert alert-success">{npSuccess}</div>}
            {npError && <div className="alert alert-danger">{npError}</div>}
            <form onSubmit={handleCrearProducto}>
              <div className="form-group">
                <label className="form-label">Nombre del producto *</label>
                <input className="form-input" value={npNombre} onChange={(e) => setNpNombre(e.target.value)} placeholder="Ej: Guantes de latex (par)" required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Unidad</label>
                  <select className="form-select" value={npUnidad} onChange={(e) => setNpUnidad(e.target.value)}>
                    <option value="unidades">unidades</option>
                    <option value="rollos">rollos</option>
                    <option value="litros">litros</option>
                    <option value="pares">pares</option>
                    <option value="paquetes">paquetes</option>
                    <option value="cajas">cajas</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Coste unitario (€)</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={npCoste} onChange={(e) => setNpCoste(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Stock mínimo (alerta)</label>
                  <input className="form-input" type="number" min="0" value={npMinimo} onChange={(e) => setNpMinimo(e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Añadir a centro (opcional)</label>
                  <select className="form-select" value={npCentro} onChange={(e) => setNpCentro(e.target.value)}>
                    <option value="">Solo al catálogo</option>
                    {centros.map((c) => (
                      <option key={c.id_centro} value={c.id_centro}>{c.nombre_centro}</option>
                    ))}
                  </select>
                </div>
              </div>
              {npCentro && (
                <div className="form-group">
                  <label className="form-label">Cantidad inicial en el centro</label>
                  <input className="form-input" type="number" min="0" value={npCantidad} onChange={(e) => setNpCantidad(e.target.value)} placeholder="0" />
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowNuevoProd(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={npLoading}>
                  {npLoading ? 'Creando...' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}