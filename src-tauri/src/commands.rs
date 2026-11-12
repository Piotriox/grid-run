use crate::state::{GameState, MoveRecord, PlacementResult};
use crate::storage::StorageManager;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub game: Mutex<GameState>,
    pub storage: StorageManager,
}

#[tauri::command]
pub fn get_initial_state(state: State<'_, AppState>) -> Result<GameState, String> {
    let game = state.game.lock().map_err(|e| e.to_string())?;
    Ok(game.clone())
}

#[tauri::command]
pub fn validate_and_place_piece(
    state: State<'_, AppState>,
    piece_id: usize, // slot index (0, 1, 2) or piece catalog ID
    x: usize,        // grid column (0..7)
    y: usize,        // grid row (0..7)
) -> Result<PlacementResult, String> {
    let mut game = state.game.lock().map_err(|e| e.to_string())?;

    // Determine target slot: either direct slot index (0..2) or matching piece id in tray
    let target_slot = if piece_id < 3 && game.tray[piece_id].piece.is_some() {
        piece_id
    } else {
        game.tray
            .iter()
            .position(|slot| slot.piece.as_ref().map(|p| p.id) == Some(piece_id))
            .ok_or_else(|| "Piece not found in player tray.".to_string())?
    };

    let result = game.place_piece(target_slot, y, x)?;

    // Atomic persistence on every valid state transition
    if let Err(e) = state.storage.save_state(&game) {
        eprintln!("[Persistence] Error saving state: {}", e);
    }

    Ok(result)
}

#[tauri::command]
pub fn get_replay_data(state: State<'_, AppState>) -> Result<Vec<MoveRecord>, String> {
    let game = state.game.lock().map_err(|e| e.to_string())?;
    Ok(game.move_history.clone())
}

#[tauri::command]
pub fn reset_game(state: State<'_, AppState>) -> Result<GameState, String> {
    let mut game = state.game.lock().map_err(|e| e.to_string())?;
    let high_score = game.high_score;
    *game = GameState::new(high_score);

    // Save reset state
    let _ = state.storage.save_state(&game);

    Ok(game.clone())
}

