# Roadmap de implementación — GesterMoney

Stack: Tauri 2.x + React 18 + TypeScript + SQLite
Fecha: 2026-05-03

---

## Regla general de implementación

```
contrato funcional (docs/)
  → modelo de datos (SQLite migrations)
    → lógica financiera (Rust domain, con tests)
      → repositorios + comandos Tauri
        → UI conectada a datos reales
```

Nunca construir UI antes de tener el dominio probado.
Nunca hardcodear valores financieros en React.

---

## FASE 0 — Contrato funcional

**Entregable:** `docs/product-contract.md` ✓

**Decisiones cerradas:**
- Moneda: PEN / soles
- Mes: calendario normal
- TC padre: manual
- Dinero disponible: sin ingresos pendientes
- Meses cerrados: no se recalculan

**Estado:** Completado.

---

## FASE 1 — Base técnica del proyecto

### Step 1 — Crear proyecto Tauri + React + TypeScript

```bash
npm create tauri-app@latest gestermoney -- \
  --template react-ts \
  --manager npm
```

Estructura esperada:
```
gestermoney/
├── src/
├── src-tauri/
├── docs/
└── package.json
```

Dependencias frontend:
```
@tanstack/react-query
zustand
tailwindcss
recharts
```

Dependencias Tauri:
```
tauri-plugin-sql (SQLite)
```

**Verificación:** La app abre una ventana vacía sin errores.

---

### Step 2 — Configurar SQLite

Archivo: `src-tauri/src/db/connection.rs`

```rust
// Inicializa pool SQLite
// Ruta: app_data_dir / gestermoney.db
// Ejecuta migraciones al inicio
```

Archivo: `src-tauri/tauri.conf.json`
- Habilitar plugin SQL
- Definir permisos de archivo local

**Verificación:** La app crea el archivo `.db` en el directorio de datos del usuario.

---

### Step 3 — Sistema de migraciones

Directorio: `src-tauri/src/db/migrations/`

Archivos (en orden):
```
001_app_settings.sql
002_periods.sql
003_accounts.sql
004_payment_methods.sql
005_categories.sql
006_statuses.sql
007_status_rules.sql
008_financial_events.sql
009_custom_field_definitions.sql
010_custom_field_values.sql
```

Tablas a crear:

```sql
-- Configuración global
app_settings (id, currency_code, active_period_id)

-- Períodos mensuales
periods (id, year, month, starts_on, ends_on, closed_at)

-- Cuentas del usuario
accounts (id, name, kind, opening_balance_minor, archived_at)
-- kind: asset | liability | receivable

-- Métodos de pago
payment_methods (id, name, kind, asset_account_id,
                 liability_account_id, archived_at)
-- kind: cash | debit | credit | transfer | other

-- Categorías configurables
categories (id, name, color, scope, archived_at)
-- scope: income | expense | both

-- Estados configurables
statuses (id, name, color, sort_order, archived_at)

-- Reglas de cada estado (switches controlados)
status_rules (status_id, applies_to,
              counts_as_paid, affects_real,
              affects_available, affects_future,
              creates_alert, exclude_from_total_default)

-- Evento financiero (movimiento central)
financial_events (
  id, period_id, type, title, amount_minor,
  event_date, due_date, status_id, category_id,
  payment_method_id, source_account_id,
  target_account_id, liability_account_id,
  parent_event_id, exclude_from_total,
  notes, created_at, updated_at
)
-- type: income | expense | transfer | debt_payment | debt_charge | receivable

-- Campos personalizados (definición)
custom_field_definitions (id, name, field_type,
                          applies_to, required,
                          options_json, archived_at)
-- field_type: text | number | date | boolean | list

-- Campos personalizados (valores)
custom_field_values (id, event_id, field_id,
                     value_text, value_number,
                     value_date, value_boolean)
```

**Verificación:** Ejecutar las migraciones en frío produce todas las tablas sin errores.

---

## FASE 2 — Dominio financiero (Rust)

Esta es la fase más crítica. No avanzar a UI sin tests verdes.

### Step 4 — Money model

Archivo: `src-tauri/src/domain/money.rs`

Reglas:
- Todos los montos son `i64` (centavos)
- `S/ 10.50 = 1050`
- Las operaciones de suma/resta nunca usan `f64`
- Formatear a string solo para mostrar en UI

```rust
pub struct Money(i64); // centavos

impl Money {
    pub fn from_minor(centavos: i64) -> Self
    pub fn to_minor(&self) -> i64
    pub fn display(&self) -> String  // "S/ 10.50"
    pub fn add(&self, other: &Money) -> Money
    pub fn sub(&self, other: &Money) -> Money
}
```

**Verificación:** `Money(1000) + Money(50) = Money(1050)`. Sin float en ningún camino.

---

### Step 5 — Reglas de estados

Archivo: `src-tauri/src/domain/event_rules.rs`

```rust
pub struct StatusRules {
    pub counts_as_paid: bool,
    pub affects_real: bool,
    pub affects_available: bool,
    pub affects_future: bool,
    pub creates_alert: bool,
    pub exclude_from_total_default: bool,
}

// Determina si un evento impacta un cálculo específico
pub fn event_affects_real(event: &FinancialEvent, rules: &StatusRules) -> bool
pub fn event_affects_available(event: &FinancialEvent, rules: &StatusRules) -> bool
pub fn event_affects_future(event: &FinancialEvent, rules: &StatusRules) -> bool
```

**Verificación:** El sistema no depende del nombre del estado ("Pagado", "Pendiente"). Solo de sus reglas.

---

### Step 6 — Lógica TC

Archivo: `src-tauri/src/domain/credit_card.rs`

Reglas a implementar:

```rust
// Compra con TC: gasto económico, no reduce dinero real
pub fn is_credit_purchase(event: &FinancialEvent, method: &PaymentMethod) -> bool

// Pago de TC: reduce dinero real, no es gasto nuevo
pub fn is_debt_payment(event: &FinancialEvent) -> bool

// Hijo excluido de total
pub fn is_excluded_child(event: &FinancialEvent) -> bool

// Validación: un hijo no puede ser padre de otro hijo (sin anidamiento profundo)
pub fn validate_parent_child(event: &FinancialEvent, parent: &FinancialEvent) -> Result<(), String>
```

**Verificación:**
- Compra Netflix S/ 35 con TC → no reduce dinero real
- Pago de TC S/ 650 → reduce dinero real, no suma a gastos del mes
- Netflix como hijo de TC S/ 650 excluido → el total del mes no lo duplica

---

### Step 7 — Cálculos principales

Archivo: `src-tauri/src/domain/projections.rs`

Funciones requeridas:

```rust
pub fn calc_dinero_real(events: &[FinancialEvent], rules_map: &RulesMap) -> Money
pub fn calc_dinero_disponible(events: &[FinancialEvent], rules_map: &RulesMap) -> Money
pub fn calc_dinero_futuro(events: &[FinancialEvent], rules_map: &RulesMap) -> Money

pub fn calc_total_ingresos(events: &[FinancialEvent], rules_map: &RulesMap) -> Money
pub fn calc_total_gastos(events: &[FinancialEvent], rules_map: &RulesMap) -> Money

pub fn count_vencidos(events: &[FinancialEvent], today: NaiveDate) -> usize
```

Fórmulas (según product-contract.md):

```
dinero_real =
  saldo inicial cuentas asset
  + ingresos con affects_real = true
  - gastos con affects_real = true (excluir pagos de deuda)
  - pagos de deuda realizados

dinero_disponible =
  dinero_real
  - obligaciones con affects_available = true y no liquidadas

dinero_futuro =
  dinero_real
  + ingresos con affects_future = true
  - gastos con affects_future = true
  - pagos futuros de deuda
```

**Verificación:** Ver Step 8.

---

## FASE 3 — Tests del dominio

### Step 8 — Tests de cálculo (obligatorios antes de UI)

Archivo: `src-tauri/src/domain/projections_test.rs`

Casos mínimos:

```rust
#[test] fn ingreso_ok_aumenta_dinero_real()
#[test] fn gasto_ok_reduce_dinero_real()
#[test] fn gasto_pendiente_afecta_futuro_no_real()
#[test] fn gasto_separado_afecta_disponible()
#[test] fn gasto_vencido_genera_alerta()
#[test] fn hijo_tc_excluido_no_duplica_total()
#[test] fn pago_tc_reduce_real_sin_duplicar_gasto()
#[test] fn dinero_disponible_no_incluye_ingresos_pendientes()
```

**Verificación:** `cargo test` verde. Sin excepciones.

---

## FASE 4 — Repositorios y comandos Tauri

### Step 9 — Repositories

Directorio: `src-tauri/src/repositories/`

```rust
// events_repo.rs
pub async fn list_events(period_id, filters) -> Vec<FinancialEvent>
pub async fn create_event(input) -> FinancialEvent
pub async fn update_event(id, input) -> FinancialEvent
pub async fn delete_event(id) -> ()
pub async fn get_event(id) -> Option<FinancialEvent>

// settings_repo.rs
pub async fn list_categories() -> Vec<Category>
pub async fn create_category(input) -> Category
pub async fn list_statuses() -> Vec<StatusWithRules>
pub async fn create_status(input) -> Status
pub async fn update_status_rules(status_id, rules) -> ()
pub async fn list_payment_methods() -> Vec<PaymentMethod>
pub async fn create_payment_method(input) -> PaymentMethod

// accounts_repo.rs
pub async fn list_accounts() -> Vec<Account>
pub async fn create_account(input) -> Account

// periods_repo.rs
pub async fn list_periods() -> Vec<Period>
pub async fn get_or_create_period(year, month) -> Period
pub async fn close_period(id) -> ()
```

---

### Step 10 — Commands Tauri

Directorio: `src-tauri/src/commands/`

```rust
// dashboard.rs
#[tauri::command]
pub async fn get_dashboard(period_id: i64) -> DashboardData
// DashboardData = { dinero_real, dinero_disponible, dinero_futuro,
//                   total_ingresos, total_gastos,
//                   alertas_vencidos, movimientos_recientes }

// events.rs
#[tauri::command] pub async fn list_events(period_id, filters)
#[tauri::command] pub async fn create_event(input)
#[tauri::command] pub async fn update_event(id, input)
#[tauri::command] pub async fn delete_event(id)

// settings.rs
#[tauri::command] pub async fn list_categories()
#[tauri::command] pub async fn create_category(input)
#[tauri::command] pub async fn list_statuses()
#[tauri::command] pub async fn create_status(input)
#[tauri::command] pub async fn update_status_rules(status_id, rules)
#[tauri::command] pub async fn list_payment_methods()
#[tauri::command] pub async fn create_payment_method(input)
#[tauri::command] pub async fn list_accounts()
#[tauri::command] pub async fn create_account(input)

// periods.rs
#[tauri::command] pub async fn list_periods()
#[tauri::command] pub async fn get_active_period()
#[tauri::command] pub async fn set_active_period(year, month)
```

Regla: Los comandos son wrappers delgados. Toda la lógica vive en `domain/`.

**Verificación:** Desde Tauri devtools se pueden invocar todos los comandos y devuelven JSON válido.

---

## FASE 5 — UI conectada

### Step 11 — AppShell

Archivos:
```
src/components/AppShell/AppShell.tsx
src/components/AppShell/Sidebar.tsx
src/app/routes.tsx
```

Estructura visual:
```
┌─────────────────────────────────────────┐
│  Sidebar       │  Área principal         │
│  ──────────    │                         │
│  [Mes activo]  │  <Outlet />             │
│  Dashboard     │                         │
│  Ingresos      │                         │
│  Gastos        │                         │
│  Deudas        │                         │
│  Gráficas      │                         │
│  Configuración │                         │
│                │                         │
└─────────────────────────────────────────┘
```

Regla: Usar empty states reales. Cero datos mockeados.

---

### Step 12 — Pantalla Configuración (antes que movimientos)

Ruta: `/configuracion`

Implementar en este orden interno:
1. CRUD Cuentas
2. CRUD Métodos de pago
3. CRUD Categorías
4. CRUD Estados + reglas (switches)
5. CRUD Campos personalizados

Razón: Los formularios de ingresos/gastos dependen de estos datos.

**Verificación:** Un usuario puede crear una categoría, un método de pago y un estado antes de registrar cualquier movimiento.

---

### Step 13 — Pantalla Gastos

Ruta: `/gastos`

Componentes necesarios:
```
src/features/expenses/
  ExpensesPage.tsx
  ExpenseTable.tsx       ← soporta padre/hijo
  ExpenseForm.tsx        ← campos fijos + campos dinámicos
  ExpenseFilters.tsx
```

Funcionalidad mínima:
- Listar gastos del período activo
- Crear gasto (con todos los campos)
- Editar gasto
- Eliminar gasto
- Cambiar estado
- Marcar `exclude_from_total`
- Vincular como hijo de un gasto padre

Visualización padre/hijo:
```
Tarjeta BCP       S/ 650   [pagado]
  └─ Netflix       S/ 35   [excluido]
```

---

### Step 14 — Pantalla Ingresos

Ruta: `/ingresos`

Componentes:
```
src/features/income/
  IncomePage.tsx
  IncomeTable.tsx
  IncomeForm.tsx
```

Funcionalidad mínima:
- Listar ingresos del período activo
- Crear ingreso
- Editar ingreso
- Eliminar ingreso
- Cambiar estado

---

### Step 15 — Dashboard

Ruta: `/` (ruta raíz)

Componentes:
```
src/features/dashboard/
  DashboardPage.tsx
  KpiCard.tsx
  AlertBanner.tsx
  RecentMovements.tsx
```

Datos de: `invoke("get_dashboard", { period_id })`

KPIs a mostrar:
- Dinero real
- Dinero disponible
- Dinero futuro
- Total ingresos del mes
- Total gastos del mes
- Alertas de vencidos

Regla: Si `get_dashboard` retorna cero datos → empty state con call to action.

---

### Step 16 — Deudas

Ruta: `/deudas`

MVP:
- Por pagar (el usuario debe)
- Por cobrar (le deben al usuario)
- Monto total y abonado
- Estado y fecha de vencimiento

---

### Step 17 — Gráficas

Ruta: `/graficas`

Gráficos MVP (con Recharts):
- Gastos por categoría (donut)
- Ingresos vs gastos (barras)
- Evolución mensual 6 meses (línea)

Regla: Si no hay datos → empty state. Sin decoración falsa.

---

## Estructura final de carpetas

```
gestermoney/
├── docs/
│   ├── product-contract.md
│   └── roadmap.md
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── routes.tsx
│   │
│   ├── features/
│   │   ├── dashboard/
│   │   ├── income/
│   │   ├── expenses/
│   │   ├── debts/
│   │   ├── charts/
│   │   └── settings/
│   │
│   ├── components/
│   │   ├── AppShell/
│   │   ├── DataTable/
│   │   ├── DynamicForm/
│   │   ├── MoneyAmount/
│   │   ├── StatusBadge/
│   │   └── Modal/
│   │
│   ├── domain-client/
│   │   ├── commands.ts    ← wrappers de invoke() con tipos
│   │   └── types.ts       ← tipos espejo de Rust
│   │
│   └── utils/
│       ├── money.ts       ← formateo de centavos a string
│       └── dates.ts
│
└── src-tauri/
    └── src/
        ├── main.rs
        ├── commands/
        │   ├── dashboard.rs
        │   ├── events.rs
        │   ├── settings.rs
        │   └── periods.rs
        ├── domain/
        │   ├── money.rs
        │   ├── event_rules.rs
        │   ├── credit_card.rs
        │   ├── projections.rs
        │   └── validation.rs
        ├── repositories/
        │   ├── events_repo.rs
        │   ├── settings_repo.rs
        │   ├── accounts_repo.rs
        │   └── periods_repo.rs
        └── db/
            ├── connection.rs
            └── migrations/
                ├── 001_app_settings.sql
                ├── 002_periods.sql
                ├── 003_accounts.sql
                ├── 004_payment_methods.sql
                ├── 005_categories.sql
                ├── 006_statuses.sql
                ├── 007_status_rules.sql
                ├── 008_financial_events.sql
                ├── 009_custom_field_definitions.sql
                └── 010_custom_field_values.sql
```

---

## Resumen de fases y verificaciones

| Fase | Steps | Verificación |
|------|-------|--------------|
| 0 - Contrato | — | docs/ escritos y cerrados |
| 1 - Base técnica | 1-3 | App abre, DB se crea, migraciones corren |
| 2 - Dominio Rust | 4-7 | Funciones de cálculo implementadas |
| 3 - Tests | 8 | `cargo test` verde, 8 casos mínimos |
| 4 - Repositorios | 9-10 | Comandos Tauri invocables desde devtools |
| 5 - UI | 11-17 | Cada pantalla conectada a datos reales |

---

## Próximo paso inmediato

```
Step 1: Crear proyecto Tauri + React + TypeScript
```

Comando exacto:
```bash
npm create tauri-app@latest gestermoney -- --template react-ts --manager npm
```

Después de ese paso, avanzar a Step 2 (SQLite) sin tocar React.
