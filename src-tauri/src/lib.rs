mod commands;
mod db;
mod domain;
mod repositories;

use tauri::Manager;

use commands::{
    dashboard::{get_dashboard, get_evolution},
    events::{create_event, delete_event, get_event, list_events, update_event},
    periods::{close_period, get_active_period, list_periods, set_active_period},
    recurring::{
        create_recurring_rule, delete_recurring_rule, generate_recurring_events,
        list_recurring_rules, toggle_recurring_rule, update_recurring_rule,
    },
    settings::{
        create_account, create_category, create_payment_method, create_status,
        delete_account, delete_category, delete_payment_method, delete_status,
        list_accounts, list_categories, list_credit_card_balances, list_payment_methods,
        list_statuses_with_rules,
        toggle_account, toggle_category, toggle_payment_method, toggle_status,
        update_account, update_category, update_payment_method, update_status,
        upsert_status_rules,
    },
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::connection::init(app))
                .expect("failed to initialize database");
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // dashboard
            get_dashboard,
            get_evolution,
            // events
            list_events,
            get_event,
            create_event,
            update_event,
            delete_event,
            // periods
            get_active_period,
            list_periods,
            set_active_period,
            close_period,
            // reglas recurrentes
            list_recurring_rules,
            create_recurring_rule,
            update_recurring_rule,
            toggle_recurring_rule,
            delete_recurring_rule,
            generate_recurring_events,
            // settings — categorías
            list_categories,
            create_category,
            update_category,
            toggle_category,
            delete_category,
            // settings — estados
            list_statuses_with_rules,
            create_status,
            update_status,
            toggle_status,
            delete_status,
            upsert_status_rules,
            // settings — métodos de pago
            list_payment_methods,
            create_payment_method,
            update_payment_method,
            toggle_payment_method,
            delete_payment_method,
            // settings — cuentas
            list_accounts,
            create_account,
            update_account,
            toggle_account,
            delete_account,
            // tarjetas de crédito
            list_credit_card_balances,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
