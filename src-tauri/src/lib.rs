mod commands;
mod config;
mod db;
mod domain;
mod repositories;

use std::fs;
use tauri::Manager;

use commands::{
    credit_card::{create_credit_card_purchase, list_credit_card_purchases, preview_installments},
    dashboard::{get_dashboard, get_evolution},
    events::{create_event, delete_event, get_event, list_events, update_event},
    notifications::{list_notifications, mark_notification_dismissed, mark_notification_read},
    periods::{close_period, get_active_period, list_periods, set_active_period},
    profiles::{
        create_profile, delete_profile, get_active_profile_id, list_profiles, rename_profile,
        switch_profile,
    },
    recurring::{
        cancel_future_recurring_events, create_recurring_exception, create_recurring_rule,
        delete_recurring_rule, generate_recurring_events, list_recurring_rules,
        toggle_recurring_rule, update_recurring_rule,
    },
    settings::{
        create_account, create_category, create_payment_method, create_status, delete_account,
        delete_category, delete_payment_method, delete_status, list_accounts, list_categories,
        list_credit_card_balances, list_payment_methods, list_statuses_with_rules, toggle_account,
        toggle_category, toggle_payment_method, toggle_status, update_account, update_category,
        update_payment_method, update_status, upsert_status_rules,
    },
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_dir)?;

            let pool = tauri::async_runtime::block_on(db::connection::init(&app_dir))
                .expect("failed to initialize database");

            app.manage(pool);
            app.manage(config::AppDir(app_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // perfiles
            list_profiles,
            get_active_profile_id,
            create_profile,
            switch_profile,
            rename_profile,
            delete_profile,
            // compras TC en cuotas
            preview_installments,
            create_credit_card_purchase,
            list_credit_card_purchases,
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
            create_recurring_exception,
            cancel_future_recurring_events,
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
            // notificaciones
            list_notifications,
            mark_notification_read,
            mark_notification_dismissed,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
