# Progress — GesterMoney

Registro de avances por step. Cada entrada corresponde a un commit en git.

---

## FASE 0 — Contrato funcional

### ✅ Fase 0 completada — 2026-05-03

**Qué se hizo:**
- Creado `docs/product-contract.md` con todas las decisiones cerradas del MVP
- Creado `docs/roadmap.md` con 17 steps ordenados por dependencias

**Decisiones cerradas:**
- Plataforma: Tauri 2 + React 18 + TypeScript + SQLite local
- Moneda: PEN / soles
- Mes: calendario normal
- TC padre: manual en MVP
- Dinero disponible: sin ingresos pendientes
- Meses cerrados: no se recalculan al cambiar reglas

**Verificación:** Documentos escritos y revisados. Sin ambigüedades bloqueantes.

**Nota de arquitectura:** La capa `domain-client/` aísla todos los `invoke()` de Tauri.
Al migrar a web, solo se reemplaza esa capa — los componentes React no cambian.

---

## FASE 1 — Base técnica del proyecto

### ✅ Step 1 completado — 2026-05-04

**Qué se hizo:**
- Instalado Rust 1.95.0 + Cargo via winget
- Instalado MSVC Build Tools 14.44 (linker `link.exe`)
- Instalado Windows SDK 10.0.22000 (`kernel32.lib` y demás libs del sistema)
- Scaffold Tauri 2.11 + React 19 + TypeScript 5.8 + Vite 7
- Corregido nombre del proyecto: `gestermoney-scaffold` → `gestermoney`
- `.gitignore` configurado (node_modules, dist, target, *.db)

**Verificación:**
```
npm run build   → ✅ built in 745ms
cargo check     → ✅ Finished en 18s
```

**Próximo step:** Step 14 — Pantalla Ingresos

---

### ✅ Step 13 completado — 2026-05-07

**Qué se hizo:**
- `Modal.tsx`: componente reutilizable con cierre por Escape y click fuera
- `ExpenseForm`: todos los campos (título, monto, fecha, estado, categoría, método, padre TC, excluir, notas)
  - Validaciones: título requerido, monto > 0, estado requerido
  - Candidatos a padre: solo raíces del período (sin hijos propios)
- `ExpenseTable`: árbol padre/hijo con └─ visual, badge "excluido", total del mes
  - Acciones hover: editar, eliminar con confirmación
  - Status badge con color dinámico del estado
- `ExpensesPage`: filtros cliente (estado, categoría), modal para crear/editar

**Verificación:**
```
npm run build → ✅ built in 4.10s
```

**Próximo step:** Step 14 — Pantalla Ingresos

---

### ✅ Step 12 completado — 2026-05-07

**Qué se hizo:**
- `utils/money.ts`: `parseMoneyInput()` y `minorToInputStr()`
- `SettingsPage`: tabs (Cuentas / Métodos de pago / Categorías / Estados)
- `AccountsSection`: CRUD cuentas con tipo (activo/pasivo/por cobrar) y saldo inicial
- `PaymentMethodsSection`: CRUD métodos, tipo crédito vinculable a cuenta pasivo
- `CategoriesSection`: CRUD con color picker + scope badge + archivar
- `StatusesSection`: CRUD estados + 6 switches de reglas expandibles por estado
  - `RulesForm`: checkboxes para affects_real, available, future, counts_as_paid, creates_alert, exclude_default
  - Upsert automático con `applies_to = 'all'`

**Verificación:**
```
npm run build → ✅ built in 3.82s
```

**Próximo step:** Step 13 — Pantalla Gastos

---

### ✅ Step 11 completado — 2026-05-07

**Qué se hizo:**
- Instalado: `react-router-dom v7`, `@tanstack/react-query v5`, `tailwindcss v4`, `lucide-react`
- `vite.config.ts`: plugin `@tailwindcss/vite` agregado
- `src/index.css`: `@import "tailwindcss"` (Tailwind v4)
- `src/domain-client/types.ts`: interfaces TypeScript espejo de Rust structs
- `src/domain-client/commands.ts`: todos los `invoke()` aislados aquí — clave para migración web
- `src/utils/money.ts`: `formatMoney()`, `formatPeriod()`, `MONTHS_ES`
- `AppShell`: layout flex (sidebar 240px + main fluid)
- `Sidebar`: nav con NavLink activo resaltado + Configuración al fondo
- `MonthSelector`: React Query para active-period + mutación para cambiar mes
- `routes.tsx`: HashRouter con 6 rutas bajo AppShell
- `main.tsx`: QueryClientProvider + RouterProvider
- 6 páginas placeholder (sin datos mock)

**Verificación:**
```
npm run build → ✅ built in 3.88s, 1815 módulos
```

**Próximo step:** Step 12 — Pantalla Configuración

---

### ✅ Step 10 completado — 2026-05-06

**Qué se hizo:**
- `commands/dashboard.rs`: `get_dashboard(period_id)` → DashboardData con 7 KPIs calculados
- `commands/events.rs`: `list_events`, `get_event`, `create_event`, `update_event`, `delete_event`
- `commands/settings.rs`: CRUD categorías, estados+reglas, métodos, cuentas (11 commands)
- `commands/periods.rs`: `get_active_period` (auto-crea mes actual si no hay ninguno), `set_active_period`, `list_periods`, `close_period`
- 21 commands registrados en `lib.rs` con `generate_handler!`
- React nunca toca SQLite directamente — todo pasa por estos commands

**Verificación:**
```
cargo check → Finished en 4s
cargo test  → 60/60 ok, sin regresiones
```

**Próximo step:** Step 11 — AppShell (UI base)

---

### ✅ Step 9 completado — 2026-05-06

**Qué se hizo:**
- `periods_repo`: `get_or_create_period`, `list_periods`, `close_period`, `get_active_period`, `set_active_period`
- `accounts_repo`: `list_accounts`, `create_account`, `archive_account`, `get_asset_opening_balance`
- `settings_repo`: CRUD de categorías, estados+reglas, métodos de pago; `load_rules_map` → `RulesMap` del dominio
- `events_repo`: `list_events`, `get_event`, `create_event`, `update_event`, `delete_event`, `list_events_for_calc`
- `list_events_for_calc`: JOIN con payment_methods → convierte rows a `EventForCalc` del dominio
- `upsert_status_rules`: INSERT OR UPDATE con `ON CONFLICT` para actualizar switches sin borrar

**Verificación:**
```
cargo check → Finished en 27s. Sin errores.
```

**Próximo step:** Step 10 — Commands Tauri

---

### ✅ Step 8 completado — 2026-05-06

**Qué se hizo:**
- Ejecutado `cargo test` completo sobre todos los módulos del dominio
- Verificados los 8 casos obligatorios del roadmap

**Casos verificados:**
1. Ingreso OK aumenta dinero real ✅
2. Gasto OK reduce dinero real ✅
3. Gasto pendiente afecta futuro, no real ✅
4. Gasto separado afecta disponible ✅
5. Gasto vencido genera alerta ✅
6. Hijo TC excluido no duplica total ✅
7. Pago TC reduce real sin duplicar gasto ✅
8. Dinero disponible no incluye ingresos pendientes ✅

**Verificación:**
```
cargo test → 60/60 ok. 0 failed.
```

**Próximo step:** Step 9 — Repositories

---

### ✅ Step 7 completado — 2026-05-06

**Qué se hizo:**
- `EventForCalc`: struct para cálculos (sin campos de presentación)
- `calc_dinero_real(events, rules_map, opening_balance)`: suma realizados, excluye TC
- `calc_dinero_disponible(events, rules_map, opening_balance)`: real - compromisos pendientes
- `calc_dinero_futuro(events, rules_map, opening_balance)`: real + proyectados pendientes
- `calc_total_ingresos` / `calc_total_gastos`: totales del período sin hijos excluidos
- `count_vencidos(events, rules_map, today)`: due_date < today y no pagado
- Los 3 flujos de dinero convergen sin double-counting

**Verificación:**
```
cargo test domain::projections → 17/17 ok
```
Total acumulado del dominio: 8 + 20 + 15 + 17 = **60 tests verdes**

**Próximo step:** Step 8 — tests de integración (`cargo test` completo)

---

### ✅ Step 6 completado — 2026-05-04

**Qué se hizo:**
- `PaymentMethodKind`: enum (Cash, Debit, Credit, Transfer, Other) con `from_str`, `as_str`, `is_credit`
- `is_credit_purchase`: Expense + método crédito → NO reduce dinero real
- `is_debt_payment`: DebtPayment → reduce real, no duplica gasto económico
- `is_excluded_child`: padre + exclude_from_total=true → aparece pero no suma
- `validate_parent_child`: un evento no puede ser su propio padre
- Separación limpia: credit_card.rs usa EventType de event_rules, no al revés

**Verificación:**
```
cargo test domain::credit_card → 15/15 ok
```

**Próximo step:** Step 7 — `domain/projections.rs`

---

### ✅ Step 5 completado — 2026-05-04

**Qué se hizo:**
- `StatusRules`: struct con los 6 switches controlados del sistema
- `EventType`: enum (Income, Expense, Transfer, DebtPayment, DebtCharge, Receivable)
  con `sign()` (+1/-1/0) y `can_affect_real()`
- `RulesMap`: `HashMap<i64, StatusRules>` para lookup sin N queries
- Funciones: `should_affect_real`, `should_affect_available`, `should_affect_future`, `should_create_alert`
- Reglas clave: Transfer siempre neutro, DebtCharge no mueve caja, excluidos no cuentan
- Separación limpia: event_rules no sabe de TC — eso va en credit_card.rs

**Verificación:**
```
cargo test domain::event_rules → 20/20 ok
```

**Próximo step:** Step 6 — `domain/credit_card.rs`

---

### ✅ Step 4 completado — 2026-05-04

**Qué se hizo:**
- Creado `src-tauri/src/domain/money.rs` con newtype `Money(i64)`
- Aritmética: `Add`, `Sub`, `AddAssign`, `SubAssign`, `Neg`
- `from_minor()`, `to_minor()`, `from_input()`, `display()`, `abs()`, `is_zero()`, `is_negative()`
- `from_input()` parsea strings sin float: "10.50" → 1050, "1,000.50" → 100050
- `display()` formatea a "S/ 10.50", negativos como "-S/ 5.00"
- Módulo `domain` registrado en `lib.rs`

**Verificación:**
```
cargo test domain::money → 8/8 tests ok
```

**Próximo step:** Step 5 — `domain/event_rules.rs`

---

### ✅ Step 3 completado — 2026-05-04

**Qué se hizo:**
- 10 archivos de migración SQL en `src-tauri/src/db/migrations/`
- `connection.rs` actualizado: `foreign_keys=ON`, modo `WAL`, `create_if_missing`
- Tablas: `app_settings`, `periods`, `accounts`, `payment_methods`, `categories`,
  `statuses`, `status_rules`, `financial_events`, `custom_field_definitions`, `custom_field_values`
- Índices en `financial_events` (period, status, parent)
- `app_settings` sembrada con fila singleton (id=1, PEN)
- `amount_minor` con CHECK >= 0 (siempre positivo, la dirección la define el `type`)

**Verificación:**
```
cargo check → ✅ Finished en 3.5s
```

**Próximo step:** Step 4 — `domain/money.rs`

---

### ✅ Step 2 completado — 2026-05-04

**Qué se hizo:**
- Agregado `sqlx 0.8` con features `runtime-tokio`, `sqlite`, `migrate`
- Creado módulo `src-tauri/src/db/` con `mod.rs` y `connection.rs`
- `connection::init()` abre/crea `gestermoney.db` en el directorio de datos del usuario
- `DbPool` expuesto como estado Tauri con `app.manage(pool)`
- `sqlx::migrate!()` apunta a `src/db/migrations/` — listo para Step 3
- Directorio de migraciones creado con `.gitkeep`

**Verificación:**
```
cargo check → ✅ Finished en 2s
```

**Próximo step:** Step 3 — 10 migraciones SQL

---

## Pendiente

| Step | Descripción | Estado |
|------|-------------|--------|
| 2 | Configurar SQLite + conexión local | ✅ |
| 3 | Sistema de migraciones (10 tablas) | ✅ |
| 4 | `domain/money.rs` — montos en centavos | ✅ |
| 5 | `domain/event_rules.rs` — reglas de estados | ✅ |
| 6 | `domain/credit_card.rs` — lógica TC | ✅ |
| 7 | `domain/projections.rs` — cálculos principales | ✅ |
| 8 | Tests de cálculo — `cargo test` verde | ✅ |
| 9 | Repositories (acceso a datos) | ✅ |
| 10 | Commands Tauri (API para React) | ✅ |
| 11 | AppShell (layout base) | ✅ |
| 12 | Pantalla Configuración | ✅ |
| 13 | Pantalla Gastos | ✅ |
| 14 | Pantalla Ingresos | ⏳ |
| 15 | Dashboard | ⏳ |
| 16 | Deudas | ⏳ |
| 17 | Gráficas básicas | ⏳ |
