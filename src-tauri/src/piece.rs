use crate::bitboard::Bitboard;
use rand::seq::SliceRandom;
use rand::Rng;
use serde::{Deserialize, Serialize};

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
    ]
}

/// Active slot for one of the 3 pieces available to drag.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TraySlot {
    pub slot_index: usize,
    pub piece: Option<PieceTemplate>,
}

/// Generates 3 new random pieces for the player tray.
pub fn generate_new_tray<R: Rng + ?Sized>(rng: &mut R) -> [TraySlot; 3] {
    let catalog = get_piece_catalog();
    [
        TraySlot {
            slot_index: 0,
            piece: Some(catalog.choose(rng).unwrap().clone()),
        },
        TraySlot {
            slot_index: 1,
            piece: Some(catalog.choose(rng).unwrap().clone()),
        },
        TraySlot {
            slot_index: 2,
            piece: Some(catalog.choose(rng).unwrap().clone()),
        },
    ]
}

