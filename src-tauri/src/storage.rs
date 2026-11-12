use crate::state::GameState;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub struct StorageManager {
    save_path: PathBuf,
}

impl StorageManager {
    pub fn new<P: AsRef<Path>>(app_data_dir: P) -> Self {
        let dir = app_data_dir.as_ref();
        if !dir.exists() {
            let _ = fs::create_dir_all(dir);
        }
        let save_path = dir.join("gridrun_save.json");
        if !save_path.exists() && dir.join("blockpop_save.json").exists() {
            let _ = fs::rename(dir.join("blockpop_save.json"), &save_path);
        }
        Self { save_path }
    }

    /// Loads the stored GameState or returns a fresh GameState if none exists.
    pub fn load_state(&self) -> GameState {
        if !self.save_path.exists() {
            return GameState::new(0);
        }

        match File::open(&self.save_path) {
            Ok(mut file) => {
                let mut content = String::new();
                if file.read_to_string(&mut content).is_ok() {
                    if let Ok(state) = serde_json::from_str::<GameState>(&content) {
                        return state;
                    }
                }
            }
            Err(e) => {
                eprintln!("[Storage] Failed to open save file: {:?}", e);
            }
        }

        GameState::new(0)
    }

    /// Atomically writes game state using temporary file rename to prevent data corruption.
    pub fn save_state(&self, state: &GameState) -> Result<(), String> {
        let serialized = serde_json::to_string_pretty(state)
            .map_err(|e| format!("Serialization error: {}", e))?;

        let temp_path = self.save_path.with_extension("tmp");

        {
            let mut file = File::create(&temp_path)
                .map_err(|e| format!("Failed to create temporary save file: {}", e))?;
            file.write_all(serialized.as_bytes())
                .map_err(|e| format!("Failed to write save data: {}", e))?;
            file.sync_all()
                .map_err(|e| format!("Failed to sync file to disk: {}", e))?;
        }

        fs::rename(&temp_path, &self.save_path)
            .map_err(|e| format!("Atomic save rename failed: {}", e))?;

        Ok(())
    }
}

