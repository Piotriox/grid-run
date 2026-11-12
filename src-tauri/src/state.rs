use crate::bitboard::{Bitboard, COL_MASKS, ROW_MASKS};
use crate::piece::{generate_smart_tray, TraySlot};
use rand::thread_rng;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveRecord {
    pub step: u32,
    pub piece_id: usize,
    pub slot_index: usize,
    pub row: usize,
    pub col: usize,
    pub timestamp_ms: u64,
    pub lines_cleared: u32,
    pub score_delta: u32,
    pub board_after: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlacementResult {
    pub success: bool,
    pub error: Option<String>,
    pub score_delta: u32,
    pub lines_cleared: u32,
    pub cleared_rows: Vec<usize>,
    pub cleared_cols: Vec<usize>,
    pub cleared_mask: u64,
    pub is_game_over: bool,
    pub current_score: u32,
    pub high_score: u32,
    pub combo_count: u32,
    pub new_tray_spawned: bool,
    pub game_state: GameState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub board: Bitboard,
    pub grid_array: [[bool; 8]; 8],
    pub current_score: u32,
    pub high_score: u32,
    pub combo_count: u32,
    pub tray: [TraySlot; 3],
    pub is_game_over: bool,
    pub move_history: Vec<MoveRecord>,
}

impl Default for GameState {
    fn default() -> Self {
        Self::new(0)
    }
}

impl GameState {
    pub fn new(high_score: u32) -> Self {
        let mut rng = thread_rng();
        let board = Bitboard::empty();
        let tray = generate_smart_tray(board, &mut rng);
        let grid_array = board.to_grid_array();

        Self {
            board,
            grid_array,
            current_score: 0,
            high_score,
            combo_count: 0,
            tray,
            is_game_over: false,
            move_history: Vec::with_capacity(256),
        }
    }

    /// Evaluates if the current board has space for any of the remaining pieces.
    pub fn evaluate_game_over(&mut self) -> bool {
        let mut has_valid_move = false;

        for slot in &self.tray {
            if let Some(ref piece) = slot.piece {
                if piece.can_fit_on_board(self.board) {
                    has_valid_move = true;
                    break;
                }
            }
        }

        self.is_game_over = !has_valid_move;
        self.is_game_over
    }

    /// Atomically validates and places a piece from `slot_index` at `(row, col)`.
    pub fn place_piece(&mut self, slot_index: usize, row: usize, col: usize) -> Result<PlacementResult, String> {
        if self.is_game_over {
            return Err("Game is already over. Reset to start a new match.".to_string());
        }

        if slot_index >= 3 {
            return Err("Invalid piece slot index.".to_string());
        }

        let piece = match self.tray[slot_index].piece.clone() {
            Some(p) => p,
            None => return Err("Selected tray slot is empty.".to_string()),
        };

        // Compute bitmask for this coordinate
        let piece_mask = match piece.to_mask(row, col) {
            Some(m) => m,
            None => return Err("Piece position is out of board boundaries.".to_string()),
        };

        // Collision check (O(1) CPU bitwise AND)
        if self.board.collides_with(piece_mask) {
            return Err("Placement collides with existing blocks.".to_string());
        }

        // Apply piece to bitboard
        self.board.place(piece_mask);
        self.tray[slot_index].piece = None;

        // Base score: 10 points per block (10x scaling)
        let mut score_delta = (piece.cells.len() as u32) * 10;

        // Check for completed rows & columns
        let (cleaned_board, cleared_rows_count, cleared_cols_count, cleared_mask) =
            self.board.clear_completed_lines();

        let total_lines = cleared_rows_count + cleared_cols_count;

        let mut cleared_rows = Vec::new();
        let mut cleared_cols = Vec::new();

        if total_lines > 0 {
            for r in 0..8 {
                if (cleared_mask & ROW_MASKS[r]) == ROW_MASKS[r] {
                    cleared_rows.push(r);
                }
            }
            for c in 0..8 {
                if (cleared_mask & COL_MASKS[c]) == COL_MASKS[c] {
                    cleared_cols.push(c);
                }
            }

            self.combo_count += 1;
            // Line clear score formula (10x scaling): 100 * N * (N + 1) / 2 * combo multiplier
            let line_points = 100 * (total_lines * (total_lines + 1) / 2) * self.combo_count;
            score_delta += line_points;
            self.board = cleaned_board;
        } else {
            self.combo_count = 0;
        }

        self.current_score += score_delta;
        if self.current_score > self.high_score {
            self.high_score = self.current_score;
        }

        // Sync grid array for frontend
        self.grid_array = self.board.to_grid_array();

        // Check if tray needs refill
        let mut new_tray_spawned = false;
        let tray_empty = self.tray.iter().all(|s| s.piece.is_none());
        if tray_empty {
            let mut rng = thread_rng();
            self.tray = generate_smart_tray(self.board, &mut rng);
            new_tray_spawned = true;
        }

        // Check game over condition
        let is_over = self.evaluate_game_over();

        // Record move history
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let step_record = MoveRecord {
            step: self.move_history.len() as u32 + 1,
            piece_id: piece.id,
            slot_index,
            row,
            col,
            timestamp_ms: timestamp,
            lines_cleared: total_lines,
            score_delta,
            board_after: self.board.0,
        };
        self.move_history.push(step_record);

        Ok(PlacementResult {
            success: true,
            error: None,
            score_delta,
            lines_cleared: total_lines,
            cleared_rows,
            cleared_cols,
            cleared_mask,
            is_game_over: is_over,
            current_score: self.current_score,
            high_score: self.high_score,
            combo_count: self.combo_count,
            new_tray_spawned,
            game_state: self.clone(),
        })
    }
}
