# Grid Run Android Production Build Script (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Grid Run Android Production Build Pipeline   " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Environment Verification
if (-not $env:ANDROID_HOME) {
    Write-Host "[-] ERROR: ANDROID_HOME environment variable is not set." -ForegroundColor Red
    Write-Host "    Example: `$env:ANDROID_HOME = 'C:\Users\Arda\AppData\Local\Android\Sdk'"
    exit 1
}

Write-Host "[+] Android SDK: $env:ANDROID_HOME" -ForegroundColor Green

# 2. Rust Android targets
Write-Host "[+] Adding Rust Android targets..." -ForegroundColor Yellow
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android

# 3. Cargo NDK
if (-not (Get-Command cargo-ndk -ErrorAction SilentlyContinue)) {
    Write-Host "[+] Installing cargo-ndk..." -ForegroundColor Yellow
    cargo install cargo-ndk
}

# 4. Frontend Build
Write-Host "[+] Building frontend bundle..." -ForegroundColor Yellow
npm install
npm run build

# 5. Build Android Release
Write-Host "[+] Compiling release package with Tauri v2..." -ForegroundColor Yellow
npx @tauri-apps/cli android build --target universal

Write-Host "================================================" -ForegroundColor Green
Write-Host "[+] Android Build Finished!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

