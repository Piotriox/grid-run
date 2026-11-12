use serde::{Deserialize, Serialize};

/// Row bitmasks for an 8x8 grid.
pub const ROW_MASKS: [u64; 8] = [
    0x00000000000000FF,
    0x000000000000FF00,
    0x0000000000FF0000,
    0x00000000FF000000,
    0x000000FF00000000,
    0x0000FF0000000000,
    0x00FF000000000000,
    0xFF00000000000000,
];

/// Column bitmasks for an 8x8 grid.
pub const COL_MASKS: [u64; 8] = [
    0x0101010101010101,
    0x0202020202020202,
    0x0404040404040404,
    0x0808080808080808,
    0x1010101010101010,
    0x2020202020202020,
    0x4040404040404040,
    0x8080808080808080,
];

/// Zero-cost 64-bit Bitboard representation of an 8x8 spatial grid.
/// Each cell (row, col) is mapped to bit index (row * 8 + col).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Bitboard(pub u64);

impl Bitboard {
    #[inline(always)]
    pub const fn empty() -> Self {
        Self(0)
    }

    #[inline(always)]
    pub const fn is_empty(self) -> bool {
        self.0 == 0
    }

    #[inline(always)]
    pub const fn is_occupied(self, row: usize, col: usize) -> bool {
        if row >= 8 || col >= 8 {
            return false;
        }
        (self.0 & (1u64 << (row * 8 + col))) != 0
    }

    #[inline(always)]
    pub fn set_cell(&mut self, row: usize, col: usize) {
        if row < 8 && col < 8 {
            self.0 |= 1u64 << (row * 8 + col);
        }
    }

    #[inline(always)]
    pub fn clear_cell(&mut self, row: usize, col: usize) {
        if row < 8 && col < 8 {
            self.0 &= !(1u64 << (row * 8 + col));
        }
    }

    /// Tests if a piece mask collides with existing occupied cells.
    #[inline(always)]
    pub const fn collides_with(self, piece_mask: u64) -> bool {
        (self.0 & piece_mask) != 0
    }

    /// Places a piece onto the bitboard using bitwise OR.
    #[inline(always)]
    pub fn place(&mut self, piece_mask: u64) {
        self.0 |= piece_mask;
    }

    /// Evaluates and clears all fully completed rows and columns simultaneously.
    /// Returns a tuple: (new_bitboard, cleared_rows_count, cleared_cols_count, cleared_cells_mask)
    pub fn clear_completed_lines(self) -> (Self, u32, u32, u64) {
        let mut clear_mask: u64 = 0;
        let mut cleared_rows: u32 = 0;
        let mut cleared_cols: u32 = 0;

        // Check rows
        for r in 0..8 {
            if (self.0 & ROW_MASKS[r]) == ROW_MASKS[r] {
                clear_mask |= ROW_MASKS[r];
                cleared_rows += 1;
            }
        }

        // Check columns
        for c in 0..8 {
            if (self.0 & COL_MASKS[c]) == COL_MASKS[c] {
                clear_mask |= COL_MASKS[c];
                cleared_cols += 1;
            }
        }

        let new_board = Self(self.0 & !clear_mask);
        (new_board, cleared_rows, cleared_cols, clear_mask)
    }

    /// Converts bitboard into an 8x8 boolean array for frontend consumption.
    pub fn to_grid_array(self) -> [[bool; 8]; 8] {
        let mut grid = [[false; 8]; 8];
        for r in 0..8 {
            for c in 0..8 {
                grid[r][c] = (self.0 & (1u64 << (r * 8 + c))) != 0;
            }
        }
        grid
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_and_cell_set() {
        let mut b = Bitboard::empty();
        assert!(b.is_empty());
        assert!(!b.is_occupied(0, 0));

        b.set_cell(3, 4);
        assert!(b.is_occupied(3, 4));
        assert!(!b.is_occupied(4, 3));

        b.clear_cell(3, 4);
        assert!(!b.is_occupied(3, 4));
    }

    #[test]
    fn test_collision() {
        let mut b = Bitboard::empty();
        b.set_cell(2, 2);

        let piece_mask = 1u64 << (2 * 8 + 2);
        assert!(b.collides_with(piece_mask));

        let non_colliding = 1u64 << (2 * 8 + 3);
        assert!(!b.collides_with(non_colliding));
    }

    #[test]
    fn test_row_and_column_clear() {
        let mut b = Bitboard::empty();
        // Fill row 0
        b.0 |= ROW_MASKS[0];
        // Fill column 0
        b.0 |= COL_MASKS[0];

        let (cleared_board, cleared_rows, cleared_cols, mask) = b.clear_completed_lines();
        assert_eq!(cleared_rows, 1);
        assert_eq!(cleared_cols, 1);
        assert_eq!(mask, ROW_MASKS[0] | COL_MASKS[0]);
        assert_eq!(cleared_board.0, 0);
    }
}
