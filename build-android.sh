#!/usr/bin/env bash
set -euo pipefail

echo "================================================"
echo "   Grid Run Android Production Build Pipeline   "
echo "================================================"

# 1. Environment Verification
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "[-] ERROR: ANDROID_HOME is not set."
  echo "    Please set ANDROID_HOME to your Android SDK directory."
  exit 1
fi

if [ -z "${NDK_HOME:-}" ]; then
  echo "[!] NDK_HOME not explicitly set. Trying default location in ANDROID_HOME..."
  export NDK_HOME="$(ls -d ${ANDROID_HOME}/ndk/* 2>/dev/null | sort -V | tail -n 1 || true)"
  if [ -z "${NDK_HOME}" ]; then
    echo "[-] ERROR: Android NDK not found. Please install NDK 25+ or set NDK_HOME."
    exit 1
  fi
fi

echo "[+] Android SDK: ${ANDROID_HOME}"
echo "[+] Android NDK: ${NDK_HOME}"

# 2. Ensure Rust Architectures are Installed
echo "[+] Verifying Rust cross-compilation targets..."
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android

# 3. Ensure Cargo NDK is Installed
if ! command -v cargo-ndk &> /dev/null; then
  echo "[+] Installing cargo-ndk helper..."
  cargo install cargo-ndk
fi

# 4. Build Frontend Assets
echo "[+] Installing Node dependencies & bundling frontend..."
npm install
npm run build

# 5. Initialize Android Project in Tauri if not already initialized
if [ ! -d "src-tauri/gen/android/app" ]; then
  echo "[+] Initializing Tauri v2 Android project..."
  npm run tauri android init
fi

# 6. Build Release APK (Universal or AAB for Google Play Store)
echo "[+] Compiling release package with Tauri v2..."
npm run tauri android build -- --target universal

echo "================================================"
echo "[+] BUILD SUCCESSFUL!"
echo "    Artifact location: src-tauri/gen/android/app/build/outputs/apk/universal/release/"
echo "================================================"

