use crate::bitboard::Bitboard;
use rand::distributions::{Distribution, WeightedIndex};
use rand::seq::SliceRandom;
use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PieceTier {
    Tiny,   // 1x1 Dot, 2-dominos (1-2 cells)
    Small,  // 3-trominos, 2x2 corners (3 cells)
    Medium, // 2x2 square, 4-lines, T-shapes, L/J 4-blocks, Z/S shapes (4 cells)
    Large,  // 5-lines, 3x3 square, 3x3 big Ls (5-9 cells)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PieceTemplate {
    pub id: usize,
    pub name: String,
    pub width: usize,
    pub height: usize,
    pub cells: Vec<(usize, usize)>, // relative (row, col)
    pub color: String,
}

impl PieceTemplate {
    pub fn new(id: usize, name: &str, width: usize, height: usize, cells: Vec<(usize, usize)>, color: &str) -> Self {
        Self {
            id,
            name: name.to_string(),
            width,
            height,
            cells,
            color: color.to_string(),
        }
    }

    #[inline]
    pub fn tier(&self) -> PieceTier {
        match self.cells.len() {
            1..=2 => PieceTier::Tiny,
            3 => PieceTier::Small,
            4 => PieceTier::Medium,
            _ => PieceTier::Large,
        }
    }

    /// Computes the 64-bit mask for this piece placed at `(origin_row, origin_col)`.
    /// Returns `None` if the piece exceeds the 8x8 grid boundary.
    #[inline]
    pub fn to_mask(&self, origin_row: usize, origin_col: usize) -> Option<u64> {
        if origin_row + self.height > 8 || origin_col + self.width > 8 {
            return None;
        }

        let mut mask: u64 = 0;
        for &(r, c) in &self.cells {
            let row = origin_row + r;
            let col = origin_col + c;
            mask |= 1u64 << (row * 8 + col);
        }
        Some(mask)
    }

    /// Determines if there is at least one valid cell coordinate on the board where this piece fits.
    #[inline]
    pub fn can_fit_on_board(&self, board: Bitboard) -> bool {
        if self.height > 8 || self.width > 8 {
            return false;
        }

        for r in 0..=(8 - self.height) {
            for c in 0..=(8 - self.width) {
                if let Some(mask) = self.to_mask(r, c) {
                    if !board.collides_with(mask) {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Checks if placing this piece anywhere on the board will trigger at least one line clear.
    #[inline]
    pub fn can_clear_any_line(&self, board: Bitboard) -> bool {
        if self.height > 8 || self.width > 8 {
            return false;
        }

        for r in 0..=(8 - self.height) {
            for c in 0..=(8 - self.width) {
                if let Some(mask) = self.to_mask(r, c) {
                    if !board.collides_with(mask) {
                        let placed = Bitboard(board.0 | mask);
                        let (_, rows, cols, _) = placed.clear_completed_lines();
                        if rows > 0 || cols > 0 {
                            return true;
                        }
                    }
                }
            }
        }
        false
    }
}

/// Catalog of standard Block Blast style polyominoes
pub fn get_piece_catalog() -> Vec<PieceTemplate> {
    vec![
        // 1x1 Dot
        PieceTemplate::new(0, "Dot", 1, 1, vec![(0, 0)], "#3B82F6"),

        // 2-blocks (Dominos)
        PieceTemplate::new(1, "DominoH", 2, 1, vec![(0, 0), (0, 1)], "#F59E0B"),
        PieceTemplate::new(2, "DominoV", 1, 2, vec![(0, 0), (1, 0)], "#F59E0B"),

        // 3-blocks (Lines & 2x2 Corners)
        PieceTemplate::new(3, "Tromino3H", 3, 1, vec![(0, 0), (0, 1), (0, 2)], "#06B6D4"),
        PieceTemplate::new(4, "Tromino3V", 1, 3, vec![(0, 0), (1, 0), (2, 0)], "#06B6D4"),
        PieceTemplate::new(5, "CornerUL", 2, 2, vec![(0, 0), (0, 1), (1, 0)], "#8B5CF6"),
        PieceTemplate::new(6, "CornerUR", 2, 2, vec![(0, 0), (0, 1), (1, 1)], "#8B5CF6"),
        PieceTemplate::new(7, "CornerDL", 2, 2, vec![(0, 0), (1, 0), (1, 1)], "#8B5CF6"),
        PieceTemplate::new(8, "CornerDR", 2, 2, vec![(0, 1), (1, 0), (1, 1)], "#8B5CF6"),

        // 4-blocks: Square 2x2
        PieceTemplate::new(9, "Square2x2", 2, 2, vec![(0, 0), (0, 1), (1, 0), (1, 1)], "#10B981"),

        // 4-blocks: Lines
        PieceTemplate::new(10, "Line4H", 4, 1, vec![(0, 0), (0, 1), (0, 2), (0, 3)], "#3B82F6"),
        PieceTemplate::new(11, "Line4V", 1, 4, vec![(0, 0), (1, 0), (2, 0), (3, 0)], "#3B82F6"),

        // 4-blocks: T-Shapes (4 Rotations)
        PieceTemplate::new(12, "T_Up", 3, 2, vec![(0, 1), (1, 0), (1, 1), (1, 2)], "#A855F7"),
        PieceTemplate::new(19, "T_Down", 3, 2, vec![(0, 0), (0, 1), (0, 2), (1, 1)], "#A855F7"),
        PieceTemplate::new(20, "T_Left", 2, 3, vec![(0, 1), (1, 0), (1, 1), (2, 1)], "#A855F7"),
        PieceTemplate::new(21, "T_Right", 2, 3, vec![(0, 0), (1, 0), (2, 0), (1, 1)], "#A855F7"),

        // 4-blocks: L-Shapes (4 Rotations)
        PieceTemplate::new(13, "L_Shape_V1", 2, 3, vec![(0, 0), (1, 0), (2, 0), (2, 1)], "#6366F1"),
        PieceTemplate::new(22, "L_Shape_V2", 2, 3, vec![(0, 0), (0, 1), (1, 1), (2, 1)], "#6366F1"),
        PieceTemplate::new(23, "L_Shape_H1", 3, 2, vec![(0, 0), (0, 1), (0, 2), (1, 0)], "#6366F1"),
        PieceTemplate::new(24, "L_Shape_H2", 3, 2, vec![(0, 2), (1, 0), (1, 1), (1, 2)], "#6366F1"),

        // 4-blocks: J-Shapes (Ters L, 4 Rotations)
        PieceTemplate::new(14, "J_Shape_V1", 2, 3, vec![(0, 1), (1, 1), (2, 0), (2, 1)], "#3B82F6"),
        PieceTemplate::new(25, "J_Shape_V2", 2, 3, vec![(0, 0), (0, 1), (1, 0), (2, 0)], "#3B82F6"),
        PieceTemplate::new(26, "J_Shape_H1", 3, 2, vec![(0, 0), (0, 1), (0, 2), (1, 2)], "#3B82F6"),
        PieceTemplate::new(27, "J_Shape_H2", 3, 2, vec![(0, 0), (1, 0), (1, 1), (1, 2)], "#3B82F6"),

        // 4-blocks: Z-Shapes & S-Shapes (Kıvrımlı Bloklar)
        PieceTemplate::new(28, "Z_Shape_H", 3, 2, vec![(0, 0), (0, 1), (1, 1), (1, 2)], "#EF4444"),
        PieceTemplate::new(29, "Z_Shape_V", 2, 3, vec![(0, 1), (1, 0), (1, 1), (2, 0)], "#EF4444"),
        PieceTemplate::new(30, "S_Shape_H", 3, 2, vec![(0, 1), (0, 2), (1, 0), (1, 1)], "#10B981"),
        PieceTemplate::new(31, "S_Shape_V", 2, 3, vec![(0, 0), (1, 0), (1, 1), (2, 1)], "#10B981"),

        // 5-blocks: Lines
        PieceTemplate::new(15, "Line5H", 5, 1, vec![(0, 0), (0, 1), (0, 2), (0, 3), (0, 4)], "#06B6D4"),
        PieceTemplate::new(16, "Line5V", 1, 5, vec![(0, 0), (1, 0), (2, 0), (3, 0), (4, 0)], "#06B6D4"),

        // Big Blocks: Square 3x3
        PieceTemplate::new(17, "Square3x3", 3, 3, vec![
            (0, 0), (0, 1), (0, 2),
            (1, 0), (1, 1), (1, 2),
            (2, 0), (2, 1), (2, 2)
        ], "#F97316"),

        // 5-blocks: Big 3x3 L & Corner Formations
        PieceTemplate::new(32, "BigL_UL", 3, 3, vec![
            (0, 0), (0, 1), (0, 2),
            (1, 0),
            (2, 0)
        ], "#F59E0B"),
        PieceTemplate::new(33, "BigL_UR", 3, 3, vec![
            (0, 0), (0, 1), (0, 2),
            (1, 2),
            (2, 2)
        ], "#F59E0B"),
        PieceTemplate::new(34, "BigL_DL", 3, 3, vec![
            (0, 0),
            (1, 0),
            (2, 0), (2, 1), (2, 2)
        ], "#F59E0B"),
        PieceTemplate::new(35, "BigL_DR", 3, 3, vec![
            (0, 2),
            (1, 2),
            (2, 0), (2, 1), (2, 2)
        ], "#F59E0B"),

        // 2-blocks: Diagonal 2-Dots in 2x2 area
        PieceTemplate::new(36, "Diag2_Slash", 2, 2, vec![(0, 1), (1, 0)], "#F59E0B"),
        PieceTemplate::new(37, "Diag2_Backslash", 2, 2, vec![(0, 0), (1, 1)], "#F59E0B"),
    ]
}

/// Active slot for one of the 3 pieces available to drag.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TraySlot {
    pub slot_index: usize,
    pub piece: Option<PieceTemplate>,
}

/// Determines dynamic weight multiplier for a piece based on board fill ratio and playability.
/// Tiered Fill Protection:
/// - fill_ratio < 0.40: Roomy mode (Large pieces normal)
/// - 0.40 <= fill_ratio < 0.55: Caution mode (Large pieces throttled, 3 & 4 blocks favored)
/// - 0.55 <= fill_ratio < 0.70: Recovery mode (Large pieces weight 0; dots & dominos favored)
/// - fill_ratio >= 0.70: Emergency mode (Large pieces weight 0; dots & dominos lifelines)
fn get_piece_weight(piece: &PieceTemplate, fill_ratio: f32, fits: bool) -> f32 {
    let base_weight = match piece.tier() {
        PieceTier::Tiny => {
            if fill_ratio >= 0.70 {
                6.0
            } else if fill_ratio >= 0.55 {
                4.5
            } else if fill_ratio >= 0.40 {
                2.5
            } else {
                1.0
            }
        }
        PieceTier::Small => {
            if fill_ratio >= 0.70 {
                4.0
            } else if fill_ratio >= 0.55 {
                3.5
            } else if fill_ratio >= 0.40 {
                2.2
            } else {
                1.4
            }
        }
        PieceTier::Medium => {
            if fill_ratio >= 0.70 {
                0.3
            } else if fill_ratio >= 0.55 {
                0.8
            } else {
                1.5
            }
        }
        PieceTier::Large => {
            if fill_ratio >= 0.55 {
                0.0
            } else if fill_ratio >= 0.40 {
                0.25
            } else {
                1.2
            }
        }
    };

    let fit_multiplier = if fits { 2.5 } else { 0.15 };
    base_weight * fit_multiplier
}

/// Generates 3 smart, player-friendly pieces following the Director AI rules:
/// 1. Guaranteed Solvability: At least TWO pieces are guaranteed to fit on the current board (if catalog allows).
/// 2. Tiered Fill Protection: When board gets crowded, throttle/eliminate Large pieces and spawn lifelines.
/// 3. Smart Line-Clear Simulation: When fill_ratio >= 0.50, 60% chance to offer a line-clearing piece.
/// 4. Category Balance: Max 1 Large piece per tray; zero Large pieces when fill_ratio >= 0.55.
/// 5. No Duplicates: The 3 slots never roll the identical piece ID.
pub fn generate_smart_tray<R: Rng + ?Sized>(board: Bitboard, rng: &mut R) -> [TraySlot; 3] {
    let catalog = get_piece_catalog();
    let fill_ratio = board.0.count_ones() as f32 / 64.0;

    let mut selected_pieces: Vec<PieceTemplate> = Vec::with_capacity(3);
    let mut selected_ids: Vec<usize> = Vec::with_capacity(3);
    let mut large_count = 0;

    // Rule 1 Prep: Gather all pieces that mathematically fit on the board
    let fitting_pieces: Vec<&PieceTemplate> = catalog.iter().filter(|p| p.can_fit_on_board(board)).collect();

    // Rule 3: Smart Line-Clear Simulation / Priority
    // If fill_ratio >= 0.50, look for pieces that will trigger at least one line clear and offer one with 60% probability.
    if fill_ratio >= 0.50 {
        let clearing_pieces: Vec<&PieceTemplate> = fitting_pieces
            .iter()
            .copied()
            .filter(|p| p.can_clear_any_line(board))
            .filter(|p| !(p.tier() == PieceTier::Large && fill_ratio >= 0.55))
            .collect();

        if !clearing_pieces.is_empty() && rng.gen_bool(0.60) {
            let weights: Vec<f32> = clearing_pieces
                .iter()
                .map(|p| get_piece_weight(p, fill_ratio, true).max(0.1))
                .collect();

            if let Ok(dist) = WeightedIndex::new(&weights) {
                let chosen = clearing_pieces[dist.sample(rng)];
                selected_pieces.push((*chosen).clone());
                selected_ids.push(chosen.id);
                if chosen.tier() == PieceTier::Large {
                    large_count += 1;
                }
            } else if let Some(chosen) = clearing_pieces.choose(rng) {
                selected_pieces.push((*chosen).clone());
                selected_ids.push(chosen.id);
                if chosen.tier() == PieceTier::Large {
                    large_count += 1;
                }
            }
        }
    }

    // Rule 1: Guaranteed Solvability - Guarantee AT LEAST 2 pieces fit on the board (or all available if < 2)
    let target_fitting_count = 2.min(fitting_pieces.len());
    let mut current_fitting_selected = selected_pieces.iter().filter(|p| p.can_fit_on_board(board)).count();

    while current_fitting_selected < target_fitting_count {
        let available_fitting: Vec<&PieceTemplate> = fitting_pieces
            .iter()
            .copied()
            .filter(|p| !selected_ids.contains(&p.id))
            .filter(|p| !(p.tier() == PieceTier::Large && (large_count >= 1 || fill_ratio >= 0.55)))
            .collect();

        if available_fitting.is_empty() {
            break;
        }

        let weights: Vec<f32> = available_fitting
            .iter()
            .map(|p| get_piece_weight(p, fill_ratio, true).max(0.01))
            .collect();

        let chosen = if let Ok(dist) = WeightedIndex::new(&weights) {
            available_fitting[dist.sample(rng)]
        } else {
            *available_fitting.choose(rng).unwrap()
        };

        selected_pieces.push((*chosen).clone());
        selected_ids.push(chosen.id);
        if chosen.tier() == PieceTier::Large {
            large_count += 1;
        }
        current_fitting_selected += 1;
    }

    // Rules 2, 4, 5: Fill remaining slots up to 3 with dynamic weights and variety rules
    while selected_pieces.len() < 3 {
        let candidates: Vec<&PieceTemplate> = catalog
            .iter()
            .filter(|p| {
                if selected_ids.contains(&p.id) {
                    return false; // Rule 5: No duplicate piece IDs
                }
                if p.tier() == PieceTier::Large && (large_count >= 1 || fill_ratio >= 0.55) {
                    return false; // Max 1 Large piece and 0 Large if fill_ratio >= 0.55
                }
                true
            })
            .collect();

        if candidates.is_empty() {
            let fallback: Vec<&PieceTemplate> = catalog
                .iter()
                .filter(|p| !selected_ids.contains(&p.id))
                .collect();

            if let Some(f) = fallback.choose(rng) {
                selected_pieces.push((*f).clone());
                selected_ids.push(f.id);
            } else {
                selected_pieces.push(catalog.choose(rng).unwrap().clone());
            }
            continue;
        }

        let weights: Vec<f32> = candidates
            .iter()
            .map(|p| {
                let fits = p.can_fit_on_board(board);
                get_piece_weight(p, fill_ratio, fits)
            })
            .collect();

        let all_zero = weights.iter().all(|&w| w <= 0.0);
        if !all_zero {
            if let Ok(dist) = WeightedIndex::new(&weights) {
                let chosen = candidates[dist.sample(rng)];
                selected_pieces.push((*chosen).clone());
                selected_ids.push(chosen.id);
                if chosen.tier() == PieceTier::Large {
                    large_count += 1;
                }
                continue;
            }
        }

        if let Some(chosen) = candidates.choose(rng) {
            selected_pieces.push((*chosen).clone());
            selected_ids.push(chosen.id);
            if chosen.tier() == PieceTier::Large {
                large_count += 1;
            }
        }
    }

    // Shuffle slot positions so the guaranteed fitting pieces aren't predictably in slots 0 and 1
    selected_pieces.shuffle(rng);

    [
        TraySlot {
            slot_index: 0,
            piece: Some(selected_pieces[0].clone()),
        },
        TraySlot {
            slot_index: 1,
            piece: Some(selected_pieces[1].clone()),
        },
        TraySlot {
            slot_index: 2,
            piece: Some(selected_pieces[2].clone()),
        },
    ]
}

/// Fallback helper for legacy callers
pub fn generate_new_tray<R: Rng + ?Sized>(rng: &mut R) -> [TraySlot; 3] {
    generate_smart_tray(Bitboard::empty(), rng)
}

