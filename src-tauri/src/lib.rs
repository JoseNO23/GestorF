mod commands;
mod db;
mod domain;
mod repositories;

use tauri::Manager;

use commands::{
    dashboard::get_dashboard,
    events::{create_event, delete_event, get_event, list_events, update_event},
    periods::{close_period, get_active_period, list_periods, set_active_period},
    settings::{
        archive_category, archive_payment_method, create_account, create_category,
        create_payment_method, create_status, list_accounts, list_categories,
        list_payment_methods, list_statuses_with_rules, upsert_status_rules,
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
            // settings — categorías
            list_categories,
            create_category,
            archive_category,
            // settings — estados
            list_statuses_with_rules,
            create_status,
            upsert_status_rules,
            // settings — métodos de pago
            list_payment_methods,
            create_payment_method,
            archive_payment_method,
            // settings — cuentas
            list_accounts,
            create_account,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
