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

**Próximo step:** Step 2 — configurar SQLite (`tauri-plugin-sql`)

---

## Pendiente

| Step | Descripción | Estado |
|------|-------------|--------|
| 2 | Configurar SQLite + conexión local | ⏳ |
| 3 | Sistema de migraciones (10 tablas) | ⏳ |
| 4 | `domain/money.rs` — montos en centavos | ⏳ |
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
