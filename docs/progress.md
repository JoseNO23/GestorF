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

**Próximo step:** Step 5 — `domain/event_rules.rs`

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
| 5 | `domain/event_rules.rs` — reglas de estados | ⏳ |
| 6 | `domain/credit_card.rs` — lógica TC | ⏳ |
| 7 | `domain/projections.rs` — cálculos principales | ⏳ |
| 8 | Tests de cálculo — `cargo test` verde | ⏳ |
| 9 | Repositories (acceso a datos) | ⏳ |
| 10 | Commands Tauri (API para React) | ⏳ |
| 11 | AppShell (layout base) | ⏳ |
| 12 | Pantalla Configuración | ⏳ |
| 13 | Pantalla Gastos | ⏳ |
| 14 | Pantalla Ingresos | ⏳ |
| 15 | Dashboard | ⏳ |
| 16 | Deudas | ⏳ |
| 17 | Gráficas básicas | ⏳ |
