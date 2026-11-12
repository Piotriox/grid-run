pub mod bitboard;
pub mod commands;
pub mod piece;
pub mod state;
pub mod storage;

use commands::{get_initial_state, get_replay_data, reset_game, validate_and_place_piece, AppState};
use std::sync::Mutex;
use storage::StorageManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(desktop)]
            if let Some(icon) = app.default_window_icon() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_icon(icon.clone());
                }
            }

            let app_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::path::PathBuf::from("."));

            let storage = StorageManager::new(&app_dir);
            let initial_state = storage.load_state();

            app.manage(AppState {
                game: Mutex::new(initial_state),
                storage,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_state,
            validate_and_place_piece,
            get_replay_data,
            reset_game
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

