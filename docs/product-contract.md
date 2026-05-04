# Product Contract — GesterMoney

Versión: 1.0
Fecha: 2026-05-03
Estado: Activo

---

## Decisiones cerradas del MVP

| Decisión | Valor |
|----------|-------|
| Plataforma | Tauri 2.x + React + TypeScript |
| Persistencia | SQLite local (sin backend, sin sync) |
| Moneda | PEN / soles |
| Ciclo de mes | Calendario normal (1 al último día) |
| TC padre | Manual en MVP |
| Hijos TC | Detalle informativo, excluibles del total |
| Dinero disponible | NO incluye ingresos pendientes |
| Meses cerrados | NO se recalculan al cambiar reglas |
| Cambios de reglas | Aplican hacia adelante únicamente |

---

## Pantallas del MVP

```
1. Dashboard
2. Ingresos
3. Gastos
4. Deudas
5. Gráficas (básico)
6. Configuración
```

---

## Módulo: Dashboard

### KPIs que debe mostrar
- Ingresos del mes (realizados)
- Gastos del mes (registrados)
- Dinero real
- Dinero disponible
- Dinero futuro
- Alertas de vencidos

### Regla
- El Dashboard NO calcula nada.
- Solo renderiza la respuesta de `get_dashboard(period_id)`.
- Si no hay datos del mes: empty state con botón "Registrar primer ingreso".

---

## Módulo: Ingresos

### Campos fijos
- Título / descripción
- Monto (en centavos internamente)
- Fecha
- Estado (desde lista configurable)
- Categoría (desde lista configurable)
- Método de pago (desde lista configurable)
- Notas (opcional)

### Campos dinámicos
- Cualquier campo personalizado definido en Configuración con `applies_to = income | both`.

### Acciones permitidas
- Crear ingreso
- Editar ingreso
- Eliminar ingreso
- Cambiar estado

### Empty state
- "No hay ingresos registrados este mes. Agrega el primero."

---

## Módulo: Gastos

### Campos fijos
- Título / descripción
- Monto
- Fecha
- Estado
- Categoría
- Método de pago
- Notas (opcional)
- Excluir de total (boolean)
- Gasto padre (referencia opcional a otro gasto del mismo período)

### Campos dinámicos
- Cualquier campo personalizado con `applies_to = expense | both`.

### Acciones permitidas
- Crear gasto
- Editar gasto
- Eliminar gasto
- Cambiar estado
- Marcar / desmarcar "excluir de total"
- Vincular como hijo de otro gasto (caso TC)

### Regla de visualización padre/hijo
```
Gasto padre: Tarjeta BCP  S/ 650
  └─ Netflix               S/ 35   [excluido]
  └─ Spotify               S/ 22   [excluido]
```
Los hijos con `exclude_from_total = true` se muestran pero no suman al total del mes.

### Empty state
- "No hay gastos registrados este mes."

---

## Módulo: Deudas

### Qué entra en MVP
- Deudas por pagar (el usuario debe dinero)
- Deudas por cobrar (le deben al usuario)
- Monto total y monto abonado
- Estado
- Fecha de vencimiento

### Qué NO entra en MVP
- Intereses
- Cuotas automáticas
- Cronogramas de pago

### Empty state
- "No hay deudas activas este mes."

---

## Módulo: Gráficas

### Gráficos del MVP
- Gastos por categoría (pie o donut)
- Ingresos vs gastos del mes (barras)
- Evolución mensual simple (línea, últimos 6 meses)

### Regla
- Si no hay datos suficientes: empty state, NO decoración falsa.
- Todos los gráficos salen de datos reales de SQLite.

---

## Módulo: Configuración

### Secciones

**Categorías**
- Nombre, color, scope (income / expense / both)
- Archivable (no se elimina si tiene movimientos)

**Métodos de pago**
- Nombre, tipo interno (cash | debit | credit | transfer | other)
- Si tipo = credit: debe vincular a cuenta liability
- Si tipo = debit / cash / transfer: debe vincular a cuenta asset
- Archivable

**Estados**
- Nombre, color, orden
- Reglas configurables (switches controlados):
  - `counts_as_paid` — cuenta como pagado
  - `affects_real` — afecta dinero real
  - `affects_available` — afecta dinero disponible
  - `affects_future` — afecta dinero futuro
  - `creates_alert` — genera alerta en dashboard
  - `exclude_from_total_default` — excluir de total por defecto

**Campos personalizados**
- Nombre, tipo (text | number | date | boolean | list)
- `applies_to` (income | expense | both | debt)
- `required` (boolean)
- Opciones si tipo = list

**Cuentas**
- Nombre, tipo (asset | liability | receivable)
- Saldo inicial
- Archivable

---

## Reglas de negocio financieras

### Representación de montos
```
Internamente: centavos enteros (integer)
S/ 10.50 = 1050
Nunca usar float para dinero.
```

### Dinero real
```
= saldo inicial de cuentas asset
+ ingresos con estado affects_real = true
- gastos con estado affects_real = true (que no sean pago de deuda)
- pagos de deuda/TC realizados (affects_real = true)
```
**No incluye:** compras con TC antes de que se pague el estado de cuenta.

### Dinero disponible
```
= dinero real
- obligaciones con affects_available = true y no liquidadas
```
**No incluye:** ingresos pendientes.
**Sí incluye descuento:** gastos comprometidos con TC (aunque no hayan reducido dinero real aún).

### Dinero futuro
```
= dinero real
+ ingresos con affects_future = true (proyectados)
- gastos con affects_future = true (proyectados)
- pagos futuros de deuda/TC
```
Se muestra como proyección, no como efectivo actual.

---

## Regla TC — No duplicación

### Flujo correcto
```
1. Compra con TC (Netflix S/ 35):
   - Registrada como gasto económico
   - NO reduce dinero real
   - Reduce dinero disponible
   - Crea o aumenta deuda en cuenta liability

2. Pago del estado de cuenta TC (S/ 650):
   - Registrado como liquidación de deuda, NO como gasto nuevo
   - Reduce dinero real
   - Reduce deuda de cuenta liability
   - No genera nuevo gasto económico
```

### Visualización padre/hijo
```
parent_event_id → vincula hijo al padre
exclude_from_total → true en el hijo
```
El padre ya representa el total. Los hijos son detalle.

---

## Restricciones del MVP

**Dinámico (configurable por el usuario):**
- Categorías
- Métodos de pago
- Estados y sus reglas
- Campos personalizados
- Nombres de cuentas

**Fijo (no configurable):**
- Fórmulas de dinero real / disponible / futuro
- Tipos internos de cuenta (asset | liability | receivable)
- Tipos internos de método de pago (cash | debit | credit | transfer | other)
- Estructura de `financial_events`
- Comportamiento de exclusión padre/hijo

**Fuera del MVP:**
- Sincronización
- Multiusuario
- Multimoneda
- Importación desde Excel
- Reglas automáticas avanzadas
- Reportes complejos con filtros cruzados
- Presupuestos mensuales
- Plantillas de movimientos recurrentes
